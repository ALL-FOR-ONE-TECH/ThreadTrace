use rusqlite::{params, Connection, Result};
use std::time::{SystemTime, UNIX_EPOCH};
use crate::models::{BoardData, RepoWatchInfo, SnippetLink, SnippetNode};

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;

        CREATE TABLE IF NOT EXISTS nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace TEXT DEFAULT 'GLOBAL',
            x REAL NOT NULL,
            y REAL NOT NULL,
            width REAL DEFAULT 340.0,
            height REAL DEFAULT 260.0,
            title TEXT NOT NULL,
            tag TEXT CHECK(tag IN ('BUG','TASK','FIX','EVIDENCE')) NOT NULL,
            mode TEXT CHECK(mode IN ('read','write')) DEFAULT 'read',
            code TEXT,
            notes TEXT,
            file_path TEXT,
            line_start INTEGER,
            line_end INTEGER,
            created_at INTEGER,
            updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace TEXT DEFAULT 'GLOBAL',
            from_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            to_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            created_at INTEGER,
            UNIQUE(from_id, to_id)
        );

        CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_id);
        CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_id);
        CREATE INDEX IF NOT EXISTS idx_nodes_ws ON nodes(workspace);
        CREATE INDEX IF NOT EXISTS idx_links_ws ON links(workspace);

        CREATE TABLE IF NOT EXISTS repo_watch (
            path TEXT PRIMARY KEY,
            last_commit TEXT
        );
        "#,
    )?;

    // Safe column migrations for existing SQLite databases
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN workspace TEXT DEFAULT 'GLOBAL';", []);
    let _ = conn.execute("ALTER TABLE links ADD COLUMN workspace TEXT DEFAULT 'GLOBAL';", []);
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN width REAL DEFAULT 340.0;", []);
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN height REAL DEFAULT 260.0;", []);
    let _ = conn.execute("ALTER TABLE nodes ADD COLUMN notes TEXT;", []);

    Ok(())
}


pub fn seed_demo_data(conn: &Connection, workspace: Option<&str>) -> Result<()> {
    let ws = workspace.unwrap_or("GLOBAL");
    let ts = now_millis();
    conn.execute(
        r#"
        INSERT OR IGNORE INTO nodes (id, workspace, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, created_at, updated_at)
        VALUES (1, ?1, 80.0, 100.0, 360.0, 280.0, 'BUG_RACE_CONDITION_JWT', 'BUG', 'read',
'// CRITICAL: Token refresh race condition under concurrent requests
async function refreshToken() {
  const res = await api.post(''/auth/refresh'');
  localStorage.setItem(''jwt_token'', res.data.token);
  return res.data.token;
}', 'Multiple API calls in parallel trigger 401 unauthenticated storms when refreshing JWT in flight.', NULL, NULL, NULL, ?2, ?2)
        "#,
        params![ws, ts],
    )?;

    conn.execute(
        r#"
        INSERT OR IGNORE INTO nodes (id, workspace, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, created_at, updated_at)
        VALUES (2, ?1, 520.0, 140.0, 380.0, 300.0, 'FIX_CONCURRENT_MUTEX_QUEUE', 'FIX', 'read',
'// RESOLUTION: Atomic in-flight lock deduplication
let inflightRefresh: Promise<string> | null = null;

export async function getValidToken(): Promise<string> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = api.post(''/auth/refresh'')
    .then(r => r.data.token)
    .finally(() => { inflightRefresh = null; });
  return inflightRefresh;
}', 'Single in-flight Promise deduplicates all parallel requests safely.', NULL, NULL, NULL, ?2, ?2)
        "#,
        params![ws, ts],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO links (workspace, from_id, to_id, created_at) VALUES (?1, 1, 2, ?2)",
        params![ws, ts],
    )?;

    Ok(())
}

pub fn get_board_data(conn: &Connection, workspace: Option<&str>) -> Result<BoardData> {
    let ws = workspace.unwrap_or("GLOBAL");
    let mut stmt_nodes = conn.prepare(
        "SELECT id, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, created_at, updated_at FROM nodes WHERE workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL') ORDER BY id ASC"
    )?;

    let nodes = stmt_nodes.query_map(params![ws], |row| {
        Ok(SnippetNode {
            id: Some(row.get(0)?),
            x: row.get(1)?,
            y: row.get(2)?,
            width: row.get(3).ok(),
            height: row.get(4).ok(),
            title: row.get(5)?,
            tag: row.get(6)?,
            mode: row.get(7)?,
            code: row.get(8)?,
            notes: row.get(9)?,
            file_path: row.get(10)?,
            line_start: row.get(11)?,
            line_end: row.get(12)?,
            created_at: Some(row.get(13)?),
            updated_at: Some(row.get(14)?),
        })
    })?.collect::<Result<Vec<SnippetNode>>>()?;

    let mut stmt_links = conn.prepare(
        "SELECT id, from_id, to_id, created_at FROM links WHERE workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL') ORDER BY id ASC"
    )?;
    let links = stmt_links.query_map(params![ws], |row| {
        Ok(SnippetLink {
            id: Some(row.get(0)?),
            from_id: row.get(1)?,
            to_id: row.get(2)?,
            created_at: Some(row.get(3)?),
        })
    })?.collect::<Result<Vec<SnippetLink>>>()?;

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
    })
}

pub fn upsert_node(conn: &Connection, node: &SnippetNode, workspace: Option<&str>) -> Result<i64> {
    let ws = workspace.unwrap_or("GLOBAL");
    let ts = now_millis();
    let width = node.width.unwrap_or(340.0);
    let height = node.height.unwrap_or(260.0);

    if let Some(id) = node.id.filter(|&id| id > 0) {
        conn.execute(
            r#"
            INSERT INTO nodes (id, workspace, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
            ON CONFLICT(id) DO UPDATE SET
                workspace = excluded.workspace,
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
                updated_at = excluded.updated_at;
            "#,
            params![
                id,
                ws,
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
                node.created_at.unwrap_or(ts),
                ts
            ],
        )?;
        Ok(id)
    } else {
        conn.execute(
            r#"
            INSERT INTO nodes (workspace, x, y, width, height, title, tag, mode, code, notes, file_path, line_start, line_end, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            "#,
            params![
                ws,
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
                ts,
                ts
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }
}

pub fn delete_node(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM links WHERE from_id = ?1 OR to_id = ?1", params![id])?;
    conn.execute("DELETE FROM nodes WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn add_link(conn: &Connection, from_id: i64, to_id: i64, workspace: Option<&str>) -> Result<i64> {
    if from_id == to_id {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let ws = workspace.unwrap_or("GLOBAL");
    let ts = now_millis();
    let (min_id, max_id) = if from_id < to_id { (from_id, to_id) } else { (to_id, from_id) };

    conn.execute(
        r#"
        INSERT OR IGNORE INTO links (workspace, from_id, to_id, created_at)
        VALUES (?1, ?2, ?3, ?4)
        "#,
        params![ws, min_id, max_id, ts],
    )?;

    let link_id: i64 = conn.query_row(
        "SELECT id FROM links WHERE (workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL')) AND from_id = ?2 AND to_id = ?3",
        params![ws, min_id, max_id],
        |row| row.get(0),
    )?;

    Ok(link_id)
}

pub fn delete_link(conn: &Connection, from_id: i64, to_id: i64) -> Result<()> {
    let (min_id, max_id) = if from_id < to_id { (from_id, to_id) } else { (to_id, from_id) };
    conn.execute(
        "DELETE FROM links WHERE from_id = ?1 AND to_id = ?2",
        params![min_id, max_id],
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
    conn.execute("DELETE FROM links WHERE workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL')", params![ws])?;
    conn.execute("DELETE FROM nodes WHERE workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL')", params![ws])?;
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
    }

    #[test]
    fn test_upsert_and_delete_node_cascade() {
        let conn = in_memory_db();
        let n1 = SnippetNode {
            id: None,
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
            created_at: None,
            updated_at: None,
        };
        let id1 = upsert_node(&conn, &n1, None).unwrap();
        let n2 = SnippetNode {
            id: None,
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
            created_at: None,
            updated_at: None,
        };
        let id2 = upsert_node(&conn, &n2, None).unwrap();

        add_link(&conn, id1, id2, None).unwrap();
        let data = get_board_data(&conn, None).unwrap();
        assert_eq!(data.nodes.len(), 2);
        assert_eq!(data.links.len(), 1);

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
            created_at: None,
            updated_at: None,
        };
        let n2 = SnippetNode {
            id: None,
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
            created_at: None,
            updated_at: None,
        };
        let n_ws2 = SnippetNode {
            id: None,
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
}