use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Command;
use crate::models::{FileSnippetResponse, RepoWatchInfo};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn get_git_info(repo_path: &str) -> RepoWatchInfo {
    let p = Path::new(repo_path);
    if !p.exists() || (!p.join(".git").exists() && !p.join("../.git").exists()) {
        return RepoWatchInfo {
            path: repo_path.to_string(),
            branch: None,
            last_commit: None,
            diff_summary: None,
            is_watching: false,
        };
    }


    let mut cmd_commit = Command::new("git");
    cmd_commit.args(["log", "-1", "--pretty=format:%h: %s (%cr)"]).current_dir(p);
    #[cfg(target_os = "windows")]
    cmd_commit.creation_flags(CREATE_NO_WINDOW);

    let last_commit = cmd_commit.output().ok().and_then(|out| {
        if out.status.success() {
            String::from_utf8(out.stdout).ok().map(|s| s.trim().to_string())
        } else {
            None
        }
    });

    let mut cmd_branch = Command::new("git");
    cmd_branch.args(["branch", "--show-current"]).current_dir(p);
    #[cfg(target_os = "windows")]
    cmd_branch.creation_flags(CREATE_NO_WINDOW);

    let branch = cmd_branch.output().ok().and_then(|out| {
        if out.status.success() {
            let b = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if b.is_empty() { None } else { Some(b) }
        } else {
            None
        }
    });

    let mut cmd_diff = Command::new("git");
    cmd_diff.args(["diff", "--stat"]).current_dir(p);
    #[cfg(target_os = "windows")]
    cmd_diff.creation_flags(CREATE_NO_WINDOW);

    let diff_summary = cmd_diff.output().ok().and_then(|out| {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        } else {
            None
        }
    });

    RepoWatchInfo {
        path: repo_path.to_string(),
        branch,
        last_commit,
        diff_summary,
        is_watching: true,
    }
}

pub fn read_file_slice(file_path: &str, line_start: Option<i32>, line_end: Option<i32>) -> FileSnippetResponse {
    let path = Path::new(file_path);
    if !path.exists() || !path.is_file() {
        return FileSnippetResponse {
            content: String::new(),
            file_path: file_path.to_string(),
            line_start: line_start.unwrap_or(1),
            line_end: line_end.unwrap_or(1),
            total_lines: 0,
            exists: false,
            error: Some(format!("File not found: {}", file_path)),
        };
    }

    let file = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            return FileSnippetResponse {
                content: String::new(),
                file_path: file_path.to_string(),
                line_start: line_start.unwrap_or(1),
                line_end: line_end.unwrap_or(1),
                total_lines: 0,
                exists: true,
                error: Some(format!("Failed to open file: {}", e)),
            };
        }
    };

    let reader = BufReader::new(file);
    let all_lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();
    let total_lines = all_lines.len();

    let start = line_start.unwrap_or(1).max(1) as usize;
    let end = line_end.unwrap_or(total_lines as i32).max(start as i32) as usize;

    let slice_start = (start - 1).min(total_lines);
    let slice_end = end.min(total_lines);

    let selected_lines = if slice_start < total_lines {
        all_lines[slice_start..slice_end].join("\n")
    } else {
        String::new()
    };

    FileSnippetResponse {
        content: selected_lines,
        file_path: file_path.to_string(),
        line_start: start as i32,
        line_end: slice_end as i32,
        total_lines,
        exists: true,
        error: None,
    }
}

pub fn write_file_slice(file_path: &str, line_start: i32, line_end: i32, new_content: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    if !path.exists() || !path.is_file() {
        return Err(format!("File not found: {}", file_path));
    }

    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);
    let all_lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();
    let total_lines = all_lines.len();

    let start = (line_start.max(1) as usize).saturating_sub(1);
    let end = (line_end.max(1) as usize).min(total_lines);

    let replacement_lines: Vec<String> = new_content.lines().map(|s| s.to_string()).collect();

    let mut result_lines = Vec::new();
    result_lines.extend_from_slice(&all_lines[..start.min(total_lines)]);
    result_lines.extend(replacement_lines);
    if end < total_lines {
        result_lines.extend_from_slice(&all_lines[end..]);
    }

    let updated_text = result_lines.join("\n");
    std::fs::write(path, updated_text).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

pub fn list_repo_files(repo_path: &str) -> Vec<String> {
    let mut files = Vec::new();
    let p = Path::new(repo_path);
    if !p.exists() || !p.is_dir() {
        return files;
    }

    fn walk_dir(dir: &Path, base: &Path, files: &mut Vec<String>, depth: usize) {
        if depth > 5 || files.len() >= 200 {
            return;
        }
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" || file_name == "dist" {
                    continue;
                }
                if path.is_dir() {
                    walk_dir(&path, base, files, depth + 1);
                } else if path.is_file() {
                    if let Ok(rel) = path.strip_prefix(base) {
                        files.push(rel.to_string_lossy().replace('\\', "/"));
                    }
                }
            }
        }
    }

    walk_dir(p, p, &mut files, 0);
    files.sort();
    files
}

pub fn list_system_drives() -> Vec<String> {

    let mut drives = Vec::new();
    #[cfg(target_os = "windows")]
    {
        for b in b'A'..=b'Z' {
            let letter = b as char;
            let root = format!("{}:\\", letter);
            if Path::new(&root).exists() {
                drives.push(root);
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        drives.push("/".to_string());
    }
    if drives.is_empty() {
        drives.push(".".to_string());
    }
    drives
}

pub fn read_dir_entries(dir_path: &str) -> Vec<crate::models::DirEntryItem> {
    let mut items = Vec::new();
    let p = Path::new(dir_path);
    if !p.exists() || !p.is_dir() {
        return items;
    }

    if let Ok(entries) = std::fs::read_dir(p) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
                continue;
            }
            let is_dir = path.is_dir();
            let size_bytes = if is_dir { 0 } else { entry.metadata().map(|m| m.len()).unwrap_or(0) };
            items.push(crate::models::DirEntryItem {
                name,
                path: path.to_string_lossy().replace('\\', "/"),
                is_dir,
                size_bytes,
            });
        }
    }

    items.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    items
}

#[cfg(test)]


mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_read_file_slice_valid_and_bounds() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_codeboard_snippet.txt");
        {
            let mut f = File::create(&test_file).unwrap();
            writeln!(f, "line 1").unwrap();
            writeln!(f, "line 2").unwrap();
            writeln!(f, "line 3").unwrap();
            writeln!(f, "line 4").unwrap();
            writeln!(f, "line 5").unwrap();
        }

        let res = read_file_slice(test_file.to_str().unwrap(), Some(2), Some(4));
        assert!(res.exists);
        assert_eq!(res.total_lines, 5);
        assert_eq!(res.line_start, 2);
        assert_eq!(res.line_end, 4);
        assert_eq!(res.content, "line 2\nline 3\nline 4");

        // Out of bounds start/end clamp
        let res_clamp = read_file_slice(test_file.to_str().unwrap(), Some(4), Some(20));
        assert_eq!(res_clamp.line_end, 5);
        assert_eq!(res_clamp.content, "line 4\nline 5");

        let _ = std::fs::remove_file(test_file);
    }

    #[test]
    fn test_read_file_slice_nonexistent() {
        let res = read_file_slice("non_existent_file_path_12345.rs", Some(1), Some(10));
        assert!(!res.exists);
        assert!(res.error.is_some());
    }
}