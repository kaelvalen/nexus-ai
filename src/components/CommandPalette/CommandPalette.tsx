import { useEffect, useRef, useState } from 'react'
import { useWindowStore } from '../../store/windowStore'
import { useSessionStore } from '../../store/sessionStore'
import { useCwdStore } from '../../store/cwdStore'
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

  const { cwd } = useCwdStore()

  const launchTool = async (tool: ToolDef) => {
    const sessionId = generateId()
    const windowId = `win-${sessionId}`
    const binaryOverride = getBinaryOverride(tool.id)
    const resolvedCwd = cwd === '~' ? undefined : cwd

    if (tool.mode === 'Launcher') {
      try {
        await spawnTool(sessionId, tool.id, binaryOverride, resolvedCwd)
        toast.info(`Launched ${tool.name}`)
      } catch (e) {
        toast.error(`Failed to launch ${tool.name}`, String(e))
      }
      onClose()
      return
    }

    createSession(sessionId, tool.id, tool.name)
    try {
      await spawnTool(sessionId, tool.id, binaryOverride, resolvedCwd, 24, 220)
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
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette-panel" onClick={(e) => e.stopPropagation()}>
        {/* Search row */}
        <div className="palette-search-row">
          <span className="mat">search</span>
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Type a command or search tools…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKey}
            spellCheck={false}
          />
          <span className="palette-kbd">ESC</span>
        </div>

        {/* Results */}
        <div className="palette-results">
          {filtered.length === 0 && (
            <div className="palette-empty">No matching commands</div>
          )}
          {filtered.length > 0 && (
            <>
              {/* Tools group */}
              {filtered.some((c) => c.id.startsWith('launch-')) && (
                <div className="palette-section-label">LAUNCH</div>
              )}
              {filtered.filter((c) => c.id.startsWith('launch-')).map((cmd) => {
                const globalIdx = filtered.indexOf(cmd)
                const tool = tools.find((t) => `launch-${t.id}` === cmd.id)
                return (
                  <button
                    key={cmd.id}
                    className={`palette-item ${globalIdx === selected ? 'focused' : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelected(globalIdx)}
                  >
                    <span className="palette-item-icon">{cmd.icon}</span>
                    <span className="palette-item-body">
                      <span className="palette-item-title">{cmd.label}</span>
                      <span className="palette-item-sub">{cmd.description}</span>
                    </span>
                    {tool && modeband(tool)}
                  </button>
                )
              })}

              {/* Windows group */}
              {filtered.some((c) => c.id.startsWith('focus-') || c.id.startsWith('close-') || c.id.startsWith('restore-')) && (
                <div className="palette-section-label">WINDOWS</div>
              )}
              {filtered.filter((c) => c.id.startsWith('focus-') || c.id.startsWith('close-') || c.id.startsWith('restore-')).map((cmd) => {
                const globalIdx = filtered.indexOf(cmd)
                return (
                  <button
                    key={cmd.id}
                    className={`palette-item ${globalIdx === selected ? 'focused' : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelected(globalIdx)}
                  >
                    <span className="palette-item-icon secondary">
                      <span className="mat mat-sm">
                        {cmd.id.startsWith('focus-') ? 'tab_unselected' : cmd.id.startsWith('restore-') ? 'flip_to_front' : 'close'}
                      </span>
                    </span>
                    <span className="palette-item-body">
                      <span className="palette-item-title">{cmd.label}</span>
                      <span className="palette-item-sub">{cmd.description}</span>
                    </span>
                  </button>
                )
              })}

              {/* System commands */}
              {filtered.some((c) => c.id === 'workflow-editor' || c.id === 'settings') && (
                <div className="palette-section-label">SYSTEM</div>
              )}
              {filtered.filter((c) => c.id === 'workflow-editor' || c.id === 'settings').map((cmd) => {
                const globalIdx = filtered.indexOf(cmd)
                return (
                  <button
                    key={cmd.id}
                    className={`palette-item ${globalIdx === selected ? 'focused' : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelected(globalIdx)}
                  >
                    <span className="palette-item-icon tertiary">
                      <span className="mat mat-sm">{cmd.id === 'settings' ? 'settings' : 'account_tree'}</span>
                    </span>
                    <span className="palette-item-body">
                      <span className="palette-item-title">{cmd.label}</span>
                      <span className="palette-item-sub">{cmd.description}</span>
                    </span>
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '6px 16px',
          display: 'flex', gap: 16,
          borderTop: '1px solid var(--ghost)',
          fontSize: 9, color: 'var(--muted)',
          letterSpacing: '0.1em', fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          <span>↑↓ NAVIGATE</span>
          <span>↵ SELECT</span>
          <span>ESC CLOSE</span>
        </div>
      </div>
    </div>
  )
}

function modeband(tool: ToolDef) {
  if (tool.mode === 'Launcher') return <span className="palette-item-badge badge-launcher">LAUNCHER</span>
  if (tool.mode === 'OneShot')  return <span className="palette-item-badge badge-oneshot">ONESHOT</span>
  return <span className="palette-item-badge badge-repl">REPL</span>
}
