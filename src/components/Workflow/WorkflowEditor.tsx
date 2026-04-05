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

interface LogEntry {
  text: string
  type: 'info' | 'success' | 'error' | 'step'
}

export function WorkflowEditor() {
  const { nodes, edges, setNodes, setEdges, addNode, startRun, addRunStep, completeRun, failRun } =
    useWorkflowStore()
  const [tools, setTools] = useState<ToolDef[]>([])
  const [initialInput, setInitialInput] = useState('')
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [runLog, setRunLog] = useState<LogEntry[]>([])
  const [logExpanded, setLogExpanded] = useState(true)

  useEffect(() => {
    listTools().then((ts) => setTools(ts.filter((t) => t.mode !== 'Launcher'))).catch(console.error)
  }, [])

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
        { text: `Step ${result.step_index + 1} · ${result.tool_id}: ${result.output.slice(0, 140)}…`, type: 'step' },
      ])
    }).then((fn) => { unStep = fn })

    onWorkflowComplete((result) => {
      completeRun(result.workflow_id)
      setRunLog((l) => [...l, { text: `✓ Complete — ${result.final_output.slice(0, 200)}`, type: 'success' }])
      setActiveRunId(null)
    }).then((fn) => { unComplete = fn })

    onWorkflowError((result) => {
      failRun(result.workflow_id, result.error)
      setRunLog((l) => [...l, { text: `✗ Error at step ${result.step_index + 1}: ${result.error}`, type: 'error' }])
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
      position: { x: 80 + nodes.length * 240, y: 140 },
      data: {
        toolId: tool.id,
        toolName: tool.name,
        promptTemplate: '{{input}}',
        label: tool.icon ?? tool.name[0],
      },
    }
    addNode(newNode)
  }

  const deleteSelectedNodes = () => {
    const sel = nodes.filter((n) => (n as WorkflowNode & { selected?: boolean }).selected)
    if (sel.length === 0) return
    const ids = new Set(sel.map((n) => n.id))
    setNodes(nodes.filter((n) => !ids.has(n.id)))
    setEdges((edges as Edge[]).filter((e) => !ids.has(e.source) && !ids.has(e.target)))
  }

  const clearWorkflow = () => {
    setNodes([])
    setEdges([])
    setRunLog([])
    setActiveRunId(null)
  }

  const buildSteps = () => {
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
    setLogExpanded(true)
    setRunLog([{ text: `▶ Running ${steps.length} step(s)…`, type: 'info' }])
    try {
      await executeWorkflow(runId, steps, initialInput)
    } catch (e) {
      setRunLog((l) => [...l, { text: `✗ Launch error: ${e}`, type: 'error' }])
      setActiveRunId(null)
    }
  }

  const hasSelectedNodes = nodes.some((n) => (n as WorkflowNode & { selected?: boolean }).selected)

  return (
    <div className="workflow-editor flex flex-col h-full">
      {/* Toolbar */}
      <div className="workflow-toolbar flex items-center gap-2 px-3 py-2 flex-wrap">
        <span className="wf-section-label">Add Node</span>
        {tools.map((tool) => (
          <button
            key={tool.id}
            className="wf-add-btn"
            onClick={() => addToolNode(tool)}
            title={`Add ${tool.name} node`}
          >
            <span>{tool.icon}</span>
            <span>{tool.name}</span>
          </button>
        ))}
        <div className="flex-1" />
        {hasSelectedNodes && (
          <button
            className="wf-danger-btn"
            onClick={deleteSelectedNodes}
            title="Delete selected node(s)"
          >
            ✕ Delete
          </button>
        )}
        {nodes.length > 0 && !activeRunId && (
          <button
            className="wf-clear-btn"
            onClick={clearWorkflow}
            title="Clear workflow"
          >
            ⌫ Clear
          </button>
        )}
        <button
          className="wf-run-btn"
          onClick={runWorkflow}
          disabled={nodes.length === 0 || !!activeRunId}
        >
          {activeRunId ? '⟳ Running…' : '▶ Run'}
        </button>
      </div>

      {/* Initial input */}
      <div className="wf-initial-input-bar">
        <span className="wf-input-label">Initial input</span>
        <input
          className="wf-input-field flex-1"
          value={initialInput}
          onChange={(e) => setInitialInput(e.target.value)}
          placeholder="Text to feed into the first step…"
        />
      </div>

      {/* Flow canvas */}
      <div className="flex-1 min-h-0 relative">
        {nodes.length === 0 && (
          <div className="wf-empty-state pointer-events-none">
            <div className="wf-empty-icon">⇝</div>
            <div className="wf-empty-title">No nodes yet</div>
            <div className="wf-empty-hint">Click an "Add Node" button above to start building your workflow</div>
            <div className="wf-empty-hint">Connect nodes by dragging from one handle to another</div>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
          className="workflow-canvas"
        >
          <Background color="#00ff8822" gap={24} />
          <Controls className="workflow-controls" />
          <MiniMap className="workflow-minimap" nodeColor="#00ff88" maskColor="rgba(8,12,16,0.8)" />
        </ReactFlow>
      </div>

      {/* Run log */}
      {runLog.length > 0 && (
        <div className="workflow-log-panel">
          <div
            className="workflow-log-header"
            onClick={() => setLogExpanded((v) => !v)}
          >
            <span className="wf-section-label" style={{ margin: 0 }}>Run Log</span>
            <span className="text-muted text-xs">{runLog.length} entries</span>
            <div className="flex-1" />
            <button
              className="wf-log-toggle"
              title={logExpanded ? 'Collapse' : 'Expand'}
            >
              {logExpanded ? '▾' : '▸'}
            </button>
          </div>
          {logExpanded && (
            <div className="workflow-log-body">
              {runLog.map((entry, i) => (
                <div key={i} className={`wf-log-line wf-log-${entry.type}`}>
                  {entry.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
