use crate::tools::{get_tool_def, ToolMode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowStep {
    pub tool_id: String,
    pub prompt_template: String,
    /// Override binary path for this step (e.g. /usr/local/bin/claude)
    pub binary_override: Option<String>,
    /// Per-step timeout in seconds (default: 120)
    pub timeout_secs: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowStepResult {
    pub workflow_id: String,
    pub step_index: usize,
    pub tool_id: String,
    pub input: String,
    pub output: String,
    pub elapsed_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowComplete {
    pub workflow_id: String,
    pub final_output: String,
    pub total_steps: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowError {
    pub workflow_id: String,
    pub step_index: usize,
    pub error: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowCancelled {
    pub workflow_id: String,
}

/// Global set of cancelled workflow IDs
static CANCELLED: once_cell::sync::Lazy<Mutex<std::collections::HashSet<String>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(std::collections::HashSet::new()));

/// Cancel a running workflow by ID. No-op if not running.
#[tauri::command]
pub fn cancel_workflow(workflow_id: String) {
    CANCELLED.lock().unwrap().insert(workflow_id);
}

fn is_cancelled(workflow_id: &str) -> bool {
    CANCELLED.lock().unwrap().contains(workflow_id)
}

fn clear_cancelled(workflow_id: &str) {
    CANCELLED.lock().unwrap().remove(workflow_id);
}

/// Run a one-shot tool synchronously with timeout, binary override, and stderr capture.
pub fn run_oneshot(
    tool_id: &str,
    prompt: &str,
    binary_override: Option<&str>,
    timeout_secs: u64,
) -> Result<String, String> {
    let tool = get_tool_def(tool_id)?;

    if tool.mode == ToolMode::Launcher {
        return Err(format!("Tool '{}' is a Launcher and cannot be used in a workflow", tool_id));
    }

    let binary = binary_override.unwrap_or(&tool.binary);

    let mut child = if let Some(ref flag) = tool.oneshot_flag {
        std::process::Command::new(binary)
            .args(&tool.args)
            .arg(flag)
            .arg(prompt)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start '{}': {}", binary, e))?
    } else {
        let mut c = std::process::Command::new(binary)
            .args(&tool.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start '{}': {}", binary, e))?;
        if let Some(ref mut stdin) = c.stdin {
            writeln!(stdin, "{}", prompt).map_err(|e| e.to_string())?;
        }
        drop(c.stdin.take());
        c
    };

    // Wait with timeout using a background thread
    let deadline = std::time::Instant::now() + Duration::from_secs(timeout_secs);
    loop {
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(_) => break,
            None => {
                if std::time::Instant::now() >= deadline {
                    child.kill().ok();
                    return Err(format!(
                        "Tool '{}' timed out after {}s",
                        tool_id, timeout_secs
                    ));
                }
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    }

    let output = child.wait_with_output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        if !stdout.is_empty() {
            return Ok(stdout.to_string());
        }
        return Err(format!(
            "Tool '{}' exited with status {}: {}",
            tool_id,
            output.status,
            stderr.trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn execute_workflow(
    app: AppHandle,
    workflow_id: String,
    steps: Vec<WorkflowStep>,
    initial_input: String,
    binary_overrides: Option<HashMap<String, String>>,
) -> Result<(), String> {
    let wid = workflow_id.clone();
    let app_clone = app.clone();
    let overrides = binary_overrides.unwrap_or_default();

    // Clear any stale cancellation from a previous run with same ID
    clear_cancelled(&workflow_id);

    tokio::spawn(async move {
        let mut current_input = initial_input;
        let total = steps.len();

        for (i, step) in steps.iter().enumerate() {
            if is_cancelled(&wid) {
                app_clone.emit("workflow-cancelled", WorkflowCancelled { workflow_id: wid.clone() }).ok();
                clear_cancelled(&wid);
                return;
            }

            let prompt = step.prompt_template.replace("{{input}}", &current_input);
            let binary_ov = step
                .binary_override
                .as_deref()
                .or_else(|| overrides.get(&step.tool_id).map(|s| s.as_str()));
            let timeout = step.timeout_secs.unwrap_or(120);

            let t0 = std::time::Instant::now();
            let result = tokio::task::spawn_blocking({
                let tool_id = step.tool_id.clone();
                let prompt = prompt.clone();
                let binary_ov = binary_ov.map(|s| s.to_string());
                move || run_oneshot(&tool_id, &prompt, binary_ov.as_deref(), timeout)
            })
            .await;

            let elapsed_ms = t0.elapsed().as_millis() as u64;

            match result {
                Ok(Ok(output)) => {
                    app_clone
                        .emit(
                            "workflow-step",
                            WorkflowStepResult {
                                workflow_id: wid.clone(),
                                step_index: i,
                                tool_id: step.tool_id.clone(),
                                input: prompt,
                                output: output.clone(),
                                elapsed_ms,
                            },
                        )
                        .ok();
                    current_input = output;
                }
                Ok(Err(e)) => {
                    app_clone
                        .emit(
                            "workflow-error",
                            WorkflowError {
                                workflow_id: wid.clone(),
                                step_index: i,
                                error: e,
                            },
                        )
                        .ok();
                    return;
                }
                Err(e) => {
                    app_clone
                        .emit(
                            "workflow-error",
                            WorkflowError {
                                workflow_id: wid.clone(),
                                step_index: i,
                                error: format!("Internal error: {}", e),
                            },
                        )
                        .ok();
                    return;
                }
            }
        }

        app_clone
            .emit(
                "workflow-complete",
                WorkflowComplete {
                    workflow_id: wid.clone(),
                    final_output: current_input,
                    total_steps: total,
                },
            )
            .ok();
    });

    Ok(())
}
