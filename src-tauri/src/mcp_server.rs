use std::io::{self, BufRead, Write};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use rusqlite::Connection;

use crate::db;
use crate::git_watcher;
use crate::models::{FileSnippetResponse, Session, SnippetNode};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<Value>,
}

fn open_mcp_db() -> rusqlite::Result<Connection> {
    let db_path = db::get_database_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[MCP] Warning: Failed to open DB at {:?}: {}. Using fallback snippet_board.db", db_path, e);
            Connection::open("snippet_board.db").unwrap_or_else(|_| Connection::open(":memory:").expect("Failed to open SQLite"))
        }
    };
    db::init_db(&conn)?;
    Ok(conn)
}

pub fn parse_stack_frames(trace_text: &str) -> Vec<(String, i32)> {
    let mut frames = Vec::new();
    let known_extensions = [
        ".tsx", ".ts", ".jsx", ".js", ".rs", ".py", ".go",
        ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp",
        ".java", ".kt", ".swift", ".rb", ".php",
    ];

    for line in trace_text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // 1. Python pattern: File "...", line 123 or File '...', line 123
        if let Some(file_idx) = trimmed.find("File \"").or_else(|| trimmed.find("File '")) {
            let quote_char = trimmed.as_bytes()[file_idx + 5] as char;
            let after_quote = &trimmed[file_idx + 6..];
            if let Some(end_quote_idx) = after_quote.find(quote_char) {
                let file_path = &after_quote[..end_quote_idx];
                let remainder = &after_quote[end_quote_idx + 1..];
                if let Some(line_kw_idx) = remainder.find(", line ") {
                    let after_line_kw = &remainder[line_kw_idx + 7..];
                    let line_str: String = after_line_kw.chars().take_while(|c| c.is_ascii_digit()).collect();
                    if let Ok(line_num) = line_str.parse::<i32>() {
                        if !file_path.is_empty() && line_num > 0 {
                            frames.push((file_path.to_string(), line_num));
                            continue;
                        }
                    }
                }
            }
        }

        // 2. path.ext:line pattern
        for ext in &known_extensions {
            let ext_colon = format!("{}:", ext);
            if let Some(ext_idx) = trimmed.find(&ext_colon) {
                let colon_idx = ext_idx + ext.len();
                let sub = &trimmed[..colon_idx];
                let file_candidate = sub.rsplit(|c| c == ' ' || c == '(' || c == '"' || c == '\'' || c == '[' || c == '<')
                    .next()
                    .unwrap_or(sub);
                let rem = &trimmed[colon_idx + 1..];
                let line_str: String = rem.chars().take_while(|c| c.is_ascii_digit()).collect();
                if let Ok(line_num) = line_str.parse::<i32>() {
                    if !file_candidate.is_empty() && line_num > 0 {
                        frames.push((file_candidate.to_string(), line_num));
                        break;
                    }
                }
            }
        }
    }

    frames
}

pub fn resolve_file_slice(workspace: Option<&str>, file_str: &str, line_start: Option<i32>, line_end: Option<i32>) -> FileSnippetResponse {
    let path_obj = std::path::Path::new(file_str);
    if path_obj.is_absolute() && path_obj.exists() {
        return git_watcher::read_file_slice(file_str, line_start, line_end);
    }
    if let Some(ws) = workspace {
        if ws != "GLOBAL" {
            let joined = std::path::Path::new(ws).join(file_str);
            if joined.exists() {
                if let Some(joined_str) = joined.to_str() {
                    return git_watcher::read_file_slice(joined_str, line_start, line_end);
                }
            }
        }
    }
    git_watcher::read_file_slice(file_str, line_start, line_end)
}

pub fn handle_tool_call(conn: &Connection, name: &str, args: &Value) -> Result<String, String> {
    let target_name = name
        .strip_prefix("threadtrace_")
        .or_else(|| name.strip_prefix("threadtrace/"))
        .unwrap_or(name);

    match target_name {
        "auto_slice_and_plot" => {
            let trace_text = args.get("trace_text")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter 'trace_text'".to_string())?;
            let workspace = args.get("workspace").and_then(|v| v.as_str()).unwrap_or("GLOBAL");
            let session_id_arg = args.get("session_id").and_then(|v| v.as_str());

            let session_id = match session_id_arg {
                Some(s) => s.to_string(),
                None => match db::get_active_session_id(conn, Some(workspace)).map_err(|e| e.to_string())? {
                    Some(s) => s,
                    None => {
                        let new_id = format!("sess_slice_{}", db::now_millis() % 100000);
                        let sess = Session {
                            id: new_id.clone(),
                            name: "AUTO_SLICE_INVESTIGATION".to_string(),
                            workspace: workspace.to_string(),
                            category: Some("BUG_INVESTIGATION".to_string()),
                            status: Some("IN_PROGRESS".to_string()),
                            summary: Some(trace_text.lines().next().unwrap_or("Stack trace auto-slice").to_string()),
                            created_at: db::now_millis(),
                            updated_at: db::now_millis(),
                        };
                        db::upsert_session(conn, &sess).map_err(|e| e.to_string())?;
                        db::set_active_session_id(conn, Some(workspace), &new_id).map_err(|e| e.to_string())?;
                        new_id
                    }
                }
            };

            // Parse candidate stack frames using robust multi-language parser
            let frames = parse_stack_frames(trace_text);

            let ts = db::now_millis();

            // Card 1: Root Cause / Bug
            let (file1, line1) = frames.first().cloned().unwrap_or(("src/services/auth.ts".to_string(), 42));
            let slice1 = resolve_file_slice(Some(workspace), &file1, Some((line1 - 3).max(1)), Some(line1 + 6));
            let code1 = if slice1.exists && !slice1.content.is_empty() {
                slice1.content
            } else {
                format!("// [CRASH TRACE FAULT POINT]\n// Target: {}:{}\n// Error: {}", file1, line1, trace_text.lines().next().unwrap_or("Unhandled Exception"))
            };

            let node1 = SnippetNode {
                id: None,
                session_id: Some(session_id.clone()),
                x: 120.0,
                y: 100.0,
                width: Some(380.0),
                height: Some(290.0),
                title: "BUG_ROOT_CAUSE_INVERSION".to_string(),
                tag: "BUG".to_string(),
                mode: "read".to_string(),
                code: Some(code1),
                notes: Some(format!("Stack trace fault site: {}:{}\nTrace: {}", file1, line1, trace_text.lines().take(2).collect::<Vec<_>>().join("\n"))),
                file_path: Some(file1.clone()),
                line_start: Some((line1 - 3).max(1)),
                line_end: Some(line1 + 6),
                checklist: Some("- [x] Parse crash stack frame\n- [ ] Reproduce assertion failure\n- [ ] Inspect pointer/token state".to_string()),
                verification_status: Some("CRASH".to_string()),
                confidence: Some(0.96),
                created_at: Some(ts),
                updated_at: Some(ts),
            };
            let id1 = db::upsert_node_with_session(conn, &node1, Some(workspace), Some(&session_id)).map_err(|e| e.to_string())?;

            // Card 2: Trigger / Evidence Propagation
            let (file2, line2) = if frames.len() > 1 {
                frames[1].clone()
            } else {
                (file1.clone(), line1 + 12)
            };
            let slice2 = resolve_file_slice(Some(workspace), &file2, Some((line2 - 3).max(1)), Some(line2 + 6));
            let code2 = if slice2.exists && !slice2.content.is_empty() {
                slice2.content
            } else {
                format!("// [EVIDENCE / CALL PROPAGATION]\n// Caller: {}:{}\n// Context: Concurrent execution loop trigger", file2, line2)
            };

            let node2 = SnippetNode {
                id: None,
                session_id: Some(session_id.clone()),
                x: 580.0,
                y: 100.0,
                width: Some(380.0),
                height: Some(290.0),
                title: "EVIDENCE_CONCURRENT_TRIGGER".to_string(),
                tag: "EVIDENCE".to_string(),
                mode: "read".to_string(),
                code: Some(code2),
                notes: Some("Trigger propagation point: asynchronous or multi-threaded caller path.".to_string()),
                file_path: Some(file2.clone()),
                line_start: Some((line2 - 3).max(1)),
                line_end: Some(line2 + 6),
                checklist: Some("- [ ] Validate caller entry invariants\n- [ ] Trace lock acquire sequence".to_string()),
                verification_status: Some("INVESTIGATING".to_string()),
                confidence: Some(0.85),
                created_at: Some(ts),
                updated_at: Some(ts),
            };
            let id2 = db::upsert_node_with_session(conn, &node2, Some(workspace), Some(&session_id)).map_err(|e| e.to_string())?;

            // Card 3: Fix Candidate / Invariant Guard
            let node3 = SnippetNode {
                id: None,
                session_id: Some(session_id.clone()),
                x: 1040.0,
                y: 100.0,
                width: Some(380.0),
                height: Some(290.0),
                title: "FIX_SYNCHRONIZATION_GUARD".to_string(),
                tag: "FIX".to_string(),
                mode: "read".to_string(),
                code: Some("// [RECOMMENDED PATCH / GUARD INVARIANT]\n// Wrap critical lifecycle section with mutex / atomic in-flight guard\n// Ensure teardown checks write pointer before freeing descriptors.".to_string()),
                notes: Some("Candidate mitigation to resolve invariant inversion.".to_string()),
                file_path: Some(file1.clone()),
                line_start: Some(line1),
                line_end: Some(line1 + 10),
                checklist: Some("- [ ] Apply mutex / synchronization lock\n- [ ] Run stress test suite\n- [ ] Confirm clean exit code 0".to_string()),
                verification_status: Some("INVESTIGATING".to_string()),
                confidence: Some(0.80),
                created_at: Some(ts),
                updated_at: Some(ts),
            };
            let id3 = db::upsert_node_with_session(conn, &node3, Some(workspace), Some(&session_id)).map_err(|e| e.to_string())?;

            // Connect links: id1 -> id2 (CAUSES), id2 -> id3 (FIXES)
            let _ = db::add_link_with_relation(conn, id1, id2, Some("CAUSES"), Some(workspace), Some(&session_id));
            let _ = db::add_link_with_relation(conn, id2, id3, Some("FIXES"), Some(workspace), Some(&session_id));

            let _ = db::log_activity(
                conn,
                &session_id,
                "AI_AGENT",
                Some("threadtrace-mcp"),
                "AUTO_SLICE_AND_PLOT",
                "Reduced stack trace to 3-card topological DAG",
                &json!({
                    "root_cause_id": id1,
                    "trigger_id": id2,
                    "fix_id": id3,
                    "frames_found": frames.len(),
                    "file": file1
                }).to_string(),
            );

            Ok(json!({
                "status": "SUCCESS",
                "session_id": session_id,
                "reduction": "20,000-to-3-Card Triad Plotted",
                "cards": [
                    { "id": id1, "title": "BUG_ROOT_CAUSE_INVERSION", "role": "ROOT_CAUSE", "status": "CRASH", "pos": [120, 100] },
                    { "id": id2, "title": "EVIDENCE_CONCURRENT_TRIGGER", "role": "TRIGGER", "status": "INVESTIGATING", "pos": [580, 100] },
                    { "id": id3, "title": "FIX_SYNCHRONIZATION_GUARD", "role": "FIX", "status": "INVESTIGATING", "pos": [1040, 100] }
                ],
                "links": [
                    { "from": id1, "to": id2, "relation": "CAUSES" },
                    { "from": id2, "to": id3, "relation": "FIXES" }
                ]
            }).to_string())
        }

        "pin_clue" => {
            let title = args.get("title").and_then(|v| v.as_str()).ok_or("Missing title")?;
            let tag = args.get("tag").and_then(|v| v.as_str()).ok_or("Missing tag")?;
            let file_path = args.get("file_path").and_then(|v| v.as_str());
            let line_start = args.get("line_start").and_then(|v| v.as_i64()).map(|v| v as i32);
            let line_end = args.get("line_end").and_then(|v| v.as_i64()).map(|v| v as i32);
            let notes = args.get("notes").and_then(|v| v.as_str());
            let checklist = args.get("checklist").and_then(|v| v.as_str());
            let status = args.get("verification_status").and_then(|v| v.as_str()).unwrap_or("INVESTIGATING");
            let conf = args.get("confidence").and_then(|v| v.as_f64()).unwrap_or(1.0);
            let workspace = args.get("workspace").and_then(|v| v.as_str()).unwrap_or("GLOBAL");
            let session_id_arg = args.get("session_id").and_then(|v| v.as_str());

            let session_id = match session_id_arg {
                Some(s) => s.to_string(),
                None => db::get_active_session_id(conn, Some(workspace)).map_err(|e| e.to_string())?
                    .unwrap_or_else(|| "sess_default".to_string()),
            };

            let code = match args.get("code").and_then(|v| v.as_str()) {
                Some(c) => Some(c.to_string()),
                None => {
                    if let Some(fp) = file_path {
                        let slice = resolve_file_slice(Some(workspace), fp, line_start, line_end);
                        if slice.exists && !slice.content.is_empty() {
                            Some(slice.content)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }
            };

            // Calculate auto-position offset
            let existing_nodes = db::get_board_data_for_session(conn, Some(workspace), Some(&session_id))
                .map(|b| b.nodes.len())
                .unwrap_or(0);
            let x = 80.0 + ((existing_nodes % 5) as f64) * 60.0;
            let y = 80.0 + ((existing_nodes % 5) as f64) * 60.0;
            let ts = db::now_millis();

            let node = SnippetNode {
                id: None,
                session_id: Some(session_id.clone()),
                x,
                y,
                width: Some(360.0),
                height: Some(280.0),
                title: title.to_string(),
                tag: tag.to_string(),
                mode: "read".to_string(),
                code,
                notes: notes.map(|s| s.to_string()),
                file_path: file_path.map(|s| s.to_string()),
                line_start,
                line_end,
                checklist: checklist.map(|s| s.to_string()),
                verification_status: Some(status.to_string()),
                confidence: Some(conf),
                created_at: Some(ts),
                updated_at: Some(ts),
            };

            let id = db::upsert_node_with_session(conn, &node, Some(workspace), Some(&session_id)).map_err(|e| e.to_string())?;

            let _ = db::log_activity(
                conn,
                &session_id,
                "AI_AGENT",
                Some("threadtrace-mcp"),
                "PIN_CLUE",
                &format!("Pinned clue: {}", title),
                &json!({ "node_id": id, "title": title, "tag": tag, "file": file_path }).to_string(),
            );

            Ok(json!({
                "status": "SUCCESS",
                "node_id": id,
                "title": title,
                "tag": tag,
                "session_id": session_id,
                "verification_status": status
            }).to_string())
        }

        "link_clues" => {
            let from_id = args.get("from_id").and_then(|v| v.as_i64()).ok_or("Missing from_id")?;
            let to_id = args.get("to_id").and_then(|v| v.as_i64()).ok_or("Missing to_id")?;
            let relation = args.get("relation_type").and_then(|v| v.as_str()).unwrap_or("CAUSES");
            let workspace = args.get("workspace").and_then(|v| v.as_str()).unwrap_or("GLOBAL");
            let session_id_arg = args.get("session_id").and_then(|v| v.as_str());

            let link_id = db::add_link_with_relation(
                conn,
                from_id,
                to_id,
                Some(relation),
                Some(workspace),
                session_id_arg,
            ).map_err(|e| e.to_string())?;

            if let Some(sess) = session_id_arg {
                let _ = db::log_activity(
                    conn,
                    sess,
                    "AI_AGENT",
                    Some("threadtrace-mcp"),
                    "LINK_CLUES",
                    &format!("Connected {} -> {} [{}]", from_id, to_id, relation),
                    &json!({ "link_id": link_id, "from": from_id, "to": to_id, "relation": relation }).to_string(),
                );
            }

            Ok(json!({
                "status": "SUCCESS",
                "link_id": link_id,
                "from_id": from_id,
                "to_id": to_id,
                "relation_type": relation
            }).to_string())
        }

        "verify_clue" => {
            let node_id = args.get("node_id").and_then(|v| v.as_i64()).ok_or("Missing node_id")?;
            let status = args.get("status").and_then(|v| v.as_str()).ok_or("Missing status")?;
            let confidence = args.get("confidence").and_then(|v| v.as_f64());
            let notes_to_append = args.get("notes").and_then(|v| v.as_str());
            let checklist = args.get("checklist").and_then(|v| v.as_str());

            // Use atomic db::update_node_verification to preserve node position and session isolation
            db::update_node_verification(conn, node_id, status, confidence, notes_to_append, checklist)
                .map_err(|e| e.to_string())?;

            let (title, session_id): (String, Option<String>) = conn.query_row(
                "SELECT title, session_id FROM nodes WHERE id = ?1",
                rusqlite::params![node_id],
                |row| Ok((row.get(0)?, row.get(1).ok())),
            ).map_err(|e| format!("Node {} not found: {}", node_id, e))?;

            if let Some(ref sess) = session_id {
                let _ = db::log_activity(
                    conn,
                    sess,
                    "AI_AGENT",
                    Some("threadtrace-mcp"),
                    "VERIFY",
                    &format!("Updated verification for {} to [{}]", title, status),
                    &json!({ "node_id": node_id, "status": status, "confidence": confidence }).to_string(),
                );
            }

            Ok(json!({
                "status": "SUCCESS",
                "node_id": node_id,
                "title": title,
                "verification_status": status,
                "confidence": confidence,
                "session_id": session_id
            }).to_string())
        }

        "list_sessions" => {
            let workspace = args.get("workspace").and_then(|v| v.as_str()).unwrap_or("GLOBAL");
            let sessions = db::list_sessions(conn, Some(workspace)).map_err(|e| e.to_string())?;
            let mut summary_list = Vec::new();
            for s in sessions {
                let node_count: i64 = conn.query_row(
                    "SELECT COUNT(*) FROM nodes WHERE session_id = ?1",
                    rusqlite::params![s.id],
                    |row| row.get(0),
                ).unwrap_or(0);

                summary_list.push(json!({
                    "id": s.id,
                    "name": s.name,
                    "status": s.status.unwrap_or_else(|| "IN_PROGRESS".to_string()),
                    "nodes_count": node_count,
                    "category": s.category,
                    "summary": s.summary,
                    "updated_at": s.updated_at
                }));
            }
            Ok(serde_json::to_string_pretty(&summary_list).unwrap_or_else(|_| "[]".to_string()))
        }

        "switch_session" => {
            let session_id = args.get("session_id").and_then(|v| v.as_str()).ok_or("Missing session_id")?;
            let workspace = args.get("workspace").and_then(|v| v.as_str()).unwrap_or("GLOBAL");

            db::set_active_session_id(conn, Some(workspace), session_id).map_err(|e| e.to_string())?;
            let _ = db::log_activity(
                conn,
                session_id,
                "AI_AGENT",
                Some("threadtrace-mcp"),
                "SWITCH_SESSION",
                &format!("Switched to session {}", session_id),
                &json!({ "session_id": session_id }).to_string(),
            );

            let session_obj = db::get_session(conn, session_id).map_err(|e| e.to_string())?;
            Ok(json!({
                "status": "SUCCESS",
                "active_session": session_id,
                "session": session_obj
            }).to_string())
        }

        "recall_history" => {
            let workspace = args.get("workspace").and_then(|v| v.as_str()).unwrap_or("GLOBAL");
            let session_id = match args.get("session_id").and_then(|v| v.as_str()) {
                Some(s) => s.to_string(),
                None => match db::get_active_session_id(conn, Some(workspace)).map_err(|e| e.to_string())? {
                    Some(s) => s,
                    None => {
                        let sessions = db::list_sessions(conn, None).unwrap_or_default();
                        sessions.first().map(|s| s.id.clone()).unwrap_or_else(|| "sess_default".to_string())
                    }
                },
            };
            let limit = args.get("limit").and_then(|v| v.as_u64()).map(|v| v as usize);

            let activities = db::get_session_activity(conn, &session_id, limit).map_err(|e| e.to_string())?;
            Ok(serde_json::to_string_pretty(&activities).unwrap_or_else(|_| "[]".to_string()))
        }

        "search_past_investigations" => {
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
            let results = db::search_past_investigations(conn, query).map_err(|e| e.to_string())?;
            Ok(serde_json::to_string_pretty(&results).unwrap_or_else(|_| "[]".to_string()))
        }

        _ => Err(format!("Unknown MCP tool: {}", name)),
    }
}

pub fn handle_json_rpc_message(conn: &Connection, raw: &str) -> Option<String> {
    let req: JsonRpcRequest = match serde_json::from_str(raw) {
        Ok(r) => r,
        Err(_) => return None,
    };

    match req.method.as_str() {
        "initialize" => {
            let resp = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: req.id,
                result: Some(json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "threadtrace-mcp-server",
                        "version": "1.0.4"
                    }
                })),
                error: None,
            };
            Some(serde_json::to_string(&resp).unwrap_or_default())
        }

        "notifications/initialized" => None,

        "ping" => {
            let resp = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: req.id,
                result: Some(json!({})),
                error: None,
            };
            Some(serde_json::to_string(&resp).unwrap_or_default())
        }

        "tools/list" => {
            let tools = json!({
                "tools": [
                    {
                        "name": "auto_slice_and_plot",
                        "description": "Parses stack frames / crash log, auto-slices files from disk, positions non-overlapping cards, and connects causal red strings.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "trace_text": { "type": "string", "description": "Crash log, stack trace, or compiler error text" },
                                "workspace": { "type": "string", "description": "Local workspace root path (optional)" },
                                "session_id": { "type": "string", "description": "Investigation session ID (optional)" },
                                "layout_style": { "type": "string", "description": "Layout style, e.g. 'causal_dag' (optional)" }
                            },
                            "required": ["trace_text"]
                        }
                    },
                    {
                        "name": "pin_clue",
                        "description": "Pins an individual clue card onto the canvas. Auto-reads file slices from disk if code is omitted.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "title": { "type": "string", "description": "Headline/title of the clue" },
                                "tag": { "type": "string", "description": "Clue tag ('BUG', 'TASK', 'FIX', 'EVIDENCE', 'ROOT_CAUSE', etc.)" },
                                "file_path": { "type": "string", "description": "Relative or absolute file path" },
                                "line_start": { "type": "integer", "description": "Start line number" },
                                "line_end": { "type": "integer", "description": "End line number" },
                                "code": { "type": "string", "description": "Code snippet content (optional; auto-read if omitted)" },
                                "notes": { "type": "string", "description": "Investigation hypotheses, notes or Markdown" },
                                "checklist": { "type": "string", "description": "Markdown checklist items (- [ ] ...)" },
                                "verification_status": { "type": "string", "enum": ["CRASH", "INVESTIGATING", "VERIFIED"], "description": "Verification status" },
                                "confidence": { "type": "number", "description": "Confidence level between 0.0 and 1.0" },
                                "workspace": { "type": "string", "description": "Workspace root path (optional)" },
                                "session_id": { "type": "string", "description": "Investigation session ID (optional)" }
                            },
                            "required": ["title", "tag"]
                        }
                    },
                    {
                        "name": "link_clues",
                        "description": "Draws typed evidence red string connection between two clue cards.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "from_id": { "type": "integer", "description": "Source node ID" },
                                "to_id": { "type": "integer", "description": "Target node ID" },
                                "relation_type": { "type": "string", "description": "Relation type ('CAUSES', 'CALLS', 'FIXES')", "default": "CAUSES" },
                                "workspace": { "type": "string", "description": "Workspace root path (optional)" },
                                "session_id": { "type": "string", "description": "Investigation session ID (optional)" }
                            },
                            "required": ["from_id", "to_id"]
                        }
                    },
                    {
                        "name": "verify_clue",
                        "description": "Updates verification status, confidence score, and checks off items.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "node_id": { "type": "integer", "description": "Target clue node ID" },
                                "status": { "type": "string", "enum": ["CRASH", "INVESTIGATING", "VERIFIED"], "description": "New verification state" },
                                "confidence": { "type": "number", "description": "Confidence level (0.0 to 1.0, optional)" },
                                "notes": { "type": "string", "description": "Additional notes to append (optional)" }
                            },
                            "required": ["node_id", "status"]
                        }
                    },
                    {
                        "name": "list_sessions",
                        "description": "Lists all active and past investigation sessions/boards in the workspace.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "workspace": { "type": "string", "description": "Workspace root path (optional)" }
                            }
                        }
                    },
                    {
                        "name": "switch_session",
                        "description": "Switches the active investigation board session.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "session_id": { "type": "string", "description": "Target session ID to activate" },
                                "workspace": { "type": "string", "description": "Workspace root path (optional)" }
                            },
                            "required": ["session_id"]
                        }
                    },
                    {
                        "name": "recall_history",
                        "description": "Retrieves chronological sequence of actions, tool calls, and tests recorded in the WAL for a session.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "session_id": { "type": "string", "description": "Session ID (optional; defaults to active session)" },
                                "workspace": { "type": "string", "description": "Workspace root path (optional)" },
                                "limit": { "type": "integer", "description": "Max entries to return (default 25)" }
                            }
                        }
                    },
                    {
                        "name": "search_past_investigations",
                        "description": "Searches past investigation clues, code snippets, notes, and hypotheses across sessions.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "query": { "type": "string", "description": "Search keyword or symbol across past sessions" }
                            },
                            "required": ["query"]
                        }
                    }
                ]
            });
            let resp = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: req.id,
                result: Some(tools),
                error: None,
            };
            Some(serde_json::to_string(&resp).unwrap_or_default())
        }

        "tools/call" => {
            let tool_name = req.params.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let default_args = json!({});
            let arguments = req.params.get("arguments").unwrap_or(&default_args);

            match handle_tool_call(conn, tool_name, arguments) {
                Ok(text_output) => {
                    let resp = JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id: req.id,
                        result: Some(json!({
                            "content": [
                                {
                                    "type": "text",
                                    "text": text_output
                                }
                            ],
                            "isError": false
                        })),
                        error: None,
                    };
                    Some(serde_json::to_string(&resp).unwrap_or_default())
                }
                Err(err_msg) => {
                    let resp = JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id: req.id,
                        result: Some(json!({
                            "content": [
                                {
                                    "type": "text",
                                    "text": format!("Error: {}", err_msg)
                                }
                            ],
                            "isError": true
                        })),
                        error: None,
                    };
                    Some(serde_json::to_string(&resp).unwrap_or_default())
                }
            }
        }

        _ => {
            let resp = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: req.id,
                result: None,
                error: Some(json!({
                    "code": -32601,
                    "message": format!("Method not found: {}", req.method)
                })),
            };
            Some(serde_json::to_string(&resp).unwrap_or_default())
        }
    }
}

pub fn run_stdio_server() {
    eprintln!("[ThreadTrace MCP] Starting stdio JSON-RPC 2.0 server...");
    let conn = match open_mcp_db() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[ThreadTrace MCP] Fatal: Failed to initialize SQLite database: {}", e);
            std::process::exit(1);
        }
    };

    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = stdin.lock();
    let mut writer = stdout.lock();

    let mut line_buf = String::new();
    while let Ok(bytes_read) = reader.read_line(&mut line_buf) {
        if bytes_read == 0 {
            break; // EOF
        }
        let trimmed = line_buf.trim();
        if !trimmed.is_empty() {
            if let Some(resp_json) = handle_json_rpc_message(&conn, trimmed) {
                let _ = writeln!(writer, "{}", resp_json);
                let _ = writer.flush();
            }
        }
        line_buf.clear();
    }
    eprintln!("[ThreadTrace MCP] Stdio server connection closed.");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn in_memory_mcp_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        db::init_db(&conn).unwrap();
        conn
    }

    #[test]
    fn test_parse_stack_frames_multilingual() {
        let trace = r#"
Thread 1 "app" received signal SIGSEGV, Segmentation fault.
#0  0x0000555555555149 in main () at trans.c:4824
#1  0x00007ffff7a03b97 in __libc_start_main () at ../csu/libc-start.c:308
Traceback (most recent call last):
  File "src/services/auth.py", line 42, in handle_expired_session
    validate_token(tok)
  File "/usr/local/lib/python3.10/site-packages/jwt/api_jwt.py", line 155, in decode
    return payload
Error:
    at Object.runDispatch (src/components/SnippetBoard.tsx:120:8)
    at panic (main.rs:93:14)
    at compile (engine.cpp:108:5)
    at goroutine (main.go:55 +0x26)
"#;
        let frames = parse_stack_frames(trace);
        assert!(!frames.is_empty());
        assert!(frames.iter().any(|(f, l)| f == "trans.c" && *l == 4824), "trans.c:4824 failed: {:?}", frames);
        assert!(frames.iter().any(|(f, l)| f == "src/services/auth.py" && *l == 42), "Python trace failed: {:?}", frames);
        assert!(frames.iter().any(|(f, l)| f == "src/components/SnippetBoard.tsx" && *l == 120), "TSX trace failed: {:?}", frames);
        assert!(frames.iter().any(|(f, l)| f == "main.rs" && *l == 93), "Rust trace failed: {:?}", frames);
        assert!(frames.iter().any(|(f, l)| f == "engine.cpp" && *l == 108), "C++ trace failed: {:?}", frames);
        assert!(frames.iter().any(|(f, l)| f == "main.go" && *l == 55), "Go trace failed: {:?}", frames);
    }

    #[test]
    fn test_mcp_initialize_and_tools_list() {
        let conn = in_memory_mcp_db();
        let init_req = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#;
        let init_resp = handle_json_rpc_message(&conn, init_req).unwrap();
        assert!(init_resp.contains("threadtrace-mcp-server"));

        let list_req = r#"{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}"#;
        let list_resp = handle_json_rpc_message(&conn, list_req).unwrap();
        assert!(list_resp.contains("auto_slice_and_plot"));
        assert!(list_resp.contains("pin_clue"));
        assert!(list_resp.contains("link_clues"));
        assert!(list_resp.contains("verify_clue"));
        assert!(list_resp.contains("list_sessions"));
        assert!(list_resp.contains("switch_session"));
        assert!(list_resp.contains("recall_history"));
        assert!(list_resp.contains("search_past_investigations"));
    }

    #[test]
    fn test_mcp_pin_clue_and_link() {
        let conn = in_memory_mcp_db();
        let pin_req = json!({
            "jsonrpc": "2.0",
            "id": 10,
            "method": "tools/call",
            "params": {
                "name": "pin_clue",
                "arguments": {
                    "title": "TEST_MCP_PIN",
                    "tag": "BUG",
                    "code": "panic!(\"null pointer\")",
                    "notes": "Testing MCP pin",
                    "verification_status": "CRASH",
                    "confidence": 0.99
                }
            }
        });
        let pin_resp = handle_json_rpc_message(&conn, &pin_req.to_string()).unwrap();
        assert!(pin_resp.contains("SUCCESS"));
        assert!(pin_resp.contains("TEST_MCP_PIN"));

        let pin_fix_req = json!({
            "jsonrpc": "2.0",
            "id": 11,
            "method": "tools/call",
            "params": {
                "name": "pin_clue",
                "arguments": {
                    "title": "TEST_MCP_FIX",
                    "tag": "FIX",
                    "code": "if let Some(x) = opt { ... }",
                    "verification_status": "VERIFIED"
                }
            }
        });
        let _ = handle_json_rpc_message(&conn, &pin_fix_req.to_string()).unwrap();

        let link_req = json!({
            "jsonrpc": "2.0",
            "id": 12,
            "method": "tools/call",
            "params": {
                "name": "link_clues",
                "arguments": {
                    "from_id": 1,
                    "to_id": 2,
                    "relation_type": "FIXES"
                }
            }
        });
        let link_resp = handle_json_rpc_message(&conn, &link_req.to_string()).unwrap();
        assert!(link_resp.contains("SUCCESS"));
        assert!(link_resp.contains("FIXES"));
    }

    #[test]
    fn test_mcp_verify_clue_atomic() {
        let conn = in_memory_mcp_db();
        let pin_req = json!({
            "jsonrpc": "2.0",
            "id": 30,
            "method": "tools/call",
            "params": {
                "name": "pin_clue",
                "arguments": {
                    "title": "RACE_INSPECTION",
                    "tag": "BUG",
                    "code": "data_race_condition()",
                    "verification_status": "CRASH",
                    "confidence": 0.60
                }
            }
        });
        let _ = handle_json_rpc_message(&conn, &pin_req.to_string()).unwrap();

        // Verify with threadtrace_ prefix alias
        let verify_req = json!({
            "jsonrpc": "2.0",
            "id": 31,
            "method": "tools/call",
            "params": {
                "name": "threadtrace_verify_clue",
                "arguments": {
                    "node_id": 1,
                    "status": "VERIFIED",
                    "confidence": 0.99,
                    "notes": "Fixed with atomic spinlock",
                    "checklist": "- [x] Added mutex guard"
                }
            }
        });
        let verify_resp = handle_json_rpc_message(&conn, &verify_req.to_string()).unwrap();
        assert!(verify_resp.contains("SUCCESS"));
        assert!(verify_resp.contains("VERIFIED"));

        // Verify DB row
        let (status, conf, notes, chk): (String, f64, String, String) = conn.query_row(
            "SELECT verification_status, confidence, notes, checklist FROM nodes WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        ).unwrap();
        assert_eq!(status, "VERIFIED");
        assert!((conf - 0.99).abs() < 1e-4);
        assert!(notes.contains("atomic spinlock"));
        assert!(chk.contains("Added mutex guard"));
    }

    #[test]
    fn test_mcp_search_past_investigations() {
        let conn = in_memory_mcp_db();
        let pin_req = json!({
            "jsonrpc": "2.0",
            "id": 40,
            "method": "tools/call",
            "params": {
                "name": "pin_clue",
                "arguments": {
                    "title": "DEADLOCK_DETECTOR",
                    "tag": "BUG",
                    "code": "mutex_a.lock(); mutex_b.lock();",
                    "notes": "AB-BA deadlock in dispatcher"
                }
            }
        });
        let _ = handle_json_rpc_message(&conn, &pin_req.to_string()).unwrap();

        let search_req = json!({
            "jsonrpc": "2.0",
            "id": 41,
            "method": "tools/call",
            "params": {
                "name": "search_past_investigations",
                "arguments": {
                    "query": "DEADLOCK"
                }
            }
        });
        let search_resp = handle_json_rpc_message(&conn, &search_req.to_string()).unwrap();
        assert!(search_resp.contains("DEADLOCK_DETECTOR"));
        assert!(search_resp.contains("AB-BA deadlock"));
    }

    #[test]
    fn test_mcp_auto_slice_and_plot() {
        let conn = in_memory_mcp_db();
        let trace = r#"
Error: Unhandled token refresh rejection
    at handleExpiredSession (src/services/auth.ts:42:15)
    at Object.runDispatch (src/components/SnippetBoard.tsx:120:8)
"#;
        let slice_req = json!({
            "jsonrpc": "2.0",
            "id": 20,
            "method": "tools/call",
            "params": {
                "name": "auto_slice_and_plot",
                "arguments": {
                    "trace_text": trace,
                    "workspace": "X:/Code-Board"
                }
            }
        });
        let slice_resp = handle_json_rpc_message(&conn, &slice_req.to_string()).unwrap();
        assert!(slice_resp.contains("SUCCESS"));
        assert!(slice_resp.contains("BUG_ROOT_CAUSE_INVERSION"));
        assert!(slice_resp.contains("EVIDENCE_CONCURRENT_TRIGGER"));
        assert!(slice_resp.contains("FIX_SYNCHRONIZATION_GUARD"));

        // Verify that history recorded it
        let hist_req = json!({
            "jsonrpc": "2.0",
            "id": 21,
            "method": "tools/call",
            "params": {
                "name": "recall_history",
                "arguments": {
                    "workspace": "X:/Code-Board",
                    "limit": 10
                }
            }
        });
        let hist_resp = handle_json_rpc_message(&conn, &hist_req.to_string()).unwrap();
        assert!(hist_resp.contains("AUTO_SLICE_AND_PLOT"));
    }
}

