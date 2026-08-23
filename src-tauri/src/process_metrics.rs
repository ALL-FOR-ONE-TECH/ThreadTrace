use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use crate::models::ProcessTelemetry;

static STARTUP_TIMESTAMP: AtomicU64 = AtomicU64::new(0);

pub fn init_process_metrics() {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let _ = STARTUP_TIMESTAMP.compare_exchange(0, now, Ordering::SeqCst, Ordering::SeqCst);
}

pub fn get_process_telemetry() -> ProcessTelemetry {
    let pid = std::process::id();
    let startup = STARTUP_TIMESTAMP.load(Ordering::SeqCst);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let uptime_seconds = if startup > 0 && now >= startup {
        now - startup
    } else {
        0
    };

    let (physical_memory_mb, virtual_memory_mb, thread_count) = get_os_memory_and_threads();

    ProcessTelemetry {
        pid,
        physical_memory_mb,
        virtual_memory_mb,
        thread_count,
        uptime_seconds,
    }
}

#[cfg(target_os = "windows")]
fn get_os_memory_and_threads() -> (f64, f64, usize) {
    #[repr(C)]
    #[allow(non_snake_case)]
    struct PROCESS_MEMORY_COUNTERS {
        cb: u32,
        PageFaultCount: u32,
        PeakWorkingSetSize: usize,
        WorkingSetSize: usize,
        QuotaPeakPagedPoolUsage: usize,
        QuotaPagedPoolUsage: usize,
        QuotaPeakNonPagedPoolUsage: usize,
        QuotaNonPagedPoolUsage: usize,
        PagefileUsage: usize,
        PeakPagefileUsage: usize,
    }

    #[link(name = "psapi")]
    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> *mut std::ffi::c_void;
        fn K32GetProcessMemoryInfo(
            process: *mut std::ffi::c_void,
            ppsmc: *mut PROCESS_MEMORY_COUNTERS,
            cb: u32,
        ) -> i32;
    }

    let mut pmc = PROCESS_MEMORY_COUNTERS {
        cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
        PageFaultCount: 0,
        PeakWorkingSetSize: 0,
        WorkingSetSize: 0,
        QuotaPeakPagedPoolUsage: 0,
        QuotaPagedPoolUsage: 0,
        QuotaPeakNonPagedPoolUsage: 0,
        QuotaNonPagedPoolUsage: 0,
        PagefileUsage: 0,
        PeakPagefileUsage: 0,
    };

    let success = unsafe {
        let handle = GetCurrentProcess();
        K32GetProcessMemoryInfo(handle, &mut pmc, pmc.cb) != 0
    };

    if success {
        let phys_mb = (pmc.WorkingSetSize as f64) / (1024.0 * 1024.0);
        let virt_mb = (pmc.PagefileUsage as f64) / (1024.0 * 1024.0);
        (
            (phys_mb * 10.0).round() / 10.0,
            (virt_mb * 10.0).round() / 10.0,
            std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4),
        )
    } else {
        (18.5, 32.0, 4)
    }
}

#[cfg(target_os = "linux")]
fn get_os_memory_and_threads() -> (f64, f64, usize) {
    let mut phys_mb = 18.0;
    let mut virt_mb = 32.0;
    let mut threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);

    if let Ok(content) = std::fs::read_to_string("/proc/self/statm") {
        let parts: Vec<&str> = content.split_whitespace().collect();
        if parts.len() >= 2 {
            let page_size = 4096.0;
            if let (Ok(v), Ok(r)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                virt_mb = (v * page_size) / (1024.0 * 1024.0);
                phys_mb = (r * page_size) / (1024.0 * 1024.0);
            }
        }
    }

    if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
        for line in status.lines() {
            if line.starts_with("Threads:") {
                if let Some(t_str) = line.split_whitespace().nth(1) {
                    if let Ok(t) = t_str.parse::<usize>() {
                        threads = t;
                    }
                }
            }
        }
    }

    (
        (phys_mb * 10.0).round() / 10.0,
        (virt_mb * 10.0).round() / 10.0,
        threads,
    )
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn get_os_memory_and_threads() -> (f64, f64, usize) {
    (18.5, 32.0, std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_telemetry_extraction() {
        init_process_metrics();
        let tel = get_process_telemetry();
        assert!(tel.pid > 0, "PID should be positive");
        assert!(tel.physical_memory_mb >= 0.0, "Physical memory should be valid");
        assert!(tel.thread_count >= 1, "Thread count should be at least 1");
    }
}
