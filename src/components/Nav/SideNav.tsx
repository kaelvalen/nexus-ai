import { useWindowStore } from '../../store/windowStore'
import { useSessionStore } from '../../store/sessionStore'
import { useCwdStore } from '../../store/cwdStore'
import { listTools, checkAllTools, spawnTool, isTauri, type ToolDef, type ToolAvailability } from '../../lib/tauri'
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
  } catch {
    return undefined
  }
}

interface Props {
  activeSection: string
  onSectionChange: (s: string) => void
  onOpenPalette: () => void
}

export function SideNav({ activeSection, onSectionChange, onOpenPalette }: Props) {
  const [tools, setTools] = useState<ToolDef[]>([])
  const [availability, setAvailability] = useState<Record<string, ToolAvailability>>({})
  const { windows, openWindow, focusWindow, restoreWindow } = useWindowStore()
  const { createSession, addMessage, sessions } = useSessionStore()
  const { cwd } = useCwdStore()

  useEffect(() => {
    const load = () =>
      listTools()
        .then((ts) => {
          setTools(ts)
          checkAllTools().then((avail) => {
            const map: Record<string, ToolAvailability> = {}
            avail.forEach((a) => { map[a.tool_id] = a })
            setAvailability(map)
          }).catch(() => {})
        })
        .catch(console.error)

    if (isTauri()) load()
    else { const t = setTimeout(load, 300); return () => clearTimeout(t) }
  }, [])

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
      return
    }

    createSession(sessionId, tool.id, tool.name)
    try {
      await spawnTool(sessionId, tool.id, binaryOverride, resolvedCwd, 24, 220)
    } catch (e) {
      addMessage(sessionId, 'tool', `[ERROR] Failed to spawn ${tool.name}: ${e}`)
      toast.error(`Failed to spawn ${tool.name}`, String(e))
    }

    const existing = windows.find((w) => w.id === windowId)
    if (existing) { restoreWindow(windowId); return }

    openWindow({
      id: windowId,
      title: tool.name,
      component: 'Terminal',
      props: { sessionId, toolId: tool.id },
      position: { x: 80 + Math.random() * 120, y: 40 + Math.random() * 80 },
      size: { width: 780, height: 520 },
    })

    onSectionChange('kernel')
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
      position: { x: 100, y: 50 },
      size: { width: 960, height: 640 },
    })
    onSectionChange('workflows')
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
      position: { x: 140, y: 70 },
      size: { width: 600, height: 480 },
    })
    onSectionChange('settings')
  }

  const activeSessions = Object.values(sessions).filter((s) => s.active)

  const NAV_ITEMS = [
    { id: 'kernel',   icon: 'terminal',        title: 'Terminal' },
    { id: 'code',     icon: 'code',             title: 'Code' },
    { id: 'git',      icon: 'account_tree',     title: 'Source Control' },
    { id: 'debug',    icon: 'bug_report',       title: 'Debugger' },
    { id: 'network',  icon: 'hub',              title: 'Network' },
    { id: 'telemetry',icon: 'monitoring',       title: 'Telemetry' },
  ]

  return (
    <nav className="side-nav" style={{ userSelect: 'none' }}>
      {/* Logo */}
      <div className="side-nav-logo">NX</div>

      {/* Top nav items */}
      <div className="side-nav-items">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`side-nav-item ${activeSection === item.id ? 'active' : ''}`}
            title={item.title}
            onClick={() => onSectionChange(item.id)}
          >
            <span className="mat">{item.icon}</span>
          </button>
        ))}

        {/* Tool launch buttons — one per non-launcher tool */}
        {tools.filter((t) => t.mode !== 'Launcher').length > 0 && (
          <div style={{ width: '100%', height: 1, background: 'var(--ghost)', margin: '6px 0' }} />
        )}
        {tools.filter((t) => t.mode !== 'Launcher').map((tool) => {
          const avail = availability[tool.id]
          const hasActive = Object.values(sessions).some((s) => s.toolId === tool.id && s.active)
          return (
            <button
              key={tool.id}
              className={`side-nav-item ${hasActive ? 'active' : ''}`}
              title={`${tool.name}${avail ? (avail.available ? ` — ${avail.resolved_path}` : ` — NOT FOUND`) : ''}`}
              onClick={() => launchTool(tool)}
              style={{ position: 'relative' }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{tool.icon}</span>
              {avail && (
                <span
                  className={`tool-avail-dot ${avail.available ? 'avail-ok' : 'avail-miss'}`}
                  style={{ position: 'absolute', bottom: 4, right: 4 }}
                />
              )}
              {hasActive && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--primary)',
                  boxShadow: '0 0 4px var(--primary)',
                }} />
              )}
            </button>
          )
        })}

        {/* Search / palette */}
        <div style={{ width: '100%', height: 1, background: 'var(--ghost)', margin: '6px 0' }} />
        <button
          className="side-nav-item"
          title="Command Palette (Ctrl+K)"
          onClick={onOpenPalette}
        >
          <span className="mat">search</span>
        </button>
      </div>

      {/* Bottom: workflow + settings */}
      <div className="side-nav-bottom">
        {/* Active session count indicator */}
        {activeSessions.length > 0 && (
          <div style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
            color: 'var(--primary)', marginBottom: 4, textAlign: 'center',
          }}>
            {activeSessions.length} LIVE
          </div>
        )}
        <button
          className={`side-nav-item ${activeSection === 'workflows' ? 'active' : ''}`}
          title="Workflow Editor"
          onClick={openWorkflowEditor}
        >
          <span className="mat">account_tree</span>
        </button>
        <button
          className={`side-nav-item ${activeSection === 'settings' ? 'active' : ''}`}
          title="Settings"
          onClick={openSettings}
        >
          <span className="mat">settings</span>
        </button>
      </div>
    </nav>
  )
}
