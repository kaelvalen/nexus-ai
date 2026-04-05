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
            process_manager::spawn_tool,
            process_manager::send_input,
            process_manager::resize_pty,
            process_manager::kill_session,
            process_manager::list_sessions,
            workflow::execute_workflow,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
