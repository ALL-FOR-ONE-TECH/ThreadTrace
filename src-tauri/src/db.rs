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

        CREATE TABLE IF NOT EXISTS nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            x REAL NOT NULL,
            y REAL NOT NULL,
            title TEXT NOT NULL,
            tag TEXT CHECK(tag IN ('BUG','TASK','FIX','EVIDENCE')) NOT NULL,
            mode TEXT CHECK(mode IN ('read','write')) DEFAULT 'read',
            code TEXT,
            file_path TEXT,
            line_start INTEGER,
            line_end INTEGER,
            created_at INTEGER,
            updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            to_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            created_at INTEGER,
            UNIQUE(from_id, to_id)
        );

        CREATE TABLE IF NOT EXISTS repo_watch (
            path TEXT PRIMARY KEY,
            last_commit TEXT
        );
        "#,
    )?;

    // Check if empty and seed initial demo nodes
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM nodes", [], |row| row.get(0))?;
    if count == 0 {
        let ts = now_millis();
        conn.execute(
            r#"
            INSERT INTO nodes (id, x, y, title, tag, mode, code, file_path, line_start, line_end, created_at, updated_at)
            VALUES (1, 80.0, 100.0, 'BUG_RACE_CONDITION_JWT', 'BUG', 'read',
'// CRITICAL: Token refresh race condition under concurrent requests
async function refreshToken() {
  const res = await api.post(''/auth/refresh'');
  localStorage.setItem(''jwt_token'', res.data.token);
  return res.data.token;
}', NULL, NULL, NULL, ?1, ?1)
            "#,
            params![ts],
        )?;

        conn.execute(
            r#"
            INSERT INTO nodes (id, x, y, title, tag, mode, code, file_path, line_start, line_end, created_at, updated_at)
            VALUES (2, 480.0, 180.0, 'FIX_CONCURRENT_MUTEX_QUEUE', 'FIX', 'read',
'// RESOLUTION: Atomic in-flight lock deduplication
let inflightRefresh: Promise<string> | null = null;

export async function getValidToken(): Promise<string> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = api.post(''/auth/refresh'')
    .then(r => r.data.token)
    .finally(() => { inflightRefresh = null; });
  return inflightRefresh;
}', NULL, NULL, NULL, ?1, ?1)
            "#,
            params![ts],
        )?;

        conn.execute(
            "INSERT INTO links (from_id, to_id, created_at) VALUES (1, 2, ?1)",
            params![ts],
        )?;
    }

    Ok(())
}

pub fn get_board_data(conn: &Connection) -> Result<BoardData> {
    let mut stmt_nodes = conn.prepare(
        "SELECT id, x, y, title, tag, mode, code, file_path, line_start, line_end, created_at, updated_at FROM nodes ORDER BY id ASC"
    )?;

    let nodes = stmt_nodes.query_map([], |row| {
        Ok(SnippetNode {
            id: Some(row.get(0)?),
            x: row.get(1)?,
            y: row.get(2)?,
            title: row.get(3)?,
            tag: row.get(4)?,
            mode: row.get(5)?,
            code: row.get(6)?,
            file_path: row.get(7)?,
            line_start: row.get(8)?,
            line_end: row.get(9)?,
            created_at: Some(row.get(10)?),
            updated_at: Some(row.get(11)?),
        })
    })?.collect::<Result<Vec<SnippetNode>>>()?;

    let mut stmt_links = conn.prepare("SELECT id, from_id, to_id, created_at FROM links ORDER BY id ASC")?;
    let links = stmt_links.query_map([], |row| {
        Ok(SnippetLink {
            id: Some(row.get(0)?),
            from_id: row.get(1)?,
            to_id: row.get(2)?,
            created_at: Some(row.get(3)?),
        })
    })?.collect::<Result<Vec<SnippetLink>>>()?;

    let repo_watch: Option<RepoWatchInfo> = conn.query_row(
        "SELECT path, last_commit FROM repo_watch LIMIT 1",
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
    ).ok();

    Ok(BoardData {
        nodes,
        links,
        repo_watch,
    })
}

pub fn upsert_node(conn: &Connection, node: &SnippetNode) -> Result<i64> {
    let ts = now_millis();
    if let Some(id) = node.id {
        conn.execute(
            r#"
            INSERT INTO nodes (id, x, y, title, tag, mode, code, file_path, line_start, line_end, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ON CONFLICT(id) DO UPDATE SET
                x = excluded.x,
                y = excluded.y,
                title = excluded.title,
                tag = excluded.tag,
                mode = excluded.mode,
                code = excluded.code,
                file_path = excluded.file_path,
                line_start = excluded.line_start,
                line_end = excluded.line_end,
                updated_at = excluded.updated_at;
            "#,
            params![
                id,
                node.x,
                node.y,
                node.title,
                node.tag,
                node.mode,
                node.code,
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
            INSERT INTO nodes (x, y, title, tag, mode, code, file_path, line_start, line_end, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                node.x,
                node.y,
                node.title,
                node.tag,
                node.mode,
                node.code,
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

pub fn add_link(conn: &Connection, from_id: i64, to_id: i64) -> Result<i64> {
    if from_id == to_id {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let ts = now_millis();
    let (min_id, max_id) = if from_id < to_id { (from_id, to_id) } else { (to_id, from_id) };

    conn.execute(
        r#"
        INSERT OR IGNORE INTO links (from_id, to_id, created_at)
        VALUES (?1, ?2, ?3)
        "#,
        params![min_id, max_id, ts],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn delete_link(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM links WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn delete_link_between(conn: &Connection, from_id: i64, to_id: i64) -> Result<()> {
    let (min_id, max_id) = if from_id < to_id { (from_id, to_id) } else { (to_id, from_id) };
    conn.execute(
        "DELETE FROM links WHERE from_id = ?1 AND to_id = ?2",
        params![min_id, max_id],
    )?;
    Ok(())
}

pub fn save_repo_watch(conn: &Connection, path: &str, last_commit: &str) -> Result<()> {
    conn.execute(
        r#"
        INSERT INTO repo_watch (path, last_commit)
        VALUES (?1, ?2)
        ON CONFLICT(path) DO UPDATE SET last_commit = excluded.last_commit;
        "#,
        params![path, last_commit],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_db_and_demo_seed() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let data = get_board_data(&conn).unwrap();
        assert_eq!(data.nodes.len(), 2, "Should pre-seed 2 demo nodes");
        assert_eq!(data.links.len(), 1, "Should pre-seed 1 demo link");
        assert_eq!(data.nodes[0].title, "BUG_RACE_CONDITION_JWT");
        assert_eq!(data.nodes[1].title, "FIX_CONCURRENT_MUTEX_QUEUE");
        assert_eq!(data.links[0].from_id, 1);
        assert_eq!(data.links[0].to_id, 2);
    }

    #[test]
    fn test_upsert_and_delete_node_cascade() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let node = SnippetNode {
            id: None,
            x: 200.0,
            y: 300.0,
            title: "TASK_NEW_FEATURE".to_string(),
            tag: "TASK".to_string(),
            mode: "read".to_string(),
            code: Some("// task body".to_string()),
            file_path: Some("src/feature.rs".to_string()),
            line_start: Some(10),
            line_end: Some(25),
            created_at: None,
            updated_at: None,
        };

        let new_id = upsert_node(&conn, &node).unwrap();
        assert!(new_id >= 3);

        let link_id = add_link(&conn, 1, new_id).unwrap();
        assert!(link_id > 0);

        let data = get_board_data(&conn).unwrap();
        assert_eq!(data.nodes.len(), 3);
        assert_eq!(data.links.len(), 2);

        delete_node(&conn, new_id).unwrap();

        let data_after = get_board_data(&conn).unwrap();
        assert_eq!(data_after.nodes.len(), 2);
        assert_eq!(data_after.links.len(), 1, "Cascading delete should remove the link to deleted node");
    }

    #[test]
    fn test_link_deduplication_and_self_link_prevention() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let self_link_res = add_link(&conn, 1, 1);
        assert!(self_link_res.is_err());

        let _ = add_link(&conn, 2, 1);
        let data = get_board_data(&conn).unwrap();
        assert_eq!(data.links.len(), 1, "Should not create duplicate reverse link");
    }
}