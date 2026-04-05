import { useSessionStore, type Session } from '../../store/sessionStore'
import { useWindowStore, type NexusWindow } from '../../store/windowStore'
import { killSession } from '../../lib/tauri'
import { toast } from '../../store/toastStore'

interface Props {
  onSectionChange: (s: string) => void
}

function formatAge(sessionId: string): string {
  const ts = parseInt(sessionId.split('-')[0])
  if (isNaN(ts)) return '—'
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

interface RowProps {
  s: Session
  win: NexusWindow | undefined
  onFocus: (id: string) => void
  onKill: (id: string) => void
  onRemove: (id: string) => void
}

function SessionRow({ s, win, onFocus, onKill, onRemove }: RowProps) {
  return (
    <div className={`session-row ${s.active ? 'session-row-live' : 'session-row-dead'}`}>
      <div className="session-row-left">
        <span className={`session-live-indicator ${s.active ? 'live' : 'dead'}`} />
        <div className="session-row-info">
          <span className="session-row-name">{s.toolName.toUpperCase()}</span>
          <span className="session-row-id">#{s.id.slice(0, 12)}</span>
        </div>
      </div>
      <div className="session-row-meta">
        <span className="session-meta-chip">{s.toolId}</span>
        <span className="session-meta-chip">{s.messages.length} MSGS</span>
        <span className="session-meta-chip">{formatAge(s.id)}</span>
        {win && <span className="session-meta-chip" style={{ color: 'var(--secondary)' }}>HAS_WINDOW</span>}
      </div>
      <div className="session-row-actions">
        {win && (
          <button className="row-action-btn" onClick={() => onFocus(s.id)} title="Focus window">
            <span className="mat mat-sm">open_in_full</span>
          </button>
        )}
        {s.active && (
          <button className="row-action-btn row-action-danger" onClick={() => onKill(s.id)} title="Kill session">
            <span className="mat mat-sm">stop_circle</span>
          </button>
        )}
        {!s.active && (
          <button className="row-action-btn" onClick={() => onRemove(s.id)} title="Remove from list">
            <span className="mat mat-sm">delete_outline</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function SessionsPanel({ onSectionChange }: Props) {
  const { sessions, removeSession } = useSessionStore()
  const { windows, focusWindow, restoreWindow } = useWindowStore()

  const allSessions = Object.values(sessions)
  const live = allSessions.filter((s) => s.active)
  const dead = allSessions.filter((s) => !s.active)

  const handleKill = async (sessionId: string) => {
    try {
      await killSession(sessionId)
      toast.warning('Session killed', sessionId.slice(0, 12))
    } catch (e) {
      toast.error('Kill failed', String(e))
    }
  }

  const handleFocus = (sessionId: string) => {
    const win = windows.find((w) => w.props.sessionId === sessionId)
    if (!win) return
    if (win.minimized) restoreWindow(win.id)
    focusWindow(win.id)
    onSectionChange('kernel')
  }

  return (
    <div className="section-panel">
      <div className="section-header">
        <span className="section-title">// SESSIONS</span>
        <span className="section-meta">{live.length} LIVE · {dead.length} DEAD · {allSessions.length} TOTAL</span>
      </div>

      <div className="section-body">
        {/* Stats row */}
        <div className="panel-stats-row">
          <div className="panel-stat-card">
            <span className="panel-stat-value" style={{ color: 'var(--primary)' }}>{live.length}</span>
            <span className="panel-stat-label">LIVE</span>
          </div>
          <div className="panel-stat-card">
            <span className="panel-stat-value">{dead.length}</span>
            <span className="panel-stat-label">ENDED</span>
          </div>
          <div className="panel-stat-card">
            <span className="panel-stat-value">{allSessions.length}</span>
            <span className="panel-stat-label">TOTAL</span>
          </div>
          <div className="panel-stat-card">
            <span className="panel-stat-value" style={{ color: 'var(--secondary)' }}>
              {allSessions.reduce((acc, s) => acc + s.messages.length, 0)}
            </span>
            <span className="panel-stat-label">MESSAGES</span>
          </div>
        </div>

        {/* Live sessions */}
        {live.length > 0 && (
          <div className="panel-block">
            <div className="panel-block-label">LIVE_SESSIONS</div>
            <div className="session-list">
              {live.map((s) => (
                <SessionRow
                  key={s.id}
                  s={s}
                  win={windows.find((w) => w.props.sessionId === s.id)}
                  onFocus={handleFocus}
                  onKill={handleKill}
                  onRemove={removeSession}
                />
              ))}
            </div>
          </div>
        )}

        {/* Dead sessions */}
        {dead.length > 0 && (
          <div className="panel-block">
            <div className="panel-block-label">ENDED_SESSIONS</div>
            <div className="session-list">
              {dead.map((s) => (
                <SessionRow
                  key={s.id}
                  s={s}
                  win={windows.find((w) => w.props.sessionId === s.id)}
                  onFocus={handleFocus}
                  onKill={handleKill}
                  onRemove={removeSession}
                />
              ))}
            </div>
          </div>
        )}

        {allSessions.length === 0 && (
          <div className="panel-empty">
            <span className="mat" style={{ fontSize: 40, color: 'var(--ghost)' }}>manage_history</span>
            <div className="panel-empty-text">NO SESSIONS</div>
            <div className="panel-empty-hint">Launch a tool to start a session</div>
          </div>
        )}
      </div>
    </div>
  )
}
