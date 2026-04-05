import { useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useWorkflowStore, type WorkflowStepData } from '../../store/workflowStore'

export function WorkflowNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowStepData
  const { updateNodeData } = useWorkflowStore()
  const [editing, setEditing] = useState(false)
  const [prompt, setPrompt] = useState(nodeData.promptTemplate)

  const savePrompt = () => {
    updateNodeData(id, { promptTemplate: prompt })
    setEditing(false)
  }

  return (
    <div
      className="workflow-node"
      style={selected ? { borderLeftColor: 'var(--secondary)', boxShadow: 'var(--glow-secondary)' } : {}}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--primary)', border: 'none', width: 8, height: 8 }} />

      <div className="wf-node-header">
        <span className="wf-node-icon">{nodeData.label}</span>
        <span className="wf-node-title">{nodeData.toolName.toUpperCase()}</span>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <textarea
            style={{
              background: 'var(--surface-lowest)',
              border: 'none',
              borderBottom: '1px solid var(--primary)',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '4px 6px',
              outline: 'none',
              resize: 'vertical',
              minHeight: 60,
              caretColor: 'var(--primary)',
            }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="{{input}}"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button
              style={{ background: 'transparent', border: '1px solid var(--outline)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 8px', cursor: 'pointer' }}
              onClick={() => setEditing(false)}
            >
              CANCEL
            </button>
            <button
              style={{ background: 'var(--primary)', border: 'none', color: '#000', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}
              onClick={savePrompt}
            >
              SAVE
            </button>
          </div>
        </div>
      ) : (
        <div
          className="wf-node-prompt"
          onClick={() => setEditing(true)}
          title="Click to edit prompt template"
          style={{ cursor: 'text', marginTop: 4 }}
        >
          {nodeData.promptTemplate || (
            <span style={{ color: 'var(--outline)', fontStyle: 'italic' }}>click to set prompt…</span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: 'var(--primary)', border: 'none', width: 8, height: 8 }} />
    </div>
  )
}
