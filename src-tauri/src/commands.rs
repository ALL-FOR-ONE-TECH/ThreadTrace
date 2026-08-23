use std::sync::Mutex;
use tauri::State;
use rusqlite::Connection;
use crate::models::{BoardData, FileSnippetResponse, RepoWatchInfo, SnippetNode};
use crate::db;
use crate::git_watcher;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub watched_repo: Mutex<Option<String>>,
}

#[tauri::command]
pub fn get_board_state(state: State<'_, AppState>) -> Result<BoardData, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut data = db::get_board_data(&conn).map_err(|e| e.to_string())?;

    let watched = state.watched_repo.lock().map_err(|e| e.to_string())?;
    if let Some(ref path) = *watched {
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
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::upsert_node(&conn, &node).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_node_cmd(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_node(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_link_cmd(state: State<'_, AppState>, from_id: i64, to_id: i64) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::add_link(&conn, from_id, to_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_link_cmd(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_link(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_link_between_cmd(state: State<'_, AppState>, from_id: i64, to_id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_link_between(&conn, from_id, to_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_file_snippet_cmd(file_path: String, line_start: Option<i32>, line_end: Option<i32>) -> FileSnippetResponse {
    git_watcher::read_file_slice(&file_path, line_start, line_end)
}

#[tauri::command]
pub fn watch_repo_cmd(state: State<'_, AppState>, repo_path: String) -> Result<RepoWatchInfo, String> {
    let git_info = git_watcher::get_git_info(&repo_path);
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let _ = db::save_repo_watch(&conn, &repo_path, git_info.last_commit.as_deref().unwrap_or(""));
    }
    {
        let mut watched = state.watched_repo.lock().map_err(|e| e.to_string())?;
        *watched = Some(repo_path);
    }
    Ok(git_info)
}

#[tauri::command]
pub fn get_git_info_cmd(repo_path: String) -> RepoWatchInfo {
    git_watcher::get_git_info(&repo_path)
}

#[tauri::command]
pub fn export_board_cmd(state: State<'_, AppState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let data = db::get_board_data(&conn).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_board_cmd(state: State<'_, AppState>, json_content: String) -> Result<BoardData, String> {
    let data: BoardData = serde_json::from_str(&json_content).map_err(|e| e.to_string())?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM links", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM nodes", []).map_err(|e| e.to_string())?;

    for n in &data.nodes {
        db::upsert_node(&conn, n).map_err(|e| e.to_string())?;
    }
    for l in &data.links {
        db::add_link(&conn, l.from_id, l.to_id).map_err(|e| e.to_string())?;
    }

    db::get_board_data(&conn).map_err(|e| e.to_string())
}
