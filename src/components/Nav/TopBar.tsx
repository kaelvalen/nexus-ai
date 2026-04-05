import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { useCwdStore } from '../../store/cwdStore'

const TABS = [
  { id: 'kernel',    label: 'KERNEL' },
  { id: 'buffers',   label: 'BUFFERS' },
  { id: 'sessions',  label: 'SESSIONS' },
]

interface Props {
  activeTab: string
  onTabChange: (t: string) => void
  onOpenPalette: () => void
}

export function TopBar({ activeTab, onTabChange, onOpenPalette }: Props) {
  const [time, setTime] = useState(() => new Date())
  const { sessions } = useSessionStore()
  const { cwd, setCwd } = useCwdStore()

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const activeSessions = Object.values(sessions).filter((s) => s.active)
  const timeStr = time.toLocaleTimeString([], { hour12: false })

  const [editingCwd, setEditingCwd] = useState(false)
  const [cwdInput, setCwdInput] = useState('')
  const cwdInputRef = useRef<HTMLInputElement>(null)

  const openFolder = () => {
    setCwdInput(cwd === '~' ? '' : cwd)
    setEditingCwd(true)
    setTimeout(() => cwdInputRef.current?.select(), 30)
  }

  const commitCwd = () => {
    const val = cwdInput.trim()
    if (val) setCwd(val)
    setEditingCwd(false)
  }

  const cancelCwd = () => setEditingCwd(false)

  const cwdLabel = cwd === '~' ? '~' : cwd.split('/').filter(Boolean).pop() ?? cwd

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <span className="top-bar-logo">NEXUS_AI_OS</span>

        <nav className="top-bar-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`top-bar-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Open Folder */}
        {editingCwd ? (
          <div className="top-bar-folder-edit">
            <span className="mat mat-sm" style={{ color: 'var(--secondary)', flexShrink: 0 }}>folder_open</span>
            <input
              ref={cwdInputRef}
              className="top-bar-folder-input"
              value={cwdInput}
              onChange={(e) => setCwdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitCwd()
                if (e.key === 'Escape') cancelCwd()
              }}
              onBlur={commitCwd}
              placeholder="/path/to/project"
              spellCheck={false}
              autoFocus
            />
          </div>
        ) : (
          <button
            className="top-bar-folder-btn"
            onClick={openFolder}
            title={`Working directory: ${cwd}\nClick to change`}
          >
            <span className="mat mat-sm">folder_open</span>
            <span className="top-bar-folder-name">{cwdLabel}</span>
          </button>
        )}
      </div>

      <div className="top-bar-right">
        {activeSessions.length > 0 && (
          <div className="top-bar-stat" style={{ color: 'var(--primary)', borderLeft: '2px solid var(--primary)' }}>
            <span className="mat mat-sm">circle</span>
            <span>{activeSessions.length} LIVE</span>
          </div>
        )}

        <div className="top-bar-stat">
          <span className="mat mat-sm">schedule</span>
          <span>UTC {timeStr}</span>
        </div>

        <button
          className="top-bar-icon-btn"
          onClick={onOpenPalette}
          title="Command Palette (Ctrl+K)"
        >
          <span className="mat">search</span>
        </button>

        <button className="top-bar-icon-btn" title="Notifications">
          <span className="mat">notifications</span>
        </button>
      </div>
    </header>
  )
}
