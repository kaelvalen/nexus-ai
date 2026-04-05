import { useWindowStore } from '../../store/windowStore'
import { useSessionStore } from '../../store/sessionStore'
import { listTools, spawnTool, isTauri, type ToolDef } from '../../lib/tauri'
import { toast } from '../../store/toastStore'
import { useEffect, useState } from 'react'

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const getBinaryOverride = (toolId: string): string | undefined => {
  try {
    const saved = localStorage.getItem('nexus:binary-overrides')
    if (!saved) return undefined
    const overrides: { toolId: string; binary: string }[] = JSON.parse(saved)
    return overrides.find((o) => o.toolId === toolId)?.binary
  } catch { return undefined }
}

interface Props {
  onSectionChange: (s: string) => void
}

export function KernelPanel({ onSectionChange }: Props) {
  const [tools, setTools] = useState<ToolDef[]>([])
  const { windows, openWindow, focusWindow, restoreWindow, closeWindow, minimizeWindow } = useWindowStore()
  const { sessions, createSession, addMessage } = useSessionStore()

  useEffect(() => {
    const load = () => listTools().then(setTools).catch(console.error)
    if (isTauri()) load()
    else setTimeout(load, 300)
  }, [])

  const activeWindows = windows.filter((w) => !w.minimized)
  const allSessions = Object.values(sessions)
  const liveSessions = allSessions.filter((s) => s.active)

  const launchTool = async (tool: ToolDef) => {
    const sessionId = generateId()
    const windowId = `win-${sessionId}`
    const binaryOverride = getBinaryOverride(tool.id)

    if (tool.mode === 'Launcher') {
      try { await spawnTool(sessionId, tool.id, binaryOverride); toast.info(`Launched ${tool.name}`) }
      catch (e) { toast.error(`Failed to launch ${tool.name}`, String(e)) }
      return
    }

    createSession(sessionId, tool.id, tool.name)
    try { await spawnTool(sessionId, tool.id, binaryOverride, 24, 220) }
    catch (e) { addMessage(sessionId, 'tool', `[ERROR] ${e}`); toast.error(`Failed to spawn ${tool.name}`, String(e)) }

    openWindow({
      id: windowId, title: tool.name, component: 'Terminal',
      props: { sessionId, toolId: tool.id },
      position: { x: 80 + Math.random() * 120, y: 40 + Math.random() * 80 },
      size: { width: 780, height: 520 },
    })
  }

  return (
    <div className="section-panel">
      {/* Header */}
      <div className="section-header">
        <span className="section-title">// KERNEL</span>
        <span className="section-meta">{activeWindows.length} WINDOWS · {liveSessions.length} LIVE</span>
      </div>

      <div className="section-body">
        {/* Quick Launch */}
        <div className="panel-block">
          <div className="panel-block-label">QUICK_LAUNCH</div>
          <div className="tool-launch-grid">
            {tools.map((tool) => {
              const hasActive = allSessions.some((s) => s.toolId === tool.id && s.active)
              return (
                <button key={tool.id} className={`tool-card ${hasActive ? 'tool-card-active' : ''}`} onClick={() => launchTool(tool)}>
                  <span className="tool-card-icon">{tool.icon}</span>
                  <span className="tool-card-name">{tool.name.toUpperCase()}</span>
                  <span className="tool-card-mode">{tool.mode}</span>
                  {hasActive && <span className="tool-card-live-dot" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Active Windows */}
        {activeWindows.length > 0 && (
          <div className="panel-block">
            <div className="panel-block-label">ACTIVE_WINDOWS ({activeWindows.length})</div>
            <div className="window-list">
              {[...activeWindows].sort((a, b) => b.zIndex - a.zIndex).map((win) => (
                <div key={win.id} className="window-list-row">
                  <span className="mat mat-sm" style={{ color: 'var(--primary)' }}>crop_square</span>
                  <span className="window-list-title">{win.title.toUpperCase()}</span>
                  <span className="window-list-meta">{win.size.width}×{win.size.height}</span>
                  <div style={{ flex: 1 }} />
                  <button className="row-action-btn" onClick={() => focusWindow(win.id)} title="Focus">
                    <span className="mat mat-sm">open_in_full</span>
                  </button>
                  <button className="row-action-btn" onClick={() => minimizeWindow(win.id)} title="Minimize">
                    <span className="mat mat-sm">remove</span>
                  </button>
                  <button className="row-action-btn row-action-danger" onClick={() => closeWindow(win.id)} title="Close">
                    <span className="mat mat-sm">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Minimized */}
        {windows.filter(w => w.minimized).length > 0 && (
          <div className="panel-block">
            <div className="panel-block-label">MINIMIZED ({windows.filter(w => w.minimized).length})</div>
            <div className="window-list">
              {windows.filter(w => w.minimized).map((win) => (
                <div key={win.id} className="window-list-row" style={{ opacity: 0.6 }}>
                  <span className="mat mat-sm" style={{ color: 'var(--muted)' }}>minimize</span>
                  <span className="window-list-title">{win.title.toUpperCase()}</span>
                  <div style={{ flex: 1 }} />
                  <button className="row-action-btn" onClick={() => { restoreWindow(win.id); onSectionChange('kernel') }} title="Restore">
                    <span className="mat mat-sm">flip_to_front</span>
                  </button>
                  <button className="row-action-btn row-action-danger" onClick={() => closeWindow(win.id)} title="Close">
                    <span className="mat mat-sm">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeWindows.length === 0 && tools.length === 0 && (
          <div className="panel-empty">
            <span className="mat" style={{ fontSize: 40, color: 'var(--ghost)' }}>terminal</span>
            <div className="panel-empty-text">NO ACTIVE PROCESSES</div>
            <div className="panel-empty-hint">Select a tool above to launch a session</div>
          </div>
        )}
      </div>
    </div>
  )
}
