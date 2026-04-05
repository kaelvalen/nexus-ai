import { useEffect, useState } from 'react'
import { useSessionStore } from '../../store/sessionStore'

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

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const activeSessions = Object.values(sessions).filter((s) => s.active)
  const timeStr = time.toLocaleTimeString([], { hour12: false })

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
