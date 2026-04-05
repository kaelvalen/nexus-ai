import { useEffect, useState } from 'react'
import type { Session } from '../../store/sessionStore'
import type { NexusWindow } from '../../store/windowStore'

interface Props {
  sessions: Record<string, Session>
  windows: NexusWindow[]
  onOpenPalette: () => void
}

export function StatusBar({ sessions, windows, onOpenPalette }: Props) {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const allSessions = Object.values(sessions)
  const activeSessions = allSessions.filter((s) => s.active)
  const openWindows = windows.filter((w) => !w.minimized)

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="status-bar">
      {/* Left — shortcuts hint */}
      <div className="status-section">
        <button className="status-palette-btn" onClick={onOpenPalette} title="Open Command Palette">
          <span className="status-icon">⌕</span>
          <span className="status-kbd">Ctrl+K</span>
        </button>
        <span className="status-sep">·</span>
        <span className="status-item" title="Ctrl+Tab to cycle">
          <span className="status-icon">◈</span>
          <span>{openWindows.length} window{openWindows.length !== 1 ? 's' : ''}</span>
        </span>
      </div>

      {/* Center — version */}
      <div className="status-center">
        <span className="status-brand">NEXUS</span>
        <span className="status-version">v0.1.0</span>
      </div>

      {/* Right — session count + clock */}
      <div className="status-section">
        <span className={`status-item ${activeSessions.length > 0 ? 'status-item-live' : ''}`} title="Active AI sessions">
          <span className={`status-dot ${activeSessions.length > 0 ? 'status-dot-live' : ''}`} />
          <span>{activeSessions.length} live</span>
        </span>
        <span className="status-sep">·</span>
        <span className="status-item">
          <span className="status-date">{dateStr}</span>
          <span className="status-time">{timeStr}</span>
        </span>
      </div>
    </div>
  )
}
