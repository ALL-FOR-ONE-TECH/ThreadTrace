#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|arg| arg == "mcp" || arg == "--mcp") {
        #[cfg(windows)]
        unsafe {
            extern "system" {
                fn AttachConsole(dwProcessId: u32) -> i32;
            }
            // ATTACH_PARENT_PROCESS = (DWORD)-1
            AttachConsole(0xFFFFFFFF);
        }
        thread_trace_lib::mcp_server::run_stdio_server();
    } else {
        thread_trace_lib::run();
    }
}
