use crate::tools::{get_tool_def, ToolMode};
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowStep {
    pub tool_id: String,
    pub prompt_template: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowStepResult {
    pub workflow_id: String,
    pub step_index: usize,
    pub tool_id: String,
    pub input: String,
    pub output: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowComplete {
    pub workflow_id: String,
    pub final_output: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowError {
    pub workflow_id: String,
    pub step_index: usize,
    pub error: String,
}

/// Run a one-shot tool synchronously, returning its stdout.
/// If the tool has a `oneshot_flag`, the prompt is passed as a CLI argument:
///   binary [args] <flag> <prompt>
/// Otherwise falls back to writing the prompt to stdin.
pub fn run_oneshot(tool_id: &str, prompt: &str) -> Result<String, String> {
    let tool = get_tool_def(tool_id)?;

    if tool.mode == ToolMode::Launcher {
        return Err(format!("Tool {} is a Launcher, cannot use in workflow", tool_id));
    }

    let output = if let Some(ref flag) = tool.oneshot_flag {
        // Flag-based invocation: binary [base_args] <flag> <prompt>
        std::process::Command::new(&tool.binary)
            .args(&tool.args)
            .arg(flag)
            .arg(prompt)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .map_err(|e| format!("Failed to run {}: {}", tool.binary, e))?
    } else {
        // Stdin fallback: write prompt then close stdin
        let mut child = std::process::Command::new(&tool.binary)
            .args(&tool.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", tool.binary, e))?;

        if let Some(ref mut stdin) = child.stdin {
            writeln!(stdin, "{}", prompt).map_err(|e| e.to_string())?;
        }
        drop(child.stdin.take());

        child.wait_with_output().map_err(|e| e.to_string())?
    };

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn execute_workflow(
    app: AppHandle,
    workflow_id: String,
    steps: Vec<WorkflowStep>,
    initial_input: String,
) -> Result<(), String> {
    let wid = workflow_id.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        let mut current_input = initial_input;

        for (i, step) in steps.iter().enumerate() {
            let prompt = step.prompt_template.replace("{{input}}", &current_input);

            match run_oneshot(&step.tool_id, &prompt) {
                Ok(output) => {
                    let result = WorkflowStepResult {
                        workflow_id: wid.clone(),
                        step_index: i,
                        tool_id: step.tool_id.clone(),
                        input: prompt,
                        output: output.clone(),
                    };
                    app_clone.emit("workflow-step", result).ok();
                    current_input = output;
                }
                Err(e) => {
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
            }
        }

        app_clone
            .emit(
                "workflow-complete",
                WorkflowComplete {
                    workflow_id: wid.clone(),
                    final_output: current_input,
                },
            )
            .ok();
    });

    Ok(())
}
