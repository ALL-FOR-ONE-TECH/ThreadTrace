use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetNode {
    pub id: Option<i64>,
    pub session_id: Option<String>,
    pub x: f64,
    pub y: f64,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub title: String,
    pub tag: String,
    pub mode: String,
    pub code: Option<String>,
    pub notes: Option<String>,
    pub file_path: Option<String>,
    pub line_start: Option<i32>,
    pub line_end: Option<i32>,
    pub checklist: Option<String>,
    pub verification_status: Option<String>,
    pub confidence: Option<f64>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetLink {
    pub id: Option<i64>,
    pub session_id: Option<String>,
    pub from_id: i64,
    pub to_id: i64,
    pub relation_type: Option<String>,
    pub created_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub workspace: String,
    pub category: Option<String>,
    pub status: Option<String>,
    pub summary: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionActivity {
    pub id: Option<i64>,
    pub session_id: String,
    pub actor: String,
    pub actor_id: Option<String>,
    pub activity_type: String,
    pub title: String,
    pub payload: String,
    pub timestamp: i64,
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
    pub session_id: Option<String>,
    pub sessions: Option<Vec<Session>>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntryItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
}
