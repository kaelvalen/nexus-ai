import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useWorkflowStore, type WorkflowNode } from '../../store/workflowStore'
import { WorkflowNode as WorkflowNodeComponent } from './WorkflowNode'
import {
  listTools,
  executeWorkflow,
  onWorkflowStep,
  onWorkflowComplete,
  onWorkflowError,
  type ToolDef,
} from '../../lib/tauri'

const nodeTypes = { workflowNode: WorkflowNodeComponent }

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function WorkflowEditor() {
  const { nodes, edges, setNodes, setEdges, addNode, startRun, addRunStep, completeRun, failRun } =
    useWorkflowStore()
  const [tools, setTools] = useState<ToolDef[]>([])
  const [initialInput, setInitialInput] = useState('')
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [runLog, setRunLog] = useState<string[]>([])

  useEffect(() => {
    listTools().then((ts) => setTools(ts.filter((t) => t.mode !== 'Launcher'))).catch(console.error)
  }, [])

  // Listen to workflow events
  useEffect(() => {
    let unStep: (() => void) | null = null
    let unComplete: (() => void) | null = null
    let unError: (() => void) | null = null

    onWorkflowStep((result) => {
      addRunStep(result.workflow_id, {
        stepIndex: result.step_index,
        toolId: result.tool_id,
        input: result.input,
        output: result.output,
      })
      setRunLog((l) => [
        ...l,
        `[Step ${result.step_index + 1}] ${result.tool_id}: ${result.output.slice(0, 120)}...`,
      ])
    }).then((fn) => { unStep = fn })

    onWorkflowComplete((result) => {
      completeRun(result.workflow_id)
      setRunLog((l) => [...l, `[COMPLETE] Final output: ${result.final_output.slice(0, 200)}`])
      setActiveRunId(null)
    }).then((fn) => { unComplete = fn })

    onWorkflowError((result) => {
      failRun(result.workflow_id, result.error)
      setRunLog((l) => [...l, `[ERROR step ${result.step_index + 1}] ${result.error}`])
      setActiveRunId(null)
    }).then((fn) => { unError = fn })

    return () => {
      unStep?.()
      unComplete?.()
      unError?.()
    }
  }, [addRunStep, completeRun, failRun])

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges(addEdge(connection, edges as Edge[]) as typeof edges),
    [edges, setEdges]
  )

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes(applyNodeChanges(changes, nodes) as WorkflowNode[]),
    [nodes, setNodes]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges(applyEdgeChanges(changes, edges as Edge[]) as typeof edges),
    [edges, setEdges]
  )

  const addToolNode = (tool: ToolDef) => {
    const nodeId = generateId()
    const newNode: WorkflowNode = {
      id: nodeId,
      type: 'workflowNode',
      position: { x: 100 + nodes.length * 220, y: 150 },
      data: {
        toolId: tool.id,
        toolName: tool.name,
        promptTemplate: '{{input}}',
        label: tool.icon ?? tool.name[0],
      },
    }
    addNode(newNode)
  }

  // Build ordered steps from nodes+edges
  const buildSteps = () => {
    // Simple topological sort: find node with no incoming edges first
    const inDeg: Record<string, number> = {}
    const adj: Record<string, string[]> = {}
    for (const n of nodes) {
      inDeg[n.id] = 0
      adj[n.id] = []
    }
    for (const e of edges) {
      inDeg[e.target] = (inDeg[e.target] ?? 0) + 1
      adj[e.source] = [...(adj[e.source] ?? []), e.target]
    }
    const queue = nodes.filter((n) => inDeg[n.id] === 0).map((n) => n.id)
    const order: string[] = []
    while (queue.length > 0) {
      const cur = queue.shift()!
      order.push(cur)
      for (const next of adj[cur] ?? []) {
        inDeg[next]--
        if (inDeg[next] === 0) queue.push(next)
      }
    }
    return order.map((id) => {
      const n = nodes.find((node) => node.id === id)!
      return { tool_id: n.data.toolId, prompt_template: n.data.promptTemplate }
    })
  }

  const runWorkflow = async () => {
    if (nodes.length === 0) return
    const runId = generateId()
    const steps = buildSteps()
    startRun(runId)
    setActiveRunId(runId)
    setRunLog([`[START] Running workflow with ${steps.length} step(s)...`])
    try {
      await executeWorkflow(runId, steps, initialInput)
    } catch (e) {
      setRunLog((l) => [...l, `[LAUNCH ERROR] ${e}`])
      setActiveRunId(null)
    }
  }

  return (
    <div className="workflow-editor flex flex-col h-full">
      {/* Toolbar */}
      <div className="workflow-toolbar flex items-center gap-2 px-3 py-2 flex-wrap">
        <span className="text-primary text-xs font-bold tracking-widest mr-2">ADD NODE:</span>
        {tools.map((tool) => (
          <button
            key={tool.id}
            className="wf-add-btn"
            onClick={() => addToolNode(tool)}
            title={`Add ${tool.name} node`}
          >
            {tool.icon} {tool.name}
          </button>
        ))}
        <div className="flex-1" />
        <button
          className="wf-run-btn"
          onClick={runWorkflow}
          disabled={nodes.length === 0 || !!activeRunId}
        >
          {activeRunId ? '⟳ Running...' : '▶ Run'}
        </button>
      </div>

      {/* Initial input */}
      <div className="px-3 py-1.5 border-b border-border">
        <input
          className="wf-input-field w-full"
          value={initialInput}
          onChange={(e) => setInitialInput(e.target.value)}
          placeholder="Initial input to feed into the first step..."
        />
      </div>

      {/* Flow canvas */}
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="workflow-canvas"
        >
          <Background color="#00ff8822" gap={24} />
          <Controls className="workflow-controls" />
          <MiniMap className="workflow-minimap" nodeColor="#00ff88" maskColor="rgba(8,12,16,0.8)" />
        </ReactFlow>
      </div>

      {/* Run log */}
      {runLog.length > 0 && (
        <div className="workflow-log px-3 py-2 text-xs font-mono max-h-32 overflow-y-auto">
          {runLog.map((line, i) => (
            <div key={i} className="text-secondary">{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}
