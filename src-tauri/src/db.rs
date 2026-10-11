use rusqlite::{params, Connection, Result};
use std::time::{SystemTime, UNIX_EPOCH};
use crate::models::{BoardData, RepoWatchInfo, Session, SessionActivity, SnippetLink, SnippetNode};

pub fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub fn get_database_path() -> std::path::PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let mut p = std::path::PathBuf::from(appdata);
        p.push("com.allforonetech.threadtrace");
        let _ = std::fs::create_dir_all(&p);
        p.push("snippet_board.db");
        p
    } else {
        std::path::PathBuf::from("snippet_board.db")
    }
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        "#,
    )?;

    // Safe column migrations for existing SQLite databases FIRST before inspecting CHECK constraint
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN workspace TEXT DEFAULT 'GLOBAL';", []);
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN session_id TEXT;", []);
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN width REAL DEFAULT 340.0;", []);
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN height REAL DEFAULT 260.0;", []);
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN notes TEXT;", []);
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN checklist TEXT;", []);
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN verification_status TEXT DEFAULT 'INVESTIGATING';", []);
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN confidence REAL DEFAULT 1.0;", []);

    // Check if table 'nodes' exists and has restrictive CHECK(tag IN (...))
    let has_tag_check: bool = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='nodes'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map(|sql| sql.contains("CHECK(tag IN") || sql.contains("CHECK (tag IN"))
        .unwrap_or(false);

    if has_tag_check {
        // Collect existing columns in 'nodes' to safely copy without missing-column errors
        let mut existing_cols = Vec::new();
        if let Ok(mut stmt) = conn.prepare("PRAGMA table_info(nodes)") {
            if let Ok(rows) = stmt.query_map([], |r| r.get::<_, String>(1)) {
                for col in rows.flatten() {
                    existing_cols.push(col);
                }
            }
        }
        let target_cols = [
            "id", "workspace", "session_id", "x", "y", "width", "height", "title",
            "tag", "mode", "code", "notes", "file_path", "line_start", "line_end",
            "checklist", "verification_status", "confidence", "created_at", "updated_at",
        ];
        let common_cols: Vec<&str> = target_cols
            .iter()
            .copied()
            .filter(|c| existing_cols.iter().any(|ec| ec.eq_ignore_ascii_case(c)))
            .collect();
        let cols_str = common_cols.join(", ");

        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = OFF;
            CREATE TABLE nodes_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace TEXT DEFAULT 'GLOBAL',
                session_id TEXT,
                x REAL NOT NULL,
                y REAL NOT NULL,
                width REAL DEFAULT 340.0,
                height REAL DEFAULT 260.0,
                title TEXT NOT NULL,
                tag TEXT NOT NULL,
                mode TEXT CHECK(mode IN ('read','write')) DEFAULT 'read',
                code TEXT,
                notes TEXT,
                file_path TEXT,
                line_start INTEGER,
                line_end INTEGER,
                checklist TEXT,
                verification_status TEXT DEFAULT 'INVESTIGATING',
                confidence REAL DEFAULT 1.0,
                created_at INTEGER,
                updated_at INTEGER
            );
            "#,
        )?;
        if !cols_str.is_empty() {
            let copy_sql = format!("INSERT INTO nodes_new ({}) SELECT {} FROM nodes;", cols_str, cols_str);
            conn.execute_batch(&copy_sql)?;
        }
        conn.execute_batch(
            r#"
            DROP TABLE nodes;
            ALTER TABLE nodes_new RENAME TO nodes;
            PRAGMA foreign_keys = ON;
            "#,
        )?;
    }

    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace TEXT DEFAULT 'GLOBAL',
            session_id TEXT,
            x REAL NOT NULL,
            y REAL NOT NULL,
            width REAL DEFAULT 340.0,
            height REAL DEFAULT 260.0,
            title TEXT NOT NULL,
            tag TEXT NOT NULL,
            mode TEXT CHECK(mode IN ('read','write')) DEFAULT 'read',
            code TEXT,
            notes TEXT,
            file_path TEXT,
            line_start INTEGER,
            line_end INTEGER,
            checklist TEXT,
            verification_status TEXT DEFAULT 'INVESTIGATING',
            confidence REAL DEFAULT 1.0,
            created_at INTEGER,
            updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace TEXT DEFAULT 'GLOBAL',
            session_id TEXT,
            from_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            to_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            relation_type TEXT DEFAULT 'CAUSES',
            created_at INTEGER,
            UNIQUE(from_id, to_id)
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            workspace TEXT NOT NULL,
            category TEXT DEFAULT 'BUG_INVESTIGATION',
            status TEXT DEFAULT 'IN_PROGRESS',
            summary TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS session_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            actor TEXT NOT NULL,
            actor_id TEXT,
            activity_type TEXT NOT NULL,
            title TEXT NOT NULL,
            payload TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS active_session (
            workspace TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS repo_watch (
            path TEXT PRIMARY KEY,
            last_commit TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_id);
        CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_id);
        CREATE INDEX IF NOT EXISTS idx_nodes_ws ON nodes(workspace);
        CREATE INDEX IF NOT EXISTS idx_nodes_sess ON nodes(session_id);
        CREATE INDEX IF NOT EXISTS idx_links_ws ON links(workspace);
        CREATE INDEX IF NOT EXISTS idx_links_sess ON links(session_id);
        CREATE INDEX IF NOT EXISTS idx_activity_sess ON session_activity(session_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_ws ON sessions(workspace);
        CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
        "#,
    )?;

    let _ = conn.execute("ALTER TABLE links ADD COLUMN workspace TEXT DEFAULT 'GLOBAL';", []);
    let _ = conn.execute("ALTER TABLE links ADD COLUMN session_id TEXT;", []);
    let _ = conn.execute("ALTER TABLE links ADD COLUMN relation_type TEXT DEFAULT 'CAUSES';", []);

    // Ensure at least one default session exists
    let has_sessions: bool = conn
        .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get::<_, i64>(0))
        .map(|c| c > 0)
        .unwrap_or(false);
    if !has_sessions {
        let ts = now_millis();
        let _ = conn.execute(
            r#"
            INSERT OR IGNORE INTO sessions (id, name, workspace, category, status, summary, created_at, updated_at)
            VALUES ('sess_default', 'MAIN_INVESTIGATION', 'GLOBAL', 'BUG_INVESTIGATION', 'IN_PROGRESS', 'Default workspace session', ?1, ?1);
            "#,
            params![ts],
        );
        let _ = conn.execute(
            "INSERT OR IGNORE INTO active_session (workspace, session_id) VALUES ('GLOBAL', 'sess_default');",
            [],
        );
    }

    // Migrate any legacy nodes or links without session_id to default session
    let default_sess_id = get_active_session_id(conn, Some("GLOBAL")).unwrap_or(None).unwrap_or_else(|| "sess_default".to_string());
    let _ = conn.execute(
        "UPDATE nodes SET session_id = ?1 WHERE session_id IS NULL OR session_id = '';",
        params![default_sess_id],
    );
    let _ = conn.execute(
        "UPDATE links SET session_id = ?1 WHERE session_id IS NULL OR session_id = '';",
        params![default_sess_id],
    );

    Ok(())
}

// -----------------------------------------------------------------------------
// SESSIONS & WAL ACTIVITY LOGGING
// -----------------------------------------------------------------------------

pub fn list_sessions(conn: &Connection, workspace: Option<&str>) -> Result<Vec<Session>> {
    let ws = workspace.unwrap_or("GLOBAL");
    let mut stmt = conn.prepare(
        "SELECT id, name, workspace, category, status, summary, created_at, updated_at FROM sessions WHERE workspace = ?1 OR workspace = 'GLOBAL' ORDER BY updated_at DESC"
    )?;

    let rows = stmt.query_map(params![ws], |row| {
        Ok(Session {
            id: row.get(0)?,
            name: row.get(1)?,
            workspace: row.get(2)?,
            category: row.get(3).ok(),
            status: row.get(4).ok(),
            summary: row.get(5).ok(),
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?.collect::<Result<Vec<Session>>>()?;

    Ok(rows)
}

pub fn get_session(conn: &Connection, session_id: &str) -> Result<Option<Session>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, workspace, category, status, summary, created_at, updated_at FROM sessions WHERE id = ?1"
    )?;

    let mut rows = stmt.query_map(params![session_id], |row| {
        Ok(Session {
            id: row.get(0)?,
            name: row.get(1)?,
            workspace: row.get(2)?,
            category: row.get(3).ok(),
            status: row.get(4).ok(),
            summary: row.get(5).ok(),
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;

    if let Some(first) = rows.next() {
        Ok(Some(first?))
    } else {
        Ok(None)
    }
}

pub fn upsert_session(conn: &Connection, session: &Session) -> Result<()> {
    let ts = now_millis();
    conn.execute(
        r#"
        INSERT INTO sessions (id, name, workspace, category, status, summary, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            workspace = excluded.workspace,
            category = excluded.category,
            status = excluded.status,
            summary = excluded.summary,
            updated_at = excluded.updated_at;
        "#,
        params![
            session.id,
            session.name,
            session.workspace,
            session.category.as_deref().unwrap_or("BUG_INVESTIGATION"),
            session.status.as_deref().unwrap_or("IN_PROGRESS"),
            session.summary,
            if session.created_at > 0 { session.created_at } else { ts },
            ts
        ],
    )?;
    Ok(())
}

pub fn get_active_session_id(conn: &Connection, workspace: Option<&str>) -> Result<Option<String>> {
    let ws = workspace.unwrap_or("GLOBAL");
    let active: Option<String> = conn
        .query_row(
            "SELECT session_id FROM active_session WHERE workspace = ?1",
            params![ws],
            |row| row.get(0),
        )
        .ok();
    Ok(active)
}

pub fn set_active_session_id(conn: &Connection, workspace: Option<&str>, session_id: &str) -> Result<()> {
    let ws = workspace.unwrap_or("GLOBAL");
    conn.execute(
        r#"
        INSERT INTO active_session (workspace, session_id)
        VALUES (?1, ?2)
        ON CONFLICT(workspace) DO UPDATE SET session_id = excluded.session_id;
        "#,
        params![ws, session_id],
    )?;
    Ok(())
}

pub fn log_activity(
    conn: &Connection,
    session_id: &str,
    actor: &str,
    actor_id: Option<&str>,
    activity_type: &str,
    title: &str,
    payload: &str,
) -> Result<i64> {
    let ts = now_millis();
    conn.execute(
        r#"
        INSERT INTO session_activity (session_id, actor, actor_id, activity_type, title, payload, timestamp)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);
        "#,
        params![session_id, actor, actor_id, activity_type, title, payload, ts],
    )?;
    // Touch session updated_at
    let _ = conn.execute(
        "UPDATE sessions SET updated_at = ?1 WHERE id = ?2;",
        params![ts, session_id],
    );
    Ok(conn.last_insert_rowid())
}

pub fn get_session_activity(
    conn: &Connection,
    session_id: &str,
    limit: Option<usize>,
) -> Result<Vec<SessionActivity>> {
    let max_rows = limit.unwrap_or(50) as i64;
    let mut stmt = conn.prepare(
        "SELECT id, session_id, actor, actor_id, activity_type, title, payload, timestamp FROM session_activity WHERE session_id = ?1 ORDER BY timestamp ASC LIMIT ?2"
    )?;

    let rows = stmt.query_map(params![session_id, max_rows], |row| {
        Ok(SessionActivity {
            id: Some(row.get(0)?),
            session_id: row.get(1)?,
            actor: row.get(2)?,
            actor_id: row.get(3).ok(),
            activity_type: row.get(4)?,
            title: row.get(5)?,
            payload: row.get(6)?,
            timestamp: row.get(7)?,
        })
    })?.collect::<Result<Vec<SessionActivity>>>()?;

    Ok(rows)
}

pub fn search_past_investigations(conn: &Connection, query: &str) -> Result<Vec<SnippetNode>> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        r#"
        SELECT id, workspace, session_id, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, checklist, verification_status, confidence, created_at, updated_at
        FROM nodes
        WHERE title LIKE ?1 OR code LIKE ?1 OR notes LIKE ?1 OR file_path LIKE ?1 OR tag LIKE ?1
        ORDER BY updated_at DESC LIMIT 20;
        "#
    )?;

    let rows = stmt.query_map(params![pattern], |row| {
        Ok(SnippetNode {
            id: Some(row.get(0)?),
            session_id: row.get(2).ok(),
            x: row.get(3)?,
            y: row.get(4)?,
            width: row.get(5).ok(),
            height: row.get(6).ok(),
            title: row.get(7)?,
            tag: row.get(8)?,
            mode: row.get(9)?,
            code: row.get(10)?,
            notes: row.get(11)?,
            file_path: row.get(12)?,
            line_start: row.get(13)?,
            line_end: row.get(14)?,
            checklist: row.get(15).ok(),
            verification_status: row.get(16).ok(),
            confidence: row.get(17).ok(),
            created_at: Some(row.get(18)?),
            updated_at: Some(row.get(19)?),
        })
    })?.collect::<Result<Vec<SnippetNode>>>()?;

    Ok(rows)
}

// -----------------------------------------------------------------------------
// DEMO SEEDING
// -----------------------------------------------------------------------------

pub fn seed_demo_data(conn: &Connection, workspace: Option<&str>) -> Result<()> {
    let ws = workspace.unwrap_or("GLOBAL");
    let ts = now_millis();

    let sess_jwt = Session {
        id: "sess_jwt_race".to_string(),
        name: "JWT_AUTH_RACE".to_string(),
        workspace: ws.to_string(),
        category: Some("BUG_INVESTIGATION".to_string()),
        status: Some("RESOLVED".to_string()),
        summary: Some("Single in-flight Promise deduplicates all parallel requests safely.".to_string()),
        created_at: ts - 3600000,
        updated_at: ts,
    };
    upsert_session(conn, &sess_jwt)?;

    let sess_wifi = Session {
        id: "sess_kernel_wifi".to_string(),
        name: "KERNEL_WIFI_DMA".to_string(),
        workspace: ws.to_string(),
        category: Some("BUG_INVESTIGATION".to_string()),
        status: Some("IN_PROGRESS".to_string()),
        summary: Some("Teardown use-after-free race in trans_pcie.c ring buffer descriptor release.".to_string()),
        created_at: ts - 1800000,
        updated_at: ts,
    };
    upsert_session(conn, &sess_wifi)?;

    set_active_session_id(conn, Some(ws), "sess_jwt_race")?;

    conn.execute(
        r#"
        INSERT OR IGNORE INTO nodes (id, workspace, session_id, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, checklist, verification_status, confidence, created_at, updated_at)
        VALUES (1, ?1, 'sess_jwt_race', 80.0, 100.0, 360.0, 280.0, 'BUG_RACE_CONDITION_JWT', 'BUG', 'read',
'// CRITICAL: Token refresh race condition under concurrent requests
async function refreshToken() {
  const res = await api.post(''/auth/refresh'');
  localStorage.setItem(''jwt_token'', res.data.token);
  return res.data.token;
}', 'Multiple API calls in parallel trigger 401 unauthenticated storms when refreshing JWT in flight.', NULL, NULL, NULL,
'- [x] Reproduce 401 unauthenticated storm under load
- [ ] Profile memory and pending token requests
- [ ] Verify mutex boundary in unit test suite', 'CRASH', 0.95, ?2, ?2)
        "#,
        params![ws, ts],
    )?;

    conn.execute(
        r#"
        INSERT OR IGNORE INTO nodes (id, workspace, session_id, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, checklist, verification_status, confidence, created_at, updated_at)
        VALUES (2, ?1, 'sess_jwt_race', 520.0, 140.0, 380.0, 300.0, 'FIX_CONCURRENT_MUTEX_QUEUE', 'FIX', 'read',
'// RESOLUTION: Atomic in-flight lock deduplication
let inflightRefresh: Promise<string> | null = null;

export async function getValidToken(): Promise<string> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = api.post(''/auth/refresh'')
    .then(r => r.data.token)
    .finally(() => { inflightRefresh = null; });
  return inflightRefresh;
}', 'Single in-flight Promise deduplicates all parallel requests safely.', NULL, NULL, NULL,
'- [x] Singleton in-flight promise wrap
- [x] Concurrency stress test passes (100 parallel calls)
- [x] Zero unhandled token rejections', 'VERIFIED', 1.0, ?2, ?2)
        "#,
        params![ws, ts],
    )?;

    conn.execute(
        r#"
        INSERT OR IGNORE INTO links (workspace, session_id, from_id, to_id, relation_type, created_at)
        VALUES (?1, 'sess_jwt_race', 1, 2, 'FIXES', ?2)
        "#,
        params![ws, ts],
    )?;

    let _ = log_activity(
        conn,
        "sess_jwt_race",
        "AI_AGENT",
        Some("threadtrace-core"),
        "PIN_CLUE",
        "Pinned Root Cause Bug",
        r#"{"node_id": 1, "title": "BUG_RACE_CONDITION_JWT", "verification_status": "CRASH"}"#,
    );

    let _ = log_activity(
        conn,
        "sess_jwt_race",
        "AI_AGENT",
        Some("threadtrace-core"),
        "VERIFY",
        "Verified Mutex Patch",
        r#"{"node_id": 2, "exit_code": 0, "status": "VERIFIED", "tests_passed": 12}"#,
    );

    Ok(())
}

// -----------------------------------------------------------------------------
// BOARD RETRIEVAL
// -----------------------------------------------------------------------------

pub fn get_board_data(conn: &Connection, workspace: Option<&str>) -> Result<BoardData> {
    let ws = workspace.unwrap_or("GLOBAL");
    let active_session = get_active_session_id(conn, Some(ws))?;
    get_board_data_for_session(conn, Some(ws), active_session.as_deref())
}

pub fn get_board_data_for_session(
    conn: &Connection,
    workspace: Option<&str>,
    session_id: Option<&str>,
) -> Result<BoardData> {
    let ws = workspace.unwrap_or("GLOBAL");
    let all_sessions = list_sessions(conn, Some(ws))?;

    let effective_session_id = session_id
        .map(|s| s.to_string())
        .or_else(|| get_active_session_id(conn, Some(ws)).ok().flatten())
        .or_else(|| all_sessions.first().map(|s| s.id.clone()));

    let (nodes, links) = if let Some(ref sess) = effective_session_id {
        if ws != "GLOBAL" {
            let mut stmt_nodes = conn.prepare(
                r#"
                SELECT id, session_id, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, checklist, verification_status, confidence, created_at, updated_at
                FROM nodes
                WHERE session_id = ?1 AND (workspace = ?2 OR workspace IS NULL)
                ORDER BY id ASC
                "#,
            )?;
            let n_rows = stmt_nodes.query_map(params![sess, ws], |row| {
                Ok(SnippetNode {
                    id: Some(row.get(0)?),
                    session_id: row.get(1).ok(),
                    x: row.get(2)?,
                    y: row.get(3)?,
                    width: row.get(4).ok(),
                    height: row.get(5).ok(),
                    title: row.get(6)?,
                    tag: row.get(7)?,
                    mode: row.get(8)?,
                    code: row.get(9)?,
                    notes: row.get(10)?,
                    file_path: row.get(11)?,
                    line_start: row.get(12)?,
                    line_end: row.get(13)?,
                    checklist: row.get(14).ok(),
                    verification_status: row.get(15).ok(),
                    confidence: row.get(16).ok(),
                    created_at: Some(row.get(17)?),
                    updated_at: Some(row.get(18)?),
                })
            })?.collect::<Result<Vec<SnippetNode>>>()?;

            let mut stmt_links = conn.prepare(
                r#"
                SELECT id, session_id, from_id, to_id, relation_type, created_at
                FROM links
                WHERE session_id = ?1 AND (workspace = ?2 OR workspace IS NULL)
                ORDER BY id ASC
                "#,
            )?;
            let l_rows = stmt_links.query_map(params![sess, ws], |row| {
                Ok(SnippetLink {
                    id: Some(row.get(0)?),
                    session_id: row.get(1).ok(),
                    from_id: row.get(2)?,
                    to_id: row.get(3)?,
                    relation_type: row.get(4).ok(),
                    created_at: Some(row.get(5)?),
                })
            })?.collect::<Result<Vec<SnippetLink>>>()?;

            (n_rows, l_rows)
        } else {
            let mut stmt_nodes = conn.prepare(
                r#"
                SELECT id, session_id, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, checklist, verification_status, confidence, created_at, updated_at
                FROM nodes
                WHERE session_id = ?1
                ORDER BY id ASC
                "#,
            )?;
            let n_rows = stmt_nodes.query_map(params![sess], |row| {
                Ok(SnippetNode {
                    id: Some(row.get(0)?),
                    session_id: row.get(1).ok(),
                    x: row.get(2)?,
                    y: row.get(3)?,
                    width: row.get(4).ok(),
                    height: row.get(5).ok(),
                    title: row.get(6)?,
                    tag: row.get(7)?,
                    mode: row.get(8)?,
                    code: row.get(9)?,
                    notes: row.get(10)?,
                    file_path: row.get(11)?,
                    line_start: row.get(12)?,
                    line_end: row.get(13)?,
                    checklist: row.get(14).ok(),
                    verification_status: row.get(15).ok(),
                    confidence: row.get(16).ok(),
                    created_at: Some(row.get(17)?),
                    updated_at: Some(row.get(18)?),
                })
            })?.collect::<Result<Vec<SnippetNode>>>()?;

            let mut stmt_links = conn.prepare(
                r#"
                SELECT id, session_id, from_id, to_id, relation_type, created_at
                FROM links
                WHERE session_id = ?1
                ORDER BY id ASC
                "#,
            )?;
            let l_rows = stmt_links.query_map(params![sess], |row| {
                Ok(SnippetLink {
                    id: Some(row.get(0)?),
                    session_id: row.get(1).ok(),
                    from_id: row.get(2)?,
                    to_id: row.get(3)?,
                    relation_type: row.get(4).ok(),
                    created_at: Some(row.get(5)?),
                })
            })?.collect::<Result<Vec<SnippetLink>>>()?;

            (n_rows, l_rows)
        }
    } else {
        let mut stmt_nodes = conn.prepare(
            r#"
            SELECT id, session_id, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, checklist, verification_status, confidence, created_at, updated_at
            FROM nodes
            WHERE workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL')
            ORDER BY id ASC
            "#,
        )?;
        let n_rows = stmt_nodes.query_map(params![ws], |row| {
            Ok(SnippetNode {
                id: Some(row.get(0)?),
                session_id: row.get(1).ok(),
                x: row.get(2)?,
                y: row.get(3)?,
                width: row.get(4).ok(),
                height: row.get(5).ok(),
                title: row.get(6)?,
                tag: row.get(7)?,
                mode: row.get(8)?,
                code: row.get(9)?,
                notes: row.get(10)?,
                file_path: row.get(11)?,
                line_start: row.get(12)?,
                line_end: row.get(13)?,
                checklist: row.get(14).ok(),
                verification_status: row.get(15).ok(),
                confidence: row.get(16).ok(),
                created_at: Some(row.get(17)?),
                updated_at: Some(row.get(18)?),
            })
        })?.collect::<Result<Vec<SnippetNode>>>()?;

        let mut stmt_links = conn.prepare(
            r#"
            SELECT id, session_id, from_id, to_id, relation_type, created_at
            FROM links
            WHERE workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL')
            ORDER BY id ASC
            "#,
        )?;
        let l_rows = stmt_links.query_map(params![ws], |row| {
            Ok(SnippetLink {
                id: Some(row.get(0)?),
                session_id: row.get(1).ok(),
                from_id: row.get(2)?,
                to_id: row.get(3)?,
                relation_type: row.get(4).ok(),
                created_at: Some(row.get(5)?),
            })
        })?.collect::<Result<Vec<SnippetLink>>>()?;

        (n_rows, l_rows)
    };

    let repo_watch: Option<RepoWatchInfo> = if ws != "GLOBAL" {
        let last_commit: Option<String> = conn.query_row(
            "SELECT last_commit FROM repo_watch WHERE path = ?1",
            params![ws],
            |row| row.get(0),
        ).ok();

        Some(RepoWatchInfo {
            path: ws.to_string(),
            last_commit,
            branch: None,
            diff_summary: None,
            is_watching: true,
        })
    } else {
        conn.query_row(
            "SELECT path, last_commit FROM repo_watch ORDER BY ROWID DESC LIMIT 1",
            [],
            |row| {
                Ok(RepoWatchInfo {
                    path: row.get(0)?,
                    last_commit: row.get(1)?,
                    branch: None,
                    diff_summary: None,
                    is_watching: false,
                })
            },
        ).ok()
    };

    Ok(BoardData {
        nodes,
        links,
        repo_watch,
        session_id: effective_session_id,
        sessions: Some(all_sessions),
    })
}

// -----------------------------------------------------------------------------
// NODE & LINK MUTATIONS
// -----------------------------------------------------------------------------

pub fn upsert_node(conn: &Connection, node: &SnippetNode, workspace: Option<&str>) -> Result<i64> {
    let ws = workspace.unwrap_or("GLOBAL");
    let active_session = get_active_session_id(conn, Some(ws))?;
    upsert_node_with_session(conn, node, workspace, active_session.as_deref())
}

pub fn upsert_node_with_session(
    conn: &Connection,
    node: &SnippetNode,
    workspace: Option<&str>,
    session_id: Option<&str>,
) -> Result<i64> {
    let ws = workspace.unwrap_or("GLOBAL");
    let ts = now_millis();
    let width = node.width.unwrap_or(340.0);
    let height = node.height.unwrap_or(260.0);
    let verification = node.verification_status.as_deref().unwrap_or("INVESTIGATING");
    let conf = node.confidence.unwrap_or(1.0);
    let target_sess = node.session_id.as_deref().or(session_id);

    if let Some(id) = node.id.filter(|&id| id > 0) {
        conn.execute(
            r#"
            INSERT INTO nodes (id, workspace, session_id, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, checklist, verification_status, confidence, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
            ON CONFLICT(id) DO UPDATE SET
                session_id = COALESCE(nodes.session_id, excluded.session_id),
                x = excluded.x,
                y = excluded.y,
                width = excluded.width,
                height = excluded.height,
                title = excluded.title,
                tag = excluded.tag,
                mode = excluded.mode,
                code = excluded.code,
                notes = excluded.notes,
                file_path = excluded.file_path,
                line_start = excluded.line_start,
                line_end = excluded.line_end,
                checklist = excluded.checklist,
                verification_status = excluded.verification_status,
                confidence = excluded.confidence,
                updated_at = excluded.updated_at;
            "#,
            params![
                id,
                ws,
                target_sess,
                node.x,
                node.y,
                width,
                height,
                node.title,
                node.tag,
                node.mode,
                node.code,
                node.notes,
                node.file_path,
                node.line_start,
                node.line_end,
                node.checklist,
                verification,
                conf,
                node.created_at.unwrap_or(ts),
                ts
            ],
        )?;
        Ok(id)
    } else {
        let active_or_default = target_sess.unwrap_or("sess_default");
        conn.execute(
            r#"
            INSERT INTO nodes (workspace, session_id, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, checklist, verification_status, confidence, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
            "#,
            params![
                ws,
                active_or_default,
                node.x,
                node.y,
                width,
                height,
                node.title,
                node.tag,
                node.mode,
                node.code,
                node.notes,
                node.file_path,
                node.line_start,
                node.line_end,
                node.checklist,
                verification,
                conf,
                ts,
                ts
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }
}

pub fn update_node_verification(
    conn: &Connection,
    node_id: i64,
    status: &str,
    confidence: Option<f64>,
    notes: Option<&str>,
    checklist: Option<&str>,
) -> Result<()> {
    let ts = now_millis();
    if let Some(extra_notes) = notes {
        let current_notes: String = conn.query_row(
            "SELECT notes FROM nodes WHERE id = ?1",
            params![node_id],
            |r| r.get(0),
        ).unwrap_or_default();
        let combined = if current_notes.is_empty() {
            extra_notes.to_string()
        } else {
            format!("{}\n{}", current_notes, extra_notes)
        };
        conn.execute(
            r#"
            UPDATE nodes
            SET verification_status = ?1,
                confidence = COALESCE(?2, confidence),
                notes = ?3,
                checklist = COALESCE(?4, checklist),
                updated_at = ?5
            WHERE id = ?6;
            "#,
            params![status, confidence, combined, checklist, ts, node_id],
        )?;
    } else {
        conn.execute(
            r#"
            UPDATE nodes
            SET verification_status = ?1,
                confidence = COALESCE(?2, confidence),
                checklist = COALESCE(?3, checklist),
                updated_at = ?4
            WHERE id = ?5;
            "#,
            params![status, confidence, checklist, ts, node_id],
        )?;
    }
    Ok(())
}

pub fn delete_node(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM links WHERE from_id = ?1 OR to_id = ?1", params![id])?;
    conn.execute("DELETE FROM nodes WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn add_link(conn: &Connection, from_id: i64, to_id: i64, workspace: Option<&str>) -> Result<i64> {
    add_link_with_relation(conn, from_id, to_id, Some("CAUSES"), workspace, None)
}

pub fn add_link_with_relation(
    conn: &Connection,
    from_id: i64,
    to_id: i64,
    relation_type: Option<&str>,
    workspace: Option<&str>,
    session_id: Option<&str>,
) -> Result<i64> {
    if from_id == to_id {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let ws = workspace.unwrap_or("GLOBAL");
    let ts = now_millis();
    let rel = relation_type.unwrap_or("CAUSES");

    let active_sess = match session_id {
        Some(s) => Some(s.to_string()),
        None => get_active_session_id(conn, Some(ws))?.or_else(|| Some("sess_default".to_string())),
    };

    // Check if link already exists between these two nodes in this session/workspace
    let existing_link: Option<(i64, String)> = conn.query_row(
        "SELECT id, relation_type FROM links WHERE ((from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1)) AND (session_id = ?3 OR session_id IS NULL)",
        params![from_id, to_id, active_sess],
        |row| Ok((row.get(0)?, row.get::<_, Option<String>>(1)?.unwrap_or_default())),
    ).ok();

    if let Some((link_id, existing_rel)) = existing_link {
        if existing_rel != rel {
            let _ = conn.execute(
                "UPDATE links SET relation_type = ?1 WHERE id = ?2",
                params![rel, link_id],
            );
        }
        return Ok(link_id);
    }

    conn.execute(
        r#"
        INSERT INTO links (workspace, session_id, from_id, to_id, relation_type, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        "#,
        params![ws, active_sess, from_id, to_id, rel, ts],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn delete_link(conn: &Connection, from_id: i64, to_id: i64) -> Result<()> {
    conn.execute(
        "DELETE FROM links WHERE (from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1)",
        params![from_id, to_id],
    )?;
    Ok(())
}

pub fn set_repo_watch(conn: &Connection, path: &str, last_commit: Option<&str>) -> Result<()> {
    conn.execute("DELETE FROM repo_watch WHERE path = ?1", params![path])?;
    conn.execute(
        "INSERT INTO repo_watch (path, last_commit) VALUES (?1, ?2)",
        params![path, last_commit],
    )?;
    Ok(())
}

pub fn clear_board(conn: &Connection, workspace: Option<&str>) -> Result<()> {
    let ws = workspace.unwrap_or("GLOBAL");
    let active_session = get_active_session_id(conn, Some(ws))?;
    if let Some(ref sess) = active_session {
        conn.execute("DELETE FROM links WHERE session_id = ?1", params![sess])?;
        conn.execute("DELETE FROM nodes WHERE session_id = ?1", params![sess])?;
    } else {
        conn.execute("DELETE FROM links WHERE workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL')", params![ws])?;
        conn.execute("DELETE FROM nodes WHERE workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL')", params![ws])?;
    }
    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;

    fn in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn
    }

    #[test]
    fn test_init_db_and_demo_seed() {
        let conn = in_memory_db();
        seed_demo_data(&conn, None).unwrap();
        let data = get_board_data(&conn, None).unwrap();
        assert_eq!(data.nodes.len(), 2);
        assert_eq!(data.links.len(), 1);
        assert_eq!(data.nodes[0].title, "BUG_RACE_CONDITION_JWT");
        assert!(data.nodes[0].notes.is_some());
        assert_eq!(data.nodes[0].verification_status.as_deref(), Some("CRASH"));
        assert_eq!(data.nodes[1].verification_status.as_deref(), Some("VERIFIED"));
        assert_eq!(data.links[0].relation_type.as_deref(), Some("FIXES"));
        assert!(data.sessions.is_some());
        assert!(data.sessions.unwrap().len() >= 2);
    }

    #[test]
    fn test_arbitrary_tags_without_check_constraint() {
        let conn = in_memory_db();
        let node_custom = SnippetNode {
            id: None,
            session_id: None,
            x: 50.0,
            y: 60.0,
            width: Some(340.0),
            height: Some(260.0),
            title: "CUSTOM_TAG_NODE".to_string(),
            tag: "ROOT_CAUSE_HARDWARE".to_string(), // Arbitrary tag not in old enum
            mode: "read".to_string(),
            code: Some("irq_poll()".to_string()),
            notes: Some("Hardware DMA ring buffer pointer mismatch".to_string()),
            file_path: Some("drivers/net/trans.c".to_string()),
            line_start: Some(40),
            line_end: Some(55),
            checklist: Some("- [ ] Probe PCI express lanes\n- [x] Check DMA mask".to_string()),
            verification_status: Some("INVESTIGATING".to_string()),
            confidence: Some(0.88),
            created_at: None,
            updated_at: None,
        };

        let id = upsert_node(&conn, &node_custom, None).unwrap();
        assert!(id > 0);

        let data = get_board_data(&conn, None).unwrap();
        assert_eq!(data.nodes.len(), 1);
        assert_eq!(data.nodes[0].tag, "ROOT_CAUSE_HARDWARE");
        assert_eq!(data.nodes[0].verification_status.as_deref(), Some("INVESTIGATING"));
        assert_eq!(data.nodes[0].confidence, Some(0.88));
        assert!(data.nodes[0].checklist.as_ref().unwrap().contains("Probe PCI"));
    }

    #[test]
    fn test_sessions_and_wal_logging() {
        let conn = in_memory_db();
        let s1 = Session {
            id: "sess_deadlock".to_string(),
            name: "DATABASE_DEADLOCK".to_string(),
            workspace: "X:/test-ws".to_string(),
            category: Some("BUG_INVESTIGATION".to_string()),
            status: Some("IN_PROGRESS".to_string()),
            summary: Some("Investigating lock order inversion in tx_pool".to_string()),
            created_at: now_millis(),
            updated_at: now_millis(),
        };
        upsert_session(&conn, &s1).unwrap();
        set_active_session_id(&conn, Some("X:/test-ws"), "sess_deadlock").unwrap();

        let active = get_active_session_id(&conn, Some("X:/test-ws")).unwrap();
        assert_eq!(active.as_deref(), Some("sess_deadlock"));

        let act_id = log_activity(
            &conn,
            "sess_deadlock",
            "AI_AGENT",
            Some("antigravity"),
            "EXEC_CMD",
            "Ran deadlock reproduction script",
            r#"{"exit_code": 1, "output": "DEADLOCK DETECTED"}"#,
        ).unwrap();
        assert!(act_id > 0);

        let history = get_session_activity(&conn, "sess_deadlock", Some(10)).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].activity_type, "EXEC_CMD");
        assert_eq!(history[0].actor, "AI_AGENT");
    }

    #[test]
    fn test_upsert_and_delete_node_cascade() {
        let conn = in_memory_db();
        let n1 = SnippetNode {
            id: None,
            session_id: None,
            x: 10.0,
            y: 20.0,
            width: Some(350.0),
            height: Some(280.0),
            title: "TEST_NODE_1".into(),
            tag: "BUG".into(),
            mode: "read".into(),
            code: Some("console.log(1)".into()),
            notes: Some("sample note".into()),
            file_path: None,
            line_start: None,
            line_end: None,
            checklist: None,
            verification_status: Some("CRASH".into()),
            confidence: Some(1.0),
            created_at: None,
            updated_at: None,
        };
        let id1 = upsert_node(&conn, &n1, None).unwrap();
        let n2 = SnippetNode {
            id: None,
            session_id: None,
            x: 30.0,
            y: 40.0,
            width: Some(350.0),
            height: Some(280.0),
            title: "TEST_NODE_2".into(),
            tag: "FIX".into(),
            mode: "read".into(),
            code: Some("console.log(2)".into()),
            notes: None,
            file_path: None,
            line_start: None,
            line_end: None,
            checklist: None,
            verification_status: Some("VERIFIED".into()),
            confidence: Some(1.0),
            created_at: None,
            updated_at: None,
        };
        let id2 = upsert_node(&conn, &n2, None).unwrap();

        add_link_with_relation(&conn, id1, id2, Some("FIXES"), None, None).unwrap();
        let data = get_board_data(&conn, None).unwrap();
        assert_eq!(data.nodes.len(), 2);
        assert_eq!(data.links.len(), 1);
        assert_eq!(data.links[0].relation_type.as_deref(), Some("FIXES"));

        delete_node(&conn, id1).unwrap();
        let data_after = get_board_data(&conn, None).unwrap();
        assert_eq!(data_after.nodes.len(), 1);
        assert_eq!(data_after.links.len(), 0);
    }

    #[test]
    fn test_link_deduplication_and_self_link_prevention() {
        let conn = in_memory_db();
        let n1 = SnippetNode {
            id: None,
            session_id: None,
            x: 10.0,
            y: 20.0,
            width: None,
            height: None,
            title: "N1".into(),
            tag: "BUG".into(),
            mode: "read".into(),
            code: None,
            notes: None,
            file_path: None,
            line_start: None,
            line_end: None,
            checklist: None,
            verification_status: None,
            confidence: None,
            created_at: None,
            updated_at: None,
        };
        let n2 = SnippetNode {
            id: None,
            session_id: None,
            x: 30.0,
            y: 40.0,
            width: None,
            height: None,
            title: "N2".into(),
            tag: "FIX".into(),
            mode: "read".into(),
            code: None,
            notes: None,
            file_path: None,
            line_start: None,
            line_end: None,
            checklist: None,
            verification_status: None,
            confidence: None,
            created_at: None,
            updated_at: None,
        };
        let id1 = upsert_node(&conn, &n1, None).unwrap();
        let id2 = upsert_node(&conn, &n2, None).unwrap();

        assert!(add_link(&conn, id1, id1, None).is_err());

        let l1 = add_link(&conn, id1, id2, None).unwrap();
        let l2 = add_link(&conn, id2, id1, None).unwrap();
        assert_eq!(l1, l2);

        let data = get_board_data(&conn, None).unwrap();
        assert_eq!(data.links.len(), 1);
    }

    #[test]
    fn test_multi_workspace_isolation() {
        let conn = in_memory_db();
        let n_ws1 = SnippetNode {
            id: None,
            session_id: None,
            x: 10.0,
            y: 10.0,
            width: None,
            height: None,
            title: "CARD_WS1".into(),
            tag: "BUG".into(),
            mode: "read".into(),
            code: None,
            notes: None,
            file_path: None,
            line_start: None,
            line_end: None,
            checklist: None,
            verification_status: None,
            confidence: None,
            created_at: None,
            updated_at: None,
        };
        let n_ws2 = SnippetNode {
            id: None,
            session_id: None,
            x: 20.0,
            y: 20.0,
            width: None,
            height: None,
            title: "CARD_WS2".into(),
            tag: "FIX".into(),
            mode: "read".into(),
            code: None,
            notes: None,
            file_path: None,
            line_start: None,
            line_end: None,
            checklist: None,
            verification_status: None,
            confidence: None,
            created_at: None,
            updated_at: None,
        };

        upsert_node(&conn, &n_ws1, Some("X:/afot-os")).unwrap();
        upsert_node(&conn, &n_ws2, Some("X:/Code-Board")).unwrap();

        let board_ws1 = get_board_data(&conn, Some("X:/afot-os")).unwrap();
        let board_ws2 = get_board_data(&conn, Some("X:/Code-Board")).unwrap();

        assert_eq!(board_ws1.nodes.len(), 1);
        assert_eq!(board_ws1.nodes[0].title, "CARD_WS1");

        assert_eq!(board_ws2.nodes.len(), 1);
        assert_eq!(board_ws2.nodes[0].title, "CARD_WS2");
    }

    #[test]
    fn test_legacy_migration_missing_columns() {
        let conn = Connection::open_in_memory().unwrap();
        // Simulate a legacy v1 database table that had restrictive CHECK constraint
        // and lacked newer columns (notes, workspace, width, height, etc.)
        conn.execute_batch(
            r#"
            CREATE TABLE nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                x REAL NOT NULL,
                y REAL NOT NULL,
                title TEXT NOT NULL,
                tag TEXT CHECK(tag IN ('BUG','TASK','FIX','EVIDENCE')),
                mode TEXT DEFAULT 'read',
                code TEXT,
                file_path TEXT,
                line_start INTEGER,
                line_end INTEGER,
                created_at INTEGER,
                updated_at INTEGER
            );
            INSERT INTO nodes (x, y, title, tag, mode, code)
            VALUES (10.0, 20.0, 'LEGACY_BUG', 'BUG', 'read', 'void old_func() {}');
            "#,
        ).unwrap();

        // Run init_db on the legacy database
        init_db(&conn).unwrap();

        // Verify arbitrary tags can now be inserted into the migrated table
        conn.execute(
            "INSERT INTO nodes (workspace, session_id, x, y, title, tag, mode) VALUES ('GLOBAL', 'sess_default', 30.0, 40.0, 'NEW_CUSTOM', 'HARDWARE_DMA', 'read');",
            [],
        ).unwrap();

        let row_count: i64 = conn.query_row("SELECT COUNT(*) FROM nodes", [], |r| r.get(0)).unwrap();
        assert_eq!(row_count, 2);

        // Verify legacy row preserved its title and code
        let legacy_title: String = conn.query_row("SELECT title FROM nodes WHERE id = 1", [], |r| r.get(0)).unwrap();
        assert_eq!(legacy_title, "LEGACY_BUG");
    }

    #[test]
    fn test_strict_session_isolation_and_no_leakage() {
        let conn = in_memory_db();
        let s_a = Session {
            id: "sess_alpha".to_string(),
            name: "SESSION_ALPHA".to_string(),
            workspace: "GLOBAL".to_string(),
            category: Some("BUG_INVESTIGATION".to_string()),
            status: Some("IN_PROGRESS".to_string()),
            summary: None,
            created_at: now_millis(),
            updated_at: now_millis(),
        };
        upsert_session(&conn, &s_a).unwrap();

        let s_b = Session {
            id: "sess_beta".to_string(),
            name: "SESSION_BETA".to_string(),
            workspace: "GLOBAL".to_string(),
            category: Some("BUG_INVESTIGATION".to_string()),
            status: Some("IN_PROGRESS".to_string()),
            summary: None,
            created_at: now_millis(),
            updated_at: now_millis(),
        };
        upsert_session(&conn, &s_b).unwrap();

        let n_alpha = SnippetNode {
            id: None,
            session_id: Some("sess_alpha".to_string()),
            x: 10.0,
            y: 10.0,
            width: None,
            height: None,
            title: "ALPHA_NODE".into(),
            tag: "BUG".into(),
            mode: "read".into(),
            code: None,
            notes: None,
            file_path: None,
            line_start: None,
            line_end: None,
            checklist: None,
            verification_status: None,
            confidence: None,
            created_at: None,
            updated_at: None,
        };
        upsert_node_with_session(&conn, &n_alpha, None, Some("sess_alpha")).unwrap();

        // Query session Beta: must be completely empty!
        let board_beta = get_board_data_for_session(&conn, None, Some("sess_beta")).unwrap();
        assert_eq!(board_beta.nodes.len(), 0);

        // Query session Alpha: must have exactly 1 node
        let board_alpha = get_board_data_for_session(&conn, None, Some("sess_alpha")).unwrap();
        assert_eq!(board_alpha.nodes.len(), 1);
        assert_eq!(board_alpha.nodes[0].title, "ALPHA_NODE");
        assert_eq!(board_alpha.nodes[0].session_id.as_deref(), Some("sess_alpha"));
    }

    #[test]
    fn test_directed_link_causality_preservation() {
        let conn = in_memory_db();
        // Insert node with high ID (e.g. 5) and low ID (e.g. 2)
        conn.execute("INSERT INTO nodes (id, workspace, session_id, x, y, title, tag) VALUES (2, 'GLOBAL', 'sess_default', 10.0, 10.0, 'TARGET', 'FIX');", []).unwrap();
        conn.execute("INSERT INTO nodes (id, workspace, session_id, x, y, title, tag) VALUES (5, 'GLOBAL', 'sess_default', 20.0, 20.0, 'SOURCE', 'BUG');", []).unwrap();

        // 5 CAUSES 2 (source = 5, target = 2)
        let link_id = add_link_with_relation(&conn, 5, 2, Some("CAUSES"), None, Some("sess_default")).unwrap();
        assert!(link_id > 0);

        // Verify that from_id is preserved as 5 and to_id as 2
        let (from_id, to_id, rel): (i64, i64, String) = conn.query_row(
            "SELECT from_id, to_id, relation_type FROM links WHERE id = ?1",
            params![link_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        ).unwrap();

        assert_eq!(from_id, 5);
        assert_eq!(to_id, 2);
        assert_eq!(rel, "CAUSES");
    }

    #[test]
    fn test_update_node_verification() {
        let conn = in_memory_db();
        conn.execute("INSERT INTO nodes (id, workspace, session_id, x, y, title, tag, verification_status, confidence) VALUES (1, 'GLOBAL', 'sess_test', 10.0, 10.0, 'TEST_V', 'BUG', 'CRASH', 0.5);", []).unwrap();

        update_node_verification(&conn, 1, "VERIFIED", Some(0.99), Some("Confirmed resolved"), Some("- [x] Done")).unwrap();

        let (status, conf, notes, check, sess): (String, f64, String, String, String) = conn.query_row(
            "SELECT verification_status, confidence, notes, checklist, session_id FROM nodes WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        ).unwrap();

        assert_eq!(status, "VERIFIED");
        assert_eq!(conf, 0.99);
        assert_eq!(notes, "Confirmed resolved");
        assert_eq!(check, "- [x] Done");
        assert_eq!(sess, "sess_test"); // Session was NOT corrupted or modified!
    }
}