import { useEffect, useRef, useState } from 'react'
import { useWindowStore } from '../../store/windowStore'
import { useSessionStore } from '../../store/sessionStore'
import { listTools, spawnTool, type ToolDef } from '../../lib/tauri'
import { toast } from '../../store/toastStore'

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

interface Command {
  id: string
  label: string
  description?: string
  icon: string
  action: () => void
  keywords?: string[]
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [tools, setTools] = useState<ToolDef[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { windows, openWindow, focusWindow, restoreWindow, closeWindow } = useWindowStore()
  const { createSession } = useSessionStore()

  useEffect(() => {
    listTools().then(setTools).catch(() => {})
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const getBinaryOverride = (toolId: string): string | undefined => {
    try {
      const saved = localStorage.getItem('nexus:binary-overrides')
      if (!saved) return undefined
      const overrides: { toolId: string; binary: string }[] = JSON.parse(saved)
      return overrides.find((o) => o.toolId === toolId)?.binary
    } catch {
      return undefined
    }
  }

  const launchTool = async (tool: ToolDef) => {
    const sessionId = generateId()
    const windowId = `win-${sessionId}`
    const binaryOverride = getBinaryOverride(tool.id)

    if (tool.mode === 'Launcher') {
      try {
        await spawnTool(sessionId, tool.id, binaryOverride)
        toast.info(`Launched ${tool.name}`)
      } catch (e) {
        toast.error(`Failed to launch ${tool.name}`, String(e))
      }
      onClose()
      return
    }

    createSession(sessionId, tool.id, tool.name)
    try {
      await spawnTool(sessionId, tool.id, binaryOverride)
    } catch (e) {
      toast.error(`Failed to spawn ${tool.name}`, String(e))
    }

    const existing = windows.find((w) => w.id === windowId)
    if (existing) {
      restoreWindow(windowId)
    } else {
      openWindow({
        id: windowId,
        title: tool.name,
        component: 'Terminal',
        props: { sessionId, toolId: tool.id },
        position: { x: 80 + Math.random() * 120, y: 40 + Math.random() * 80 },
        size: { width: 740, height: 500 },
      })
    }
    onClose()
  }

  const openWorkflowEditor = () => {
    const id = 'workflow-editor'
    const existing = windows.find((w) => w.id === id)
    if (existing) {
      existing.minimized ? restoreWindow(id) : focusWindow(id)
    } else {
      openWindow({
        id,
        title: 'Workflow Editor',
        component: 'WorkflowEditor',
        props: {},
        position: { x: 120, y: 60 },
        size: { width: 960, height: 640 },
      })
    }
    onClose()
  }

  const openSettings = () => {
    const id = 'settings'
    const existing = windows.find((w) => w.id === id)
    if (existing) {
      existing.minimized ? restoreWindow(id) : focusWindow(id)
    } else {
      openWindow({
        id,
        title: 'Settings',
        component: 'Settings',
        props: {},
        position: { x: 160, y: 80 },
        size: { width: 580, height: 460 },
      })
    }
    onClose()
  }

  const commands: Command[] = [
    // Launch tools
    ...tools.map((t) => ({
      id: `launch-${t.id}`,
      label: `Launch ${t.name}`,
      description: t.mode === 'Launcher' ? 'Open editor' : 'Start new session',
      icon: t.icon,
      keywords: [t.id, t.binary, 'launch', 'open', 'start', 'new'],
      action: () => launchTool(t),
    })),
    // Switch to open windows
    ...windows
      .filter((w) => !w.minimized)
      .map((w) => ({
        id: `focus-${w.id}`,
        label: `Focus: ${w.title}`,
        description: 'Bring window to front',
        icon: '◈',
        keywords: ['focus', 'switch', 'window', w.title.toLowerCase()],
        action: () => { focusWindow(w.id); onClose() },
      })),
    // Close windows
    ...windows.map((w) => ({
      id: `close-${w.id}`,
      label: `Close: ${w.title}`,
      description: 'Close this window',
      icon: '✕',
      keywords: ['close', 'quit', w.title.toLowerCase()],
      action: () => { closeWindow(w.id); onClose() },
    })),
    // Restore minimized
    ...windows
      .filter((w) => w.minimized)
      .map((w) => ({
        id: `restore-${w.id}`,
        label: `Restore: ${w.title}`,
        description: 'Un-minimize window',
        icon: '▣',
        keywords: ['restore', 'minimize', w.title.toLowerCase()],
        action: () => { restoreWindow(w.id); onClose() },
      })),
    {
      id: 'workflow-editor',
      label: 'Open Workflow Editor',
      description: 'Build AI pipelines',
      icon: '⇝',
      keywords: ['workflow', 'pipeline', 'flow', 'editor'],
      action: openWorkflowEditor,
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Configure binaries and appearance',
      icon: '⚙',
      keywords: ['settings', 'config', 'preferences', 'options'],
      action: openSettings,
    },
  ]

  const filtered = query.trim()
    ? commands.filter((c) => {
        const q = query.toLowerCase()
        return (
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.includes(q))
        )
      })
    : commands

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); return }
    if (e.key === 'Enter' && filtered[selected]) { filtered[selected].action(); return }
  }

  if (!open) return null

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-row">
          <span className="cmd-search-icon">⌕</span>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKey}
            spellCheck={false}
          />
          <span className="cmd-esc-hint">ESC</span>
        </div>
        <div className="cmd-list">
          {filtered.length === 0 && (
            <div className="cmd-empty">No matching commands</div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`cmd-item ${i === selected ? 'cmd-item-selected' : ''}`}
              onClick={cmd.action}
              onMouseEnter={() => setSelected(i)}
            >
              <span className="cmd-item-icon">{cmd.icon}</span>
              <span className="cmd-item-label">{cmd.label}</span>
              {cmd.description && (
                <span className="cmd-item-desc">{cmd.description}</span>
              )}
            </button>
          ))}
        </div>
        <div className="cmd-footer">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>ESC close</span>
        </div>
      </div>
    </div>
  )
}
