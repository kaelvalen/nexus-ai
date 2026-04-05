import { useEffect, useState } from 'react'
import { useWindowStore } from '../../store/windowStore'
import { useSessionStore } from '../../store/sessionStore'
import { listTools, spawnTool, killSession, isTauri, type ToolDef } from '../../lib/tauri'
import { toast } from '../../store/toastStore'

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="taskbar-section-label">{children}</div>
}

interface TaskbarProps {
  onOpenPalette: () => void
}

export function Taskbar({ onOpenPalette }: TaskbarProps) {
  const [tools, setTools] = useState<ToolDef[]>([])
  const [toolsError, setToolsError] = useState<string | null>(null)
  const { windows, openWindow, focusWindow, restoreWindow, closeWindow } = useWindowStore()
  const { createSession, addMessage, sessions, setActive, removeSession } = useSessionStore()

  useEffect(() => {
    const load = () =>
      listTools()
        .then(setTools)
        .catch((e) => {
          console.error('listTools failed:', e)
          setToolsError(String(e))
        })

    if (isTauri()) {
      load()
    } else {
      const t = setTimeout(load, 300)
      return () => clearTimeout(t)
    }
  }, [])

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
      return
    }

    createSession(sessionId, tool.id, tool.name)

    try {
      await spawnTool(sessionId, tool.id, binaryOverride)
    } catch (e) {
      addMessage(sessionId, 'tool', `[ERROR] Failed to spawn ${tool.name}: ${e}`)
      toast.error(`Failed to spawn ${tool.name}`, String(e))
    }

    const existing = windows.find((w) => w.id === windowId)
    if (existing) {
      restoreWindow(windowId)
      return
    }

    openWindow({
      id: windowId,
      title: tool.name,
      component: 'Terminal',
      props: { sessionId, toolId: tool.id },
      position: {
        x: 80 + Math.random() * 120,
        y: 40 + Math.random() * 80,
      },
      size: { width: 740, height: 500 },
    })
  }

  const focusSessionWindow = (sessionId: string) => {
    const win = windows.find(
      (w) => w.component === 'Terminal' && w.props.sessionId === sessionId
    )
    if (!win) return
    if (win.minimized) restoreWindow(win.id)
    else focusWindow(win.id)
  }

  const closeSession = (sessionId: string) => {
    killSession(sessionId).catch(() => {})
    setActive(sessionId, false)
    const win = windows.find(
      (w) => w.component === 'Terminal' && w.props.sessionId === sessionId
    )
    if (win) closeWindow(win.id)
    removeSession(sessionId)
  }

  const openWorkflowEditor = () => {
    const id = 'workflow-editor'
    const existing = windows.find((w) => w.id === id)
    if (existing) {
      if (existing.minimized) restoreWindow(id)
      else focusWindow(id)
      return
    }
    openWindow({
      id,
      title: 'Workflow Editor',
      component: 'WorkflowEditor',
      props: {},
      position: { x: 120, y: 60 },
      size: { width: 960, height: 640 },
    })
  }

  const openSettings = () => {
    const id = 'settings'
    const existing = windows.find((w) => w.id === id)
    if (existing) {
      if (existing.minimized) restoreWindow(id)
      else focusWindow(id)
      return
    }
    openWindow({
      id,
      title: 'Settings',
      component: 'Settings',
      props: {},
      position: { x: 160, y: 80 },
      size: { width: 580, height: 460 },
    })
  }

  const minimizedWindows = windows.filter((w) => w.minimized)
  const allSessions = Object.values(sessions)

  const repl = tools.filter((t) => t.mode === 'Repl' || t.mode === 'OneShot')
  const launchers = tools.filter((t) => t.mode === 'Launcher')

  return (
    <aside className="taskbar flex flex-col py-3 gap-0">
      {/* Logo */}
      <div className="taskbar-logo px-3 mb-2">
        <span className="text-primary font-black tracking-tighter" style={{ fontSize: 15 }}>NEXUS</span>
      </div>

      {/* Command palette trigger */}
      <div className="px-2 mb-2">
        <button
          className="taskbar-search-btn"
          onClick={onOpenPalette}
          title="Open Command Palette (Ctrl+K)"
        >
          <span style={{ fontSize: 11, opacity: 0.6 }}>⌕</span>
          <span>Search…</span>
          <span className="taskbar-search-kbd">^K</span>
        </button>
      </div>

      {/* Error */}
      {toolsError && (
        <div
          className="mx-2 mb-2 px-2 py-1 rounded text-xs cursor-pointer"
          style={{ background: 'rgba(255,68,68,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,68,68,0.3)' }}
          title={toolsError}
          onClick={() => listTools().then(setTools).catch(() => {})}
        >
          ⚠ Load error
        </div>
      )}

      {/* AI Tools */}
      {repl.length > 0 && (
        <>
          <SectionLabel>AI Tools</SectionLabel>
          <div className="flex flex-col gap-0.5 px-2 mb-1">
            {repl.map((tool) => {
              const toolSessions = allSessions.filter((s) => s.toolId === tool.id)
              const activeSessions = toolSessions.filter((s) => s.active)
              return (
                <div key={tool.id}>
                  <button
                    className="taskbar-btn w-full"
                    onClick={() => launchTool(tool)}
                    title={`New ${tool.name} session`}
                  >
                    <span className="tool-icon">{tool.icon}</span>
                    <span className="tool-label flex-1 text-left">{tool.name}</span>
                    {activeSessions.length > 0 && (
                      <span className="session-badge">{activeSessions.length}</span>
                    )}
                    <span className="tool-launch-arrow" style={{ fontSize: 9, opacity: 0.4 }}>+</span>
                  </button>
                  {toolSessions.length > 0 && (
                    <div className="flex flex-col gap-0 pl-3 pr-1 mb-1">
                      {toolSessions.map((s) => (
                        <div key={s.id} className="session-item group">
                          <button
                            className="session-item-main"
                            onClick={() => focusSessionWindow(s.id)}
                            title={`Focus session ${s.id.slice(0, 8)}`}
                          >
                            <span className={`session-item-dot ${s.active ? 'dot-active' : 'dot-dead'}`} />
                            <span className="session-item-id">#{s.id.slice(0, 6)}</span>
                            <span className="session-item-status">{s.active ? 'live' : 'ended'}</span>
                          </button>
                          <button
                            className="session-close-btn"
                            onClick={(e) => { e.stopPropagation(); closeSession(s.id) }}
                            title="Close session"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Launchers */}
      {launchers.length > 0 && (
        <>
          <SectionLabel>Editors</SectionLabel>
          <div className="flex flex-col gap-0.5 px-2 mb-1">
            {launchers.map((tool) => (
              <button
                key={tool.id}
                className="taskbar-btn w-full"
                onClick={() => launchTool(tool)}
                title={`Open ${tool.name}`}
              >
                <span className="tool-icon">{tool.icon}</span>
                <span className="tool-label flex-1 text-left">{tool.name}</span>
                <span className="tool-launch-arrow">↗</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Minimized windows */}
      {minimizedWindows.length > 0 && (
        <>
          <SectionLabel>Minimized</SectionLabel>
          <div className="flex flex-col gap-0.5 px-2 mb-1">
            {minimizedWindows.map((win) => (
              <button
                key={win.id}
                className="taskbar-btn w-full"
                onClick={() => restoreWindow(win.id)}
                title={`Restore: ${win.title}`}
              >
                <span className="tool-icon" style={{ fontSize: 11 }}>▣</span>
                <span className="tool-label flex-1 text-left truncate">{win.title}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Bottom actions */}
      <div className="flex flex-col gap-0.5 px-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          className="taskbar-btn w-full"
          onClick={openWorkflowEditor}
          title="Open Workflow Editor"
        >
          <span className="tool-icon">⇝</span>
          <span className="tool-label flex-1 text-left">Workflow</span>
        </button>
        <button
          className="taskbar-btn w-full"
          onClick={openSettings}
          title="Open Settings"
        >
          <span className="tool-icon">⚙</span>
          <span className="tool-label flex-1 text-left">Settings</span>
        </button>
      </div>
    </aside>
  )
}
