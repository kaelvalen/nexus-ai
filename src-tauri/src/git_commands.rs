use serde::Serialize;
use std::process::Command;

fn run_git(args: &[&str], cwd: &str) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("git error: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[derive(Serialize, Clone)]
pub struct GitStatusEntry {
    pub xy: String,      // e.g. "M ", " M", "??", "A ", ...
    pub path: String,
    pub staged: bool,
    pub kind: String,    // "modified" | "added" | "deleted" | "untracked" | "renamed"
}

#[derive(Serialize)]
pub struct GitStatus {
    pub branch: String,
    pub upstream: Option<String>,
    pub ahead: i32,
    pub behind: i32,
    pub entries: Vec<GitStatusEntry>,
    pub is_repo: bool,
}

#[tauri::command]
pub fn git_status(cwd: String) -> GitStatus {
    let branch = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], &cwd)
        .unwrap_or_else(|_| "".to_string());

    if branch.is_empty() {
        return GitStatus { branch: "".into(), upstream: None, ahead: 0, behind: 0, entries: vec![], is_repo: false };
    }

    let (ahead, behind) = run_git(&["rev-list", "--left-right", "--count", "@{u}...HEAD"], &cwd)
        .ok()
        .and_then(|s| {
            let parts: Vec<&str> = s.split_whitespace().collect();
            if parts.len() == 2 {
                Some((parts[1].parse::<i32>().unwrap_or(0), parts[0].parse::<i32>().unwrap_or(0)))
            } else { None }
        })
        .unwrap_or((0, 0));

    let upstream = run_git(&["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], &cwd).ok();

    let raw = run_git(&["status", "--porcelain=v1", "-z"], &cwd).unwrap_or_default();
    let mut entries = Vec::new();

    for entry in raw.split('\0') {
        if entry.len() < 4 { continue; }
        let xy = &entry[..2];
        let path = entry[3..].to_string();
        if path.is_empty() { continue; }

        let x = xy.chars().next().unwrap_or(' ');
        let y = xy.chars().nth(1).unwrap_or(' ');
        let staged = x != ' ' && x != '?';
        let kind = match (x, y) {
            ('?', '?') => "untracked",
            ('A', _)   => "added",
            ('D', _) | (_, 'D') => "deleted",
            ('R', _)   => "renamed",
            _          => "modified",
        }.to_string();

        entries.push(GitStatusEntry { xy: xy.to_string(), path, staged, kind });
    }

    GitStatus { branch, upstream, ahead, behind, entries, is_repo: true }
}

#[derive(Serialize)]
pub struct GitLog {
    pub entries: Vec<GitLogEntry>,
}

#[derive(Serialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

#[tauri::command]
pub fn git_log(cwd: String, limit: Option<u32>) -> Result<GitLog, String> {
    let n = limit.unwrap_or(30).to_string();
    let raw = run_git(
        &["log", &format!("-{n}"), "--pretty=format:%H\x1f%h\x1f%an\x1f%ar\x1f%s"],
        &cwd,
    )?;

    let entries = raw.lines().filter_map(|line| {
        let parts: Vec<&str> = line.splitn(5, '\x1f').collect();
        if parts.len() == 5 {
            Some(GitLogEntry {
                hash:       parts[0].to_string(),
                short_hash: parts[1].to_string(),
                author:     parts[2].to_string(),
                date:       parts[3].to_string(),
                message:    parts[4].to_string(),
            })
        } else { None }
    }).collect();

    Ok(GitLog { entries })
}

#[tauri::command]
pub fn git_diff(cwd: String, path: Option<String>) -> Result<String, String> {
    match path {
        Some(p) => run_git(&["diff", "HEAD", "--", &p], &cwd),
        None    => run_git(&["diff", "HEAD"], &cwd),
    }
}

#[tauri::command]
pub fn git_stage(cwd: String, path: String) -> Result<(), String> {
    run_git(&["add", "--", &path], &cwd).map(|_| ())
}

#[tauri::command]
pub fn git_unstage(cwd: String, path: String) -> Result<(), String> {
    run_git(&["restore", "--staged", "--", &path], &cwd).map(|_| ())
}

#[tauri::command]
pub fn git_commit(cwd: String, message: String) -> Result<String, String> {
    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }
    run_git(&["commit", "-m", &message], &cwd)
}

#[tauri::command]
pub fn git_push(cwd: String) -> Result<String, String> {
    run_git(&["push"], &cwd)
}

#[tauri::command]
pub fn git_pull(cwd: String) -> Result<String, String> {
    run_git(&["pull"], &cwd)
}

#[tauri::command]
pub fn git_discard(cwd: String, path: String) -> Result<(), String> {
    run_git(&["restore", "--", &path], &cwd).map(|_| ())
}
