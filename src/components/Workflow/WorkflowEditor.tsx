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
  cancelWorkflow,
  onWorkflowStep,
  onWorkflowComplete,
  onWorkflowError,
  onWorkflowCancelled,
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
  const { nodes, edges, setNodes, setEdges, addNode, startRun, addRunStep, completeRun, failRun, savePreset, loadPreset, deletePreset, presets } =
    useWorkflowStore()
  const [tools, setTools] = useState<ToolDef[]>([])
  const [initialInput, setInitialInput] = useState('')
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [runLog, setRunLog] = useState<LogEntry[]>([])
  const [logExpanded, setLogExpanded] = useState(true)
  const [presetName, setPresetName] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  useEffect(() => {
    listTools().then((ts) => setTools(ts.filter((t) => t.mode !== 'Launcher'))).catch(console.error)
  }, [])

  useEffect(() => {
    let unStep: (() => void) | null = null
    let unComplete: (() => void) | null = null
    let unError: (() => void) | null = null

    let unCancelled: (() => void) | null = null

    onWorkflowStep((result) => {
      addRunStep(result.workflow_id, {
        stepIndex: result.step_index,
        toolId: result.tool_id,
        input: result.input,
        output: result.output,
      })
      const ms = result.elapsed_ms
      const elapsed = ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
      setRunLog((l) => [
        ...l,
        { text: `Step ${result.step_index + 1} [${result.tool_id}] (${elapsed}): ${result.output.slice(0, 120)}…`, type: 'step' },
      ])
    }).then((fn) => { unStep = fn })

    onWorkflowComplete((result) => {
      completeRun(result.workflow_id)
      setRunLog((l) => [...l, { text: `✓ Done (${result.total_steps} steps) — ${result.final_output.slice(0, 200)}`, type: 'success' }])
      setActiveRunId(null)
    }).then((fn) => { unComplete = fn })

    onWorkflowError((result) => {
      failRun(result.workflow_id, result.error)
      setRunLog((l) => [...l, { text: `✗ Error at step ${result.step_index + 1}: ${result.error}`, type: 'error' }])
      setActiveRunId(null)
    }).then((fn) => { unError = fn })

    onWorkflowCancelled((result) => {
      setRunLog((l) => [...l, { text: `⊘ Workflow ${result.workflow_id.slice(0, 8)} cancelled`, type: 'info' }])
      setActiveRunId(null)
    }).then((fn) => { unCancelled = fn })

    return () => {
      unStep?.()
      unComplete?.()
      unError?.()
      unCancelled?.()
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
    <div className="workflow-editor">
      {/* Toolbar */}
      <div className="workflow-toolbar">
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
        {/* Presets */}
        <div className="wf-preset-group">
          <button
            className="wf-preset-toggle"
            onClick={() => setShowPresets((v) => !v)}
            title="Workflow presets"
          >
            ⊟ Presets
          </button>
          {showPresets && (
            <div className="wf-preset-panel">
              <div className="wf-preset-save-row">
                <input
                  className="wf-preset-input"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && presetName.trim()) {
                      savePreset(presetName.trim())
                      setPresetName('')
                    }
                  }}
                />
                <button
                  className="wf-preset-save-btn"
                  onClick={() => {
                    if (presetName.trim()) {
                      savePreset(presetName.trim())
                      setPresetName('')
                    }
                  }}
                  disabled={!presetName.trim() || nodes.length === 0}
                >
                  Save
                </button>
              </div>
              {Object.values(presets).length === 0 ? (
                <div className="wf-preset-empty">No saved presets</div>
              ) : (
                Object.values(presets)
                  .sort((a, b) => b.savedAt - a.savedAt)
                  .map((p) => (
                    <div key={p.name} className="wf-preset-row">
                      <button
                        className="wf-preset-load-btn"
                        onClick={() => { loadPreset(p.name); setShowPresets(false) }}
                        title={`Load "${p.name}" (${p.nodes.length} nodes)`}
                      >
                        {p.name}
                        <span className="wf-preset-meta">{p.nodes.length}n · {new Date(p.savedAt).toLocaleDateString()}</span>
                      </button>
                      <button
                        className="wf-preset-delete-btn"
                        onClick={() => deletePreset(p.name)}
                        title="Delete preset"
                      >
                        ×
                      </button>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
        {activeRunId && (
          <button
            className="wf-danger-btn"
            onClick={() => cancelWorkflow(activeRunId)}
            title="Cancel running workflow"
          >
            ⊘ Cancel
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
      <div className="workflow-input-area">
        <span className="wf-prompt-label">INITIAL_INPUT</span>
        <input
          className="wf-prompt-input"
          value={initialInput}
          onChange={(e) => setInitialInput(e.target.value)}
          placeholder="Text to feed into the first step…"
        />
      </div>

      {/* Flow canvas */}
      <div className="workflow-canvas">
        {nodes.length === 0 && (
          <div className="wf-empty-state">
            <div className="wf-empty-title">// NO_NODES</div>
            <div className="wf-empty-hint">Add nodes from the toolbar above, then connect them</div>
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
          style={{ background: 'var(--bg)' }}
        >
          <Background color="rgba(0,255,136,0.08)" gap={28} size={1} />
          <Controls style={{ background: 'var(--surface-high)', border: '1px solid var(--outline)' }} />
          <MiniMap nodeColor="var(--primary)" maskColor="rgba(8,12,16,0.85)" style={{ background: 'var(--surface-lowest)', border: '1px solid var(--outline)' }} />
        </ReactFlow>
      </div>

      {/* Run log */}
      {runLog.length > 0 && (
        <div className="workflow-log">
          <div className="wf-log-header" onClick={() => setLogExpanded((v) => !v)}>
            <span className="wf-log-title">// RUN_LOG</span>
            <span style={{ fontSize: 9, color: 'var(--muted)' }}>{runLog.length} entries</span>
            <div style={{ flex: 1 }} />
            <span className="mat mat-sm" style={{ color: 'var(--muted)', fontSize: 14 }}>
              {logExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </div>
          {logExpanded && (
            <div className="wf-log-entries">
              {runLog.map((entry, i) => (
                <div key={i} className={`wf-log-line ${entry.type}`}>
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
