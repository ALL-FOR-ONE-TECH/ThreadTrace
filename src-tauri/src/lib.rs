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
                    Connection::open_in_memory().unwrap_or_else(|_| {
                        Connection::open("snippet_board_fallback.db").unwrap_or_else(|_| Connection::open(":memory:").expect("FATAL: Failed to initialize SQLite"))
                    })
                }
            };
            if let Err(e) = db::init_db(&conn) {
                eprintln!("Warning: Failed to initialize DB tables: {}", e);
            }

            let args: Vec<String> = std::env::args().collect();
            let launch_dir = if args.len() > 1 && !args[1].starts_with('-') {
                let p = std::path::Path::new(&args[1]);
                if p.exists() {
                    let target_path = if p.is_dir() { p } else { p.parent().unwrap_or(p) };
                    if let Ok(canonical) = std::fs::canonicalize(target_path) {
                        let path_str = canonical.to_string_lossy();
                        let clean_path = path_str.strip_prefix(r"\\?\UNC\").map(|s| format!(r"\\{}", s))
                            .or_else(|| path_str.strip_prefix(r"\\?\").map(|s| s.to_string()))
                            .unwrap_or_else(|| path_str.to_string());
                        Some(clean_path.replace('\\', "/"))
                    } else {
                        Some(args[1].replace('\\', "/"))
                    }
                } else {
                    Some(args[1].replace('\\', "/"))
                }
            } else {
                None
            };


            app.manage(AppState {
                db: Mutex::new(conn),
                watched_repo: Mutex::new(launch_dir),
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
            commands::get_launch_dir_cmd,
            commands::export_board_cmd,
            commands::import_board_cmd,
            commands::clear_board_cmd,
            commands::get_process_telemetry_cmd,
            commands::write_file_snippet_cmd,
            commands::list_repo_files_cmd,
            commands::list_system_drives_cmd,
            commands::read_dir_entries_cmd,
        ])



        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}


