use std::sync::Mutex;
use tauri::State;
use rusqlite::Connection;
use crate::models::{BoardData, FileSnippetResponse, ProcessTelemetry, RepoWatchInfo, SnippetNode};
use crate::db;
use crate::git_watcher;
use crate::process_metrics;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub watched_repo: Mutex<Option<String>>,
}

#[tauri::command]
pub fn get_board_state(state: State<'_, AppState>) -> Result<BoardData, String> {
    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?.clone();
    let mut data = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db::get_board_data(&conn, watched.as_deref()).map_err(|e| e.to_string())?
    };

    if let Some(ref path) = watched {
        let mut git_info = git_watcher::get_git_info(path);
        git_info.is_watching = true;
        data.repo_watch = Some(git_info);
    } else if let Some(ref r) = data.repo_watch {
        let mut git_info = git_watcher::get_git_info(&r.path);
        git_info.is_watching = false;
        data.repo_watch = Some(git_info);
    }

    Ok(data)
}

#[tauri::command]
pub fn save_node_cmd(state: State<'_, AppState>, node: SnippetNode) -> Result<i64, String> {
    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?.clone();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::upsert_node(&conn, &node, watched.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_node_cmd(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_node(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_link_cmd(state: State<'_, AppState>, from_id: i64, to_id: i64) -> Result<i64, String> {
    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?.clone();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::add_link(&conn, from_id, to_id, watched.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_link_cmd(state: State<'_, AppState>, from_id: i64, to_id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_link(&conn, from_id, to_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_link_between_cmd(state: State<'_, AppState>, from_id: i64, to_id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_link(&conn, from_id, to_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_file_snippet_cmd(file_path: String, line_start: Option<i32>, line_end: Option<i32>) -> FileSnippetResponse {
    git_watcher::read_file_slice(&file_path, line_start, line_end)
}

#[tauri::command]
pub fn write_file_snippet_cmd(file_path: String, line_start: i32, line_end: i32, new_content: String) -> Result<(), String> {
    git_watcher::write_file_slice(&file_path, line_start, line_end, &new_content)
}

#[tauri::command]
pub fn list_repo_files_cmd(repo_path: String) -> Vec<String> {
    git_watcher::list_repo_files(&repo_path)
}

#[tauri::command]
pub fn list_system_drives_cmd() -> Vec<String> {
    git_watcher::list_system_drives()
}

#[tauri::command]
pub fn read_dir_entries_cmd(dir_path: String) -> Vec<crate::models::DirEntryItem> {
    git_watcher::read_dir_entries(&dir_path)
}

#[tauri::command]
pub fn watch_repo_cmd(state: State<'_, AppState>, repo_path: String) -> Result<BoardData, String> {
    let mut git_info = git_watcher::get_git_info(&repo_path);
    git_info.is_watching = true;
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let _ = db::set_repo_watch(&conn, &repo_path, git_info.last_commit.as_deref());
    }

    {
        let mut watched = state.watched_repo.lock().map_err(|e| e.to_string())?;
        *watched = Some(repo_path.clone());
    }

    let mut data = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db::get_board_data(&conn, Some(&repo_path)).map_err(|e| e.to_string())?
    };
    data.repo_watch = Some(git_info);
    Ok(data)
}

#[tauri::command]
pub fn get_git_info_cmd(repo_path: String) -> RepoWatchInfo {
    git_watcher::get_git_info(&repo_path)
}

#[tauri::command]
pub fn get_launch_dir_cmd(state: State<'_, AppState>) -> Option<String> {
    let watched = state.watched_repo.lock().ok()?;
    watched.clone()
}

#[tauri::command]
pub fn export_board_cmd(state: State<'_, AppState>) -> Result<String, String> {
    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?.clone();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let data = db::get_board_data(&conn, watched.as_deref()).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_board_cmd(state: State<'_, AppState>, json_content: String) -> Result<BoardData, String> {
    let data: BoardData = serde_json::from_str(&json_content).map_err(|e| e.to_string())?;
    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?.clone();
    let ws = watched.as_deref().unwrap_or("GLOBAL");
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM links WHERE workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL')", rusqlite::params![ws]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM nodes WHERE workspace = ?1 OR (workspace IS NULL AND ?1 = 'GLOBAL')", rusqlite::params![ws]).map_err(|e| e.to_string())?;

    for n in &data.nodes {
        db::upsert_node(&tx, n, Some(ws)).map_err(|e| e.to_string())?;
    }
    for l in &data.links {
        db::add_link(&tx, l.from_id, l.to_id, Some(ws)).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;

    db::get_board_data(&conn, Some(ws)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_board_cmd(state: State<'_, AppState>) -> Result<(), String> {
    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?.clone();
    let ws = watched.as_deref().unwrap_or("GLOBAL");
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::clear_board(&conn, Some(ws)).map_err(|e| e.to_string())?;
    if ws != "GLOBAL" {
        let _ = conn.execute("DELETE FROM repo_watch WHERE path = ?1", rusqlite::params![ws]);
    }
    Ok(())
}


#[tauri::command]
pub fn get_process_telemetry_cmd() -> ProcessTelemetry {
    process_metrics::get_process_telemetry()
}

#[tauri::command]
pub fn add_link_with_relation_cmd(
    state: State<'_, AppState>,
    from_id: i64,
    to_id: i64,
    relation_type: Option<String>,
) -> Result<i64, String> {
    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?.clone();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::add_link_with_relation(
        &conn,
        from_id,
        to_id,
        relation_type.as_deref(),
        watched.as_deref(),
        None,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_sessions_cmd(state: State<'_, AppState>) -> Result<Vec<crate::models::Session>, String> {
    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?.clone();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::list_sessions(&conn, watched.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn switch_session_cmd(state: State<'_, AppState>, session_id: String) -> Result<BoardData, String> {
    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?.clone();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::set_active_session_id(&conn, watched.as_deref(), &session_id).map_err(|e| e.to_string())?;
    let _ = db::log_activity(
        &conn,
        &session_id,
        "HUMAN",
        None,
        "SWITCH_SESSION",
        "Switched active session",
        &format!(r#"{{"session_id": "{}"}}"#, session_id),
    );
    let mut data = db::get_board_data_for_session(&conn, watched.as_deref(), Some(&session_id))
        .map_err(|e| e.to_string())?;
    if let Some(ref path) = watched {
        let mut git_info = git_watcher::get_git_info(path);
        git_info.is_watching = true;
        data.repo_watch = Some(git_info);
    }
    Ok(data)
}

#[tauri::command]
pub fn create_session_cmd(
    state: State<'_, AppState>,
    name: String,
    category: Option<String>,
) -> Result<crate::models::Session, String> {
    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?.clone();
    let ws = watched.as_deref().unwrap_or("GLOBAL");
    let ts = db::now_millis();
    let clean_id = format!(
        "sess_{}_{}",
        name.to_lowercase().replace(' ', "_").chars().filter(|c| c.is_alphanumeric() || *c == '_').collect::<String>(),
        ts % 10000
    );
    let session = crate::models::Session {
        id: clean_id.clone(),
        name: name.clone(),
        workspace: ws.to_string(),
        category: category.or_else(|| Some("BUG_INVESTIGATION".to_string())),
        status: Some("IN_PROGRESS".to_string()),
        summary: None,
        created_at: ts,
        updated_at: ts,
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::upsert_session(&conn, &session).map_err(|e| e.to_string())?;
    db::set_active_session_id(&conn, Some(ws), &clean_id).map_err(|e| e.to_string())?;
    let _ = db::log_activity(
        &conn,
        &clean_id,
        "HUMAN",
        None,
        "CREATE_SESSION",
        &format!("Created session {}", name),
        &format!(r#"{{"name": "{}"}}"#, name),
    );
    Ok(session)
}

#[tauri::command]
pub fn get_session_activity_cmd(
    state: State<'_, AppState>,
    session_id: String,
    limit: Option<usize>,
) -> Result<Vec<crate::models::SessionActivity>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_session_activity(&conn, &session_id, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_past_investigations_cmd(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<SnippetNode>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::search_past_investigations(&conn, &query).map_err(|e| e.to_string())
}


