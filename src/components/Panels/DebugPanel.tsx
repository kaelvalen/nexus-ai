import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { onToolOutput, onToolExit } from '../../lib/tauri'

interface EventEntry {
  id: string
  ts: number
  type: 'output' | 'exit' | 'spawn' | 'kill'
  sessionId: string
  toolName: string
  data: string
}

export function DebugPanel() {
  const { sessions } = useSessionStore()
  const [events, setEvents] = useState<EventEntry[]>([])
  const [filter, setFilter] = useState('')
  const [selectedSession, setSelectedSession] = useState<string>('all')
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const logRef = useRef<HTMLDivElement>(null)

  const allSessions = Object.values(sessions)

  const addEvent = (entry: EventEntry) => {
    if (pausedRef.current) return
    setEvents((prev) => [...prev.slice(-499), entry])
  }

  useEffect(() => {
    let unOutput: (() => void) | null = null
    let unExit: (() => void) | null = null

    onToolOutput((e) => {
      const sess = sessions[e.session_id]
      addEvent({
        id: `${Date.now()}-${Math.random()}`,
        ts: Date.now(),
        type: 'output',
        sessionId: e.session_id,
        toolName: sess?.toolName ?? e.session_id.slice(0, 8),
        data: e.data.replace(/\r?\n/g, '↵').slice(0, 200),
      })
    }).then((fn) => { unOutput = fn })

    onToolExit((e) => {
      const sess = sessions[e.session_id]
      addEvent({
        id: `${Date.now()}-${Math.random()}`,
        ts: Date.now(),
        type: 'exit',
        sessionId: e.session_id,
        toolName: sess?.toolName ?? e.session_id.slice(0, 8),
        data: `exit code: ${e.code ?? 'null'}`,
      })
    }).then((fn) => { unExit = fn })

    return () => { unOutput?.(); unExit?.() }
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (!paused && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events, paused])

  const filtered = events.filter((e) => {
    if (selectedSession !== 'all' && e.sessionId !== selectedSession) return false
    if (filter && !e.data.toLowerCase().includes(filter.toLowerCase()) && !e.toolName.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  const typeColor: Record<string, string> = {
    output: 'var(--text-dim)',
    exit:   'var(--tertiary)',
    spawn:  'var(--primary)',
    kill:   'var(--error)',
  }

  const typeIcon: Record<string, string> = {
    output: 'arrow_forward',
    exit:   'logout',
    spawn:  'play_circle',
    kill:   'cancel',
  }

  return (
    <div className="section-panel">
      <div className="section-header">
        <span className="section-title">// DEBUG</span>
        <span className="section-meta">{filtered.length}/{events.length} EVENTS</span>
        <div style={{ flex: 1 }} />
        <button className="section-header-btn" onClick={() => setPaused((v) => !v)} title={paused ? 'Resume' : 'Pause'}>
          <span className="mat mat-sm">{paused ? 'play_arrow' : 'pause'}</span>
          {paused ? 'RESUME' : 'PAUSE'}
        </button>
        <button className="section-header-btn" onClick={() => setEvents([])} title="Clear events">
          <span className="mat mat-sm">delete_sweep</span>
          CLEAR
        </button>
      </div>

      {/* Filters */}
      <div className="debug-filter-bar">
        <span className="mat mat-sm" style={{ color: 'var(--muted)' }}>filter_list</span>
        <input
          className="debug-filter-input"
          placeholder="Filter events…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="debug-session-select"
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
        >
          <option value="all">ALL SESSIONS</option>
          {allSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.toolName.toUpperCase()} #{s.id.slice(0, 8)}
            </option>
          ))}
        </select>
        {paused && (
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--tertiary)', letterSpacing: '0.1em' }}>
            ⏸ PAUSED
          </span>
        )}
      </div>

      {/* Event stream */}
      <div className="debug-log" ref={logRef}>
        {filtered.length === 0 && (
          <div className="panel-empty" style={{ minHeight: 120 }}>
            <span className="mat" style={{ fontSize: 32, color: 'var(--ghost)' }}>stream</span>
            <div className="panel-empty-text">NO EVENTS YET</div>
            <div className="panel-empty-hint">Events will appear as tools run</div>
          </div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="debug-event-row">
            <span className="debug-event-ts">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}</span>
            <span className="mat mat-sm debug-event-icon" style={{ color: typeColor[e.type] }}>
              {typeIcon[e.type]}
            </span>
            <span className="debug-event-session">{e.toolName.toUpperCase()}</span>
            <span className="debug-event-sid">#{e.sessionId.slice(0, 8)}</span>
            <span className="debug-event-data" style={{ color: typeColor[e.type] }}>{e.data}</span>
          </div>
        ))}
      </div>

      {/* Session message logs */}
      {selectedSession !== 'all' && sessions[selectedSession] && (
        <div className="panel-block" style={{ borderTop: '1px solid var(--ghost)', padding: '12px 20px' }}>
          <div className="panel-block-label">MESSAGE_LOG — {sessions[selectedSession].toolName.toUpperCase()}</div>
          <div className="debug-msg-log">
            {sessions[selectedSession].messages.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 10 }}>No messages in store</div>
              : sessions[selectedSession].messages.slice(-50).map((m) => (
                <div key={m.id} className={`debug-msg-row debug-msg-${m.role}`}>
                  <span className="debug-msg-role">{m.role.toUpperCase()}</span>
                  <span className="debug-msg-content">{m.content.slice(0, 300)}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
