import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

export interface WorkflowStepData extends Record<string, unknown> {
  toolId: string
  toolName: string
  promptTemplate: string
  label: string
}

export type WorkflowNode = Node<WorkflowStepData>

export interface WorkflowRun {
  id: string
  steps: Array<{
    stepIndex: number
    toolId: string
    input: string
    output: string
  }>
  complete: boolean
  error?: string
}

export interface WorkflowPreset {
  name: string
  savedAt: number
  nodes: WorkflowNode[]
  edges: Edge[]
}

const STORAGE_KEY = 'nexus:workflow-presets'

function loadPresets(): Record<string, WorkflowPreset> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePresetsToStorage(presets: Record<string, WorkflowPreset>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {}
}

interface WorkflowStore {
  nodes: WorkflowNode[]
  edges: Edge[]
  runs: Record<string, WorkflowRun>
  presets: Record<string, WorkflowPreset>
  setNodes: (nodes: WorkflowNode[]) => void
  setEdges: (edges: Edge[]) => void
  addNode: (node: WorkflowNode) => void
  updateNodeData: (nodeId: string, data: Partial<WorkflowStepData>) => void
  startRun: (runId: string) => void
  addRunStep: (runId: string, step: WorkflowRun['steps'][0]) => void
  completeRun: (runId: string) => void
  failRun: (runId: string, error: string) => void
  savePreset: (name: string) => void
  loadPreset: (name: string) => void
  deletePreset: (name: string) => void
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: [],
  edges: [],
  runs: {},
  presets: loadPresets(),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node] })),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),

  startRun: (runId) =>
    set((state) => ({
      runs: { ...state.runs, [runId]: { id: runId, steps: [], complete: false } },
    })),

  addRunStep: (runId, step) =>
    set((state) => {
      const run = state.runs[runId]
      if (!run) return state
      return {
        runs: {
          ...state.runs,
          [runId]: { ...run, steps: [...run.steps, step] },
        },
      }
    }),

  completeRun: (runId) =>
    set((state) => {
      const run = state.runs[runId]
      if (!run) return state
      return { runs: { ...state.runs, [runId]: { ...run, complete: true } } }
    }),

  failRun: (runId, error) =>
    set((state) => {
      const run = state.runs[runId]
      if (!run) return state
      return {
        runs: { ...state.runs, [runId]: { ...run, complete: true, error } },
      }
    }),

  savePreset: (name) => {
    const { nodes, edges, presets } = get()
    const updated = {
      ...presets,
      [name]: { name, savedAt: Date.now(), nodes, edges },
    }
    savePresetsToStorage(updated)
    set({ presets: updated })
  },

  loadPreset: (name) => {
    const { presets } = get()
    const preset = presets[name]
    if (!preset) return
    set({ nodes: preset.nodes, edges: preset.edges })
  },

  deletePreset: (name) => {
    const { presets } = get()
    const updated = { ...presets }
    delete updated[name]
    savePresetsToStorage(updated)
    set({ presets: updated })
  },
}))
