import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export const isTauri = () => '__TAURI_INTERNALS__' in window

export interface ToolDef {
  id: string
  name: string
  binary: string
  args: string[]
  mode: 'Repl' | 'OneShot' | 'Launcher'
  icon: string
  description: string
  category: string
  custom: boolean
  oneshot_flag: string | null
}

export interface ToolAvailability {
  tool_id: string
  available: boolean
  resolved_path: string | null
  error: string | null
}

export interface SessionInfo {
  session_id: string
  tool_id: string
  started_at: number
}

export interface WorkflowStep {
  tool_id: string
  prompt_template: string
  binary_override?: string | null
  timeout_secs?: number | null
}

export interface OutputEvent {
  session_id: string
  data: string
}

export interface ExitEvent {
  session_id: string
  code: number | null
}

export interface WorkflowStepResult {
  workflow_id: string
  step_index: number
  tool_id: string
  input: string
  output: string
  elapsed_ms: number
}

export interface WorkflowComplete {
  workflow_id: string
  final_output: string
  total_steps: number
}

export interface WorkflowError {
  workflow_id: string
  step_index: number
  error: string
}

export interface WorkflowCancelled {
  workflow_id: string
}

// ── Filesystem commands ───────────────────────────────────────────────────────
export interface FsDirEntry {
  name: string
  path: string
  is_dir: boolean
  size: number | null
}

export const listDir = (path: string) => invoke<FsDirEntry[]>('list_dir', { path })
export const readTextFile = (path: string) => invoke<string>('read_text_file', { path })

// ── Tool commands ────────────────────────────────────────────────────────────
export const listTools = () => invoke<ToolDef[]>('list_tools')

export const checkToolAvailable = (toolId: string, binaryOverride?: string) =>
  invoke<ToolAvailability>('check_tool_available', {
    toolId,
    binaryOverride: binaryOverride ?? null,
  })

export const checkAllTools = () => invoke<ToolAvailability[]>('check_all_tools')

// ── Process commands ─────────────────────────────────────────────────────────
export const spawnTool = (
  sessionId: string,
  toolId: string,
  binaryOverride?: string,
  rows?: number,
  cols?: number,
) =>
  invoke<void>('spawn_tool', {
    sessionId,
    toolId,
    binaryOverride: binaryOverride ?? null,
    rows: rows ?? null,
    cols: cols ?? null,
  })

export const sendInput = (sessionId: string, data: string) =>
  invoke<void>('send_input', { sessionId, data })

export const resizePty = (sessionId: string, rows: number, cols: number) =>
  invoke<void>('resize_pty', { sessionId, rows, cols })

export const killSession = (sessionId: string) =>
  invoke<void>('kill_session', { sessionId })

export const listSessions = () => invoke<SessionInfo[]>('list_sessions')

// ── Workflow commands ────────────────────────────────────────────────────────
export const executeWorkflow = (
  workflowId: string,
  steps: WorkflowStep[],
  initialInput: string,
  binaryOverrides?: Record<string, string>,
) =>
  invoke<void>('execute_workflow', {
    workflowId,
    steps,
    initialInput,
    binaryOverrides: binaryOverrides ?? null,
  })

export const cancelWorkflow = (workflowId: string) =>
  invoke<void>('cancel_workflow', { workflowId })

// ── Event listeners ──────────────────────────────────────────────────────────
export const onToolOutput = (
  cb: (event: OutputEvent) => void
): Promise<UnlistenFn> => listen<OutputEvent>('tool-output', (e) => cb(e.payload))

export const onToolExit = (
  cb: (event: ExitEvent) => void
): Promise<UnlistenFn> => listen<ExitEvent>('tool-exit', (e) => cb(e.payload))

export const onWorkflowStep = (
  cb: (result: WorkflowStepResult) => void
): Promise<UnlistenFn> =>
  listen<WorkflowStepResult>('workflow-step', (e) => cb(e.payload))

export const onWorkflowComplete = (
  cb: (result: WorkflowComplete) => void
): Promise<UnlistenFn> =>
  listen<WorkflowComplete>('workflow-complete', (e) => cb(e.payload))

export const onWorkflowError = (
  cb: (result: WorkflowError) => void
): Promise<UnlistenFn> =>
  listen<WorkflowError>('workflow-error', (e) => cb(e.payload))

export const onWorkflowCancelled = (
  cb: (result: WorkflowCancelled) => void
): Promise<UnlistenFn> =>
  listen<WorkflowCancelled>('workflow-cancelled', (e) => cb(e.payload))
