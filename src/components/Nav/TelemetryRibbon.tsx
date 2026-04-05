import { useEffect, useState } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { useWindowStore } from '../../store/windowStore'

export function TelemetryRibbon() {
  const [time, setTime] = useState(() => new Date())
  const { sessions } = useSessionStore()
  const { windows } = useWindowStore()

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const allSessions = Object.values(sessions)
  const activeSessions = allSessions.filter((s) => s.active)
  const openWindows = windows.filter((w) => !w.minimized)
  const timeStr = time.toLocaleTimeString([], { hour12: false })

  return (
    <footer className="telemetry-ribbon">
      <div className="ribbon-left">
        <span className="ribbon-item ribbon-ok">SYS_OK_V2.0</span>
        <span className="ribbon-sep">·</span>
        <span className="ribbon-item">
          SESSIONS: {activeSessions.length}/{allSessions.length}
        </span>
        <span className="ribbon-sep">·</span>
        <span className="ribbon-item">
          WINDOWS: {openWindows.length}
        </span>
        {activeSessions.length > 0 && (
          <>
            <span className="ribbon-sep">·</span>
            <span className="ribbon-item ribbon-cyan">
              {activeSessions.map((s) => s.toolName).join(', ')} ACTIVE
            </span>
          </>
        )}
      </div>

      <div className="ribbon-right">
        <span className="ribbon-item ribbon-warn">SECURITY_LEVEL: 4</span>
        <span className="ribbon-sep">·</span>
        <span className="ribbon-item">NEXUS v0.1.0</span>
        <span className="ribbon-sep">·</span>
        <span className="ribbon-item">UTC {timeStr}</span>
      </div>
    </footer>
  )
}
