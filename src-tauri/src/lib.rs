mod fs_commands;
mod git_commands;
mod process_manager;
mod tools;
mod workflow;

use std::sync::Arc;

use process_manager::ProcessManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let process_manager = Arc::new(ProcessManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(process_manager)
        .invoke_handler(tauri::generate_handler![
            tools::list_tools,
            tools::check_tool_available,
            tools::check_all_tools,
            process_manager::spawn_tool,
            process_manager::send_input,
            process_manager::resize_pty,
            process_manager::kill_session,
            process_manager::list_sessions,
            workflow::execute_workflow,
            workflow::cancel_workflow,
            fs_commands::list_dir,
            fs_commands::read_text_file,
            git_commands::git_status,
            git_commands::git_log,
            git_commands::git_diff,
            git_commands::git_stage,
            git_commands::git_unstage,
            git_commands::git_commit,
            git_commands::git_push,
            git_commands::git_pull,
            git_commands::git_discard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
