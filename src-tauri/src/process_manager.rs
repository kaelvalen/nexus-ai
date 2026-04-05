use crate::tools::{get_tool_def, ToolMode};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub struct Session {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn MasterPty + Send>,
    pub tool_id: String,
    pub started_at: u64,
}

pub struct ProcessManager {
    pub sessions: Mutex<HashMap<String, Session>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        ProcessManager {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OutputEvent {
    pub session_id: String,
    pub data: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExitEvent {
    pub session_id: String,
    pub code: Option<i32>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionInfo {
    pub session_id: String,
    pub tool_id: String,
    pub started_at: u64,
}

#[tauri::command]
pub async fn spawn_tool(
    app: AppHandle,
    session_id: String,
    tool_id: String,
    binary_override: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
    state: tauri::State<'_, Arc<ProcessManager>>,
) -> Result<(), String> {
    let tool = get_tool_def(&tool_id)?;
    let binary = binary_override.as_deref().unwrap_or(&tool.binary).to_string();

    if tool.mode == ToolMode::Launcher {
        let mut cmd = std::process::Command::new(&binary);
        for arg in &tool.args {
            cmd.arg(arg);
        }
        cmd.spawn()
            .map_err(|e| format!("Failed to launch {}: {}", binary, e))?;
        return Ok(());
    }

    let pty_rows = rows.unwrap_or(24);
    let pty_cols = cols.unwrap_or(220);

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: pty_rows,
            cols: pty_cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open pty: {}", e))?;

    let mut cmd = CommandBuilder::new(&binary);
    for arg in &tool.args {
        cmd.arg(arg);
    }

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn {}: {}", binary, e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get writer: {}", e))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get reader: {}", e))?;

    let app_clone = app.clone();
    let sid = session_id.clone();
    let state_clone = Arc::clone(&state.inner());

    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut reader = reader;
        loop {
            match std::io::Read::read(&mut reader, &mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    app_clone
                        .emit("tool-output", OutputEvent { session_id: sid.clone(), data })
                        .ok();
                }
                Err(_) => break,
            }
        }

        // portable_pty::ExitStatus wraps the raw exit code integer
        let code: Option<i32> = child.wait().ok().map(|s| {
            // ExitStatus has a single public field `success: bool`;
            // map it to a conventional 0/1 code
            if s.success() { 0 } else { 1 }
        });

        app_clone
            .emit("tool-exit", ExitEvent { session_id: sid.clone(), code })
            .ok();

        state_clone.sessions.lock().unwrap().remove(&sid);
    });

    let session = Session {
        writer,
        master: pair.master,
        tool_id: tool_id.clone(),
        started_at: now_ms(),
    };
    state.sessions.lock().unwrap().insert(session_id, session);

    Ok(())
}

#[tauri::command]
pub async fn send_input(
    session_id: String,
    data: String,
    state: tauri::State<'_, Arc<ProcessManager>>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn resize_pty(
    session_id: String,
    rows: u16,
    cols: u16,
    state: tauri::State<'_, Arc<ProcessManager>>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&session_id) {
        session
            .master
            .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| format!("resize failed: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn kill_session(
    session_id: String,
    state: tauri::State<'_, Arc<ProcessManager>>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.remove(&session_id) {
        // Closing the master side causes the child process to receive SIGHUP
        drop(session);
    }
    Ok(())
}

#[tauri::command]
pub async fn list_sessions(
    state: tauri::State<'_, Arc<ProcessManager>>,
) -> Result<Vec<SessionInfo>, String> {
    let sessions = state.sessions.lock().unwrap();
    Ok(sessions
        .iter()
        .map(|(id, s)| SessionInfo {
            session_id: id.clone(),
            tool_id: s.tool_id.clone(),
            started_at: s.started_at,
        })
        .collect())
}
