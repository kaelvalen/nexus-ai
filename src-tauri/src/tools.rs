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
        },
        ToolDef {
            id: "gemini".into(),
            name: "Gemini".into(),
            binary: "gemini".into(),
            args: vec![],
            mode: ToolMode::Repl,
            icon: "◈".into(),
            oneshot_flag: Some("-p".into()),
        },
        ToolDef {
            id: "qwen-code".into(),
            name: "Qwen Code".into(),
            binary: "qwen-code".into(),
            args: vec![],
            mode: ToolMode::Repl,
            icon: "◎".into(),
            oneshot_flag: None,
        },
        ToolDef {
            id: "aider".into(),
            name: "Aider".into(),
            binary: "aider".into(),
            args: vec!["--no-pretty".into()],
            mode: ToolMode::Repl,
            icon: "⟁".into(),
            oneshot_flag: None,
        },
        ToolDef {
            id: "gh-copilot".into(),
            name: "GH Copilot".into(),
            binary: "gh".into(),
            args: vec![
                "copilot".into(),
                "suggest".into(),
                "--target".into(),
                "shell".into(),
            ],
            mode: ToolMode::OneShot,
            icon: "⊕".into(),
            oneshot_flag: Some("--prompt".into()),
        },
        ToolDef {
            id: "cursor".into(),
            name: "Cursor".into(),
            binary: "cursor".into(),
            args: vec![".".into()],
            mode: ToolMode::Launcher,
            icon: "▷".into(),
            oneshot_flag: None,
        },
        ToolDef {
            id: "windsurf".into(),
            name: "Windsurf".into(),
            binary: "windsurf".into(),
            args: vec![".".into()],
            mode: ToolMode::Launcher,
            icon: "≋".into(),
            oneshot_flag: None,
        },
    ]
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
