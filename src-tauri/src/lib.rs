pub mod models;
pub mod db;
pub mod git_watcher;
pub mod commands;

use std::sync::Mutex;
use rusqlite::Connection;
use tauri::Manager;
use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            let db_path = match app_handle.path().app_data_dir() {
                Ok(mut p) => {
                    let _ = std::fs::create_dir_all(&p);
                    p.push("snippet_board.db");
                    p
                }
                Err(_) => std::path::PathBuf::from("snippet_board.db"),
            };

            let conn = Connection::open(&db_path).expect("Failed to initialize SQLite database");
            db::init_db(&conn).expect("Failed to initialize SQLite database tables");

            app.manage(AppState {
                db: Mutex::new(conn),
                watched_repo: Mutex::new(None),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_board_state,
            commands::save_node_cmd,
            commands::delete_node_cmd,
            commands::add_link_cmd,
            commands::delete_link_cmd,
            commands::delete_link_between_cmd,
            commands::read_file_snippet_cmd,
            commands::watch_repo_cmd,
            commands::get_git_info_cmd,
            commands::export_board_cmd,
            commands::import_board_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
