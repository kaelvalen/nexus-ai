import { useEffect, useState } from 'react'
import { useWindowStore } from '../../store/windowStore'
import { useSessionStore } from '../../store/sessionStore'
import { listTools, spawnTool, type ToolDef } from '../../lib/tauri'
import { onToolOutput, onToolExit } from '../../lib/tauri'

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function Taskbar() {
  const [tools, setTools] = useState<ToolDef[]>([])
  const { windows, openWindow, restoreWindow } = useWindowStore()
  const { createSession, addMessage, appendToLastToolMessage, setActive, sessions } =
    useSessionStore()

  useEffect(() => {
    listTools().then(setTools).catch(console.error)
  }, [])

  // Global event listeners for tool output/exit
  useEffect(() => {
    let unlistenOutput: (() => void) | null = null
    let unlistenExit: (() => void) | null = null

    onToolOutput((event) => {
      appendToLastToolMessage(event.session_id, event.data)
    }).then((fn) => { unlistenOutput = fn })

    onToolExit((event) => {
      setActive(event.session_id, false)
    }).then((fn) => { unlistenExit = fn })

    return () => {
      unlistenOutput?.()
      unlistenExit?.()
    }
  }, [appendToLastToolMessage, setActive])

  const launchTool = async (tool: ToolDef) => {
    const sessionId = generateId()
    const windowId = `win-${sessionId}`

    createSession(sessionId, tool.id, tool.name)

    if (tool.mode !== 'Launcher') {
      try {
        await spawnTool(sessionId, tool.id)
      } catch (e) {
        addMessage(sessionId, 'tool', `[ERROR] Failed to spawn ${tool.name}: ${e}`)
      }
    }

    const existing = windows.find((w) => w.id === windowId)
    if (existing) {
      restoreWindow(windowId)
      return
    }

    openWindow({
      id: windowId,
      title: `${tool.name} — ${sessionId.slice(0, 6)}`,
      component: 'Terminal',
      props: { sessionId, toolId: tool.id },
      position: {
        x: 80 + Math.random() * 80,
        y: 40 + Math.random() * 60,
      },
      size: { width: 700, height: 480 },
    })
  }

  const openWorkflowEditor = () => {
    const id = 'workflow-editor'
    const existing = windows.find((w) => w.id === id)
    if (existing) {
      restoreWindow(id)
      return
    }
    openWindow({
      id,
      title: 'Workflow Editor',
      component: 'WorkflowEditor',
      props: {},
      position: { x: 120, y: 60 },
      size: { width: 900, height: 600 },
    })
  }

  const openSettings = () => {
    const id = 'settings'
    const existing = windows.find((w) => w.id === id)
    if (existing) {
      restoreWindow(id)
      return
    }
    openWindow({
      id,
      title: 'Settings',
      component: 'Settings',
      props: {},
      position: { x: 160, y: 80 },
      size: { width: 560, height: 420 },
    })
  }

  // Minimized windows
  const minimizedWindows = windows.filter((w) => w.minimized)

  // Active sessions count per tool
  const activeSessions = Object.values(sessions).filter((s) => s.active)

  return (
    <aside className="taskbar flex flex-col items-center py-4 gap-2">
      {/* Logo */}
      <div className="taskbar-logo mb-4">
        <span className="text-primary font-black text-lg tracking-tighter">NX</span>
      </div>

      {/* Tool buttons */}
      <div className="flex flex-col gap-1 w-full px-2">
        {tools.map((tool) => {
          const toolSessions = activeSessions.filter((s) => s.toolId === tool.id)
          return (
            <button
              key={tool.id}
              className="taskbar-btn group relative"
              onClick={() => launchTool(tool)}
              title={tool.name}
            >
              <span className="tool-icon">{tool.icon}</span>
              <span className="tool-label">{tool.name}</span>
              {toolSessions.length > 0 && (
                <span className="session-dot" />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1" />

      {/* Minimized windows */}
      {minimizedWindows.length > 0 && (
        <div className="flex flex-col gap-1 w-full px-2 mb-2">
          <div className="text-muted text-xs text-center mb-1">MIN</div>
          {minimizedWindows.map((win) => (
            <button
              key={win.id}
              className="taskbar-btn group"
              onClick={() => restoreWindow(win.id)}
              title={win.title}
            >
              <span className="tool-icon">▣</span>
              <span className="tool-label truncate">{win.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Workflow editor */}
      <button
        className="taskbar-btn group w-full px-2"
        onClick={openWorkflowEditor}
        title="Workflow Editor"
      >
        <span className="tool-icon">⇝</span>
        <span className="tool-label">Workflow</span>
      </button>

      {/* Settings */}
      <button
        className="taskbar-btn group w-full px-2 mt-1"
        onClick={openSettings}
        title="Settings"
      >
        <span className="tool-icon">⚙</span>
        <span className="tool-label">Settings</span>
      </button>
    </aside>
  )
}
