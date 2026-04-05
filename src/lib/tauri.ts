import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface ToolDef {
  id: string
  name: string
  binary: string
  args: string[]
  mode: 'Repl' | 'OneShot' | 'Launcher'
  icon: string
}

export interface WorkflowStep {
  tool_id: string
  prompt_template: string
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
}

export interface WorkflowComplete {
  workflow_id: string
  final_output: string
}

export interface WorkflowError {
  workflow_id: string
  step_index: number
  error: string
}

// Tool commands
export const listTools = () => invoke<ToolDef[]>('list_tools')

// Process commands
export const spawnTool = (sessionId: string, toolId: string, binaryOverride?: string) =>
  invoke<void>('spawn_tool', { sessionId, toolId, binaryOverride: binaryOverride ?? null })

export const sendInput = (sessionId: string, input: string) =>
  invoke<void>('send_input', { sessionId, input })

export const killSession = (sessionId: string) =>
  invoke<void>('kill_session', { sessionId })

export const listSessions = () => invoke<string[]>('list_sessions')

// Workflow commands
export const executeWorkflow = (
  workflowId: string,
  steps: WorkflowStep[],
  initialInput: string
) => invoke<void>('execute_workflow', { workflowId, steps, initialInput })

// Event listeners
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
