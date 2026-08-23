pub mod models;
pub mod db;
pub mod git_watcher;
pub mod commands;
pub mod process_metrics;

use std::sync::Mutex;
use rusqlite::Connection;
use tauri::Manager;
use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    process_metrics::init_process_metrics();

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

            let conn = match Connection::open(&db_path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Warning: Failed to open DB at {:?}: {}. Falling back to in-memory DB.", db_path, e);
                    Connection::open_in_memory().unwrap_or_else(|_| Connection::open("snippet_board.db").unwrap())
                }
            };
            if let Err(e) = db::init_db(&conn) {
                eprintln!("Warning: Failed to initialize DB tables: {}", e);
            }

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
            commands::clear_board_cmd,
            commands::get_process_telemetry_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}


