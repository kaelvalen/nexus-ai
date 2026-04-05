use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolDef {
    pub id: String,
    pub name: String,
    pub binary: String,
    pub args: Vec<String>,
    pub mode: ToolMode,
    pub icon: String,
    /// CLI flag used to pass a prompt non-interactively, e.g. "-p" or "--prompt".
    /// If Some, workflow steps invoke: binary [args] <flag> <prompt>
    /// If None, falls back to stdin piping.
    pub oneshot_flag: Option<String>,
    pub description: String,
    pub category: String,
    /// Whether this tool was added by the user at runtime (not built-in)
    pub custom: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolAvailability {
    pub tool_id: String,
    pub available: bool,
    pub resolved_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum ToolMode {
    Repl,
    OneShot,
    Launcher,
}

pub fn get_tool_definitions() -> Vec<ToolDef> {
    vec![
        ToolDef {
            id: "claude".into(),
            name: "Claude".into(),
            binary: "claude".into(),
            args: vec![],
            mode: ToolMode::Repl,
            icon: "⬡".into(),
            oneshot_flag: Some("-p".into()),
            description: "Anthropic Claude — conversational AI assistant".into(),
            category: "AI Assistant".into(),
            custom: false,
        },
        ToolDef {
            id: "gemini".into(),
            name: "Gemini".into(),
            binary: "gemini".into(),
            args: vec![],
            mode: ToolMode::Repl,
            icon: "◈".into(),
            oneshot_flag: Some("-p".into()),
            description: "Google Gemini — multimodal AI assistant".into(),
            category: "AI Assistant".into(),
            custom: false,
        },
        ToolDef {
            id: "qwen".into(),
            name: "Qwen Code".into(),
            binary: "qwen".into(),
            args: vec![],
            mode: ToolMode::Repl,
            icon: "◎".into(),
            oneshot_flag: None,
            description: "Alibaba Qwen Coder — code-focused AI".into(),
            category: "AI Coder".into(),
            custom: false,
        },
        ToolDef {
            id: "aider".into(),
            name: "Aider".into(),
            binary: "aider".into(),
            args: vec!["--no-pretty".into()],
            mode: ToolMode::Repl,
            icon: "⟁".into(),
            oneshot_flag: None,
            description: "Aider — AI pair programmer in your terminal".into(),
            category: "AI Coder".into(),
            custom: false,
        },
        ToolDef {
            id: "copilot".into(),
            name: "GitHub Copilot".into(),
            binary: "copilot".into(),
            args: vec![],
            mode: ToolMode::Repl,
            icon: "⊕".into(),
            oneshot_flag: Some("--prompt".into()),
            description: "GitHub Copilot CLI — AI-powered GitHub assistant".into(),
            category: "AI Assistant".into(),
            custom: false,
        },
        ToolDef {
            id: "cursor".into(),
            name: "Cursor".into(),
            binary: "cursor".into(),
            args: vec![".".into()],
            mode: ToolMode::Launcher,
            icon: "▷".into(),
            oneshot_flag: None,
            description: "Open Cursor editor in current directory".into(),
            category: "Editor".into(),
            custom: false,
        },
        ToolDef {
            id: "windsurf".into(),
            name: "Windsurf".into(),
            binary: "windsurf".into(),
            args: vec![".".into()],
            mode: ToolMode::Launcher,
            icon: "≋".into(),
            oneshot_flag: None,
            description: "Open Windsurf editor in current directory".into(),
            category: "Editor".into(),
            custom: false,
        },
    ]
}

#[allow(dead_code)]
pub fn get_tool_def_with_overrides(id: &str, custom_tools: &[ToolDef]) -> Result<ToolDef, String> {
    // Check custom tools first
    if let Some(t) = custom_tools.iter().find(|t| t.id == id) {
        return Ok(t.clone());
    }
    get_tool_definitions()
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| format!("Unknown tool: {}", id))
}

pub fn get_tool_def(id: &str) -> Result<ToolDef, String> {
    get_tool_definitions()
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| format!("Unknown tool: {}", id))
}

#[tauri::command]
pub fn list_tools() -> Vec<ToolDef> {
    get_tool_definitions()
}

/// Check whether a tool's binary can be found in PATH or as an absolute path.
#[tauri::command]
pub fn check_tool_available(tool_id: String, binary_override: Option<String>) -> ToolAvailability {
    let binary = if let Some(ref ov) = binary_override {
        ov.clone()
    } else {
        match get_tool_def(&tool_id) {
            Ok(t) => t.binary,
            Err(e) => {
                return ToolAvailability {
                    tool_id,
                    available: false,
                    resolved_path: None,
                    error: Some(e),
                }
            }
        }
    };

    match which_binary(&binary) {
        Some(path) => ToolAvailability {
            tool_id,
            available: true,
            resolved_path: Some(path),
            error: None,
        },
        None => ToolAvailability {
            tool_id,
            available: false,
            resolved_path: None,
            error: Some(format!("'{}' not found in PATH", binary)),
        },
    }
}

/// Check all built-in tools at once.
#[tauri::command]
pub fn check_all_tools() -> Vec<ToolAvailability> {
    get_tool_definitions()
        .into_iter()
        .map(|t| check_tool_available(t.id, None))
        .collect()
}

fn which_binary(name: &str) -> Option<String> {
    // If it looks like an absolute path, check directly
    let p = std::path::Path::new(name);
    if p.is_absolute() {
        if p.exists() {
            return Some(name.to_string());
        }
        return None;
    }

    // Walk PATH
    if let Ok(path_var) = std::env::var("PATH") {
        let sep = if cfg!(windows) { ';' } else { ':' };
        for dir in path_var.split(sep) {
            let candidate = std::path::Path::new(dir).join(name);
            if candidate.exists() {
                return Some(candidate.to_string_lossy().to_string());
            }
            // Try with .exe on Windows
            #[cfg(windows)]
            {
                let with_ext = candidate.with_extension("exe");
                if with_ext.exists() {
                    return Some(with_ext.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}
