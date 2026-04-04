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
    <div className={`workflow-node ${selected ? 'workflow-node-selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="workflow-handle" />

      <div className="workflow-node-header">
        <span className="workflow-node-icon">{nodeData.label}</span>
        <span className="workflow-node-name">{nodeData.toolName}</span>
      </div>

      <div className="workflow-node-body">
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              className="workflow-prompt-editor"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Prompt template — use {{input}} for previous step output"
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <button className="wf-btn wf-btn-cancel" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="wf-btn wf-btn-save" onClick={savePrompt}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            className="workflow-prompt-preview"
            onClick={() => setEditing(true)}
            title="Click to edit prompt"
          >
            {nodeData.promptTemplate || (
              <span className="text-muted italic">Click to set prompt template...</span>
            )}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="workflow-handle" />
    </div>
  )
}
