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

interface WorkflowStore {
  nodes: WorkflowNode[]
  edges: Edge[]
  runs: Record<string, WorkflowRun>
  setNodes: (nodes: WorkflowNode[]) => void
  setEdges: (edges: Edge[]) => void
  addNode: (node: WorkflowNode) => void
  updateNodeData: (nodeId: string, data: Partial<WorkflowStepData>) => void
  startRun: (runId: string) => void
  addRunStep: (runId: string, step: WorkflowRun['steps'][0]) => void
  completeRun: (runId: string) => void
  failRun: (runId: string, error: string) => void
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  nodes: [],
  edges: [],
  runs: {},

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
}))
