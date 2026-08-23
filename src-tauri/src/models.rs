use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetNode {
    pub id: Option<i64>,
    pub x: f64,
    pub y: f64,
    pub title: String,
    pub tag: String,
    pub mode: String,
    pub code: Option<String>,
    pub file_path: Option<String>,
    pub line_start: Option<i32>,
    pub line_end: Option<i32>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetLink {
    pub id: Option<i64>,
    pub from_id: i64,
    pub to_id: i64,
    pub created_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoWatchInfo {
    pub path: String,
    pub branch: Option<String>,
    pub last_commit: Option<String>,
    pub diff_summary: Option<String>,
    pub is_watching: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardData {
    pub nodes: Vec<SnippetNode>,
    pub links: Vec<SnippetLink>,
    pub repo_watch: Option<RepoWatchInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSnippetResponse {
    pub content: String,
    pub file_path: String,
    pub line_start: i32,
    pub line_end: i32,
    pub total_lines: usize,
    pub exists: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessTelemetry {
    pub pid: u32,
    pub physical_memory_mb: f64,
    pub virtual_memory_mb: f64,
    pub thread_count: usize,
    pub uptime_seconds: u64,
}

