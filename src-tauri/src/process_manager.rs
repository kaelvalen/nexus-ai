use crate::tools::{get_tool_def, ToolMode};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub struct Session {
    pub writer: Box<dyn Write + Send>,
    pub killer: Box<dyn portable_pty::Child + Send>,
    pub master: Box<dyn MasterPty + Send>,
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

#[tauri::command]
pub async fn spawn_tool(
    app: AppHandle,
    session_id: String,
    tool_id: String,
    binary_override: Option<String>,
    state: tauri::State<'_, Arc<ProcessManager>>,
) -> Result<(), String> {
    let tool = get_tool_def(&tool_id)?;
    let binary = binary_override.as_deref().unwrap_or(&tool.binary).to_string();

    if tool.mode == ToolMode::Launcher {
        // Launcher: just fire and forget, no pipe
        let mut cmd = std::process::Command::new(&binary);
        for arg in &tool.args {
            cmd.arg(arg);
        }
        cmd.spawn()
            .map_err(|e| format!("Failed to launch {}: {}", binary, e))?;
        return Ok(());
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 220,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open pty: {}", e))?;

    let mut cmd = CommandBuilder::new(&binary);
    for arg in &tool.args {
        cmd.arg(arg);
    }

    let child = pair
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

    // Read stdout in background thread — raw bytes so xterm.js gets ANSI intact
    let app_clone = app.clone();
    let sid = session_id.clone();
    let state_clone = Arc::clone(&state.inner());
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut reader = reader;
        loop {
            match std::io::Read::read(&mut reader, &mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    app_clone
                        .emit(
                            "tool-output",
                            OutputEvent {
                                session_id: sid.clone(),
                                data,
                            },
                        )
                        .ok();
                }
                Err(_) => break,
            }
        }
        // Process exited
        app_clone
            .emit(
                "tool-exit",
                ExitEvent {
                    session_id: sid.clone(),
                    code: None,
                },
            )
            .ok();
        // Clean up session
        state_clone.sessions.lock().unwrap().remove(&sid);
    });

    let session = Session {
        writer,
        killer: child,
        master: pair.master,
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
    if let Some(mut session) = sessions.remove(&session_id) {
        session.killer.kill().ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn list_sessions(
    state: tauri::State<'_, Arc<ProcessManager>>,
) -> Result<Vec<String>, String> {
    let sessions = state.sessions.lock().unwrap();
    Ok(sessions.keys().cloned().collect())
}
