import { useEffect, useState } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { useWindowStore } from '../../store/windowStore'
import { useWorkflowStore } from '../../store/workflowStore'

interface Metric {
  label: string
  value: string | number
  unit?: string
  color?: string
}

export function TelemetryPanel() {
  const { sessions } = useSessionStore()
  const { windows } = useWindowStore()
  const { runs, nodes } = useWorkflowStore()
  const [uptime, setUptime] = useState(0)
  const [startTime] = useState(() => Date.now())
  const [messageRate, setMessageRate] = useState(0)
  const [prevMsgCount, setPrevMsgCount] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setUptime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [startTime])

  // Message throughput rate (msgs/sec over last 5s)
  useEffect(() => {
    const id = setInterval(() => {
      const total = Object.values(sessions).reduce((a, s) => a + s.messages.length, 0)
      setMessageRate(Math.max(0, total - prevMsgCount))
      setPrevMsgCount(total)
    }, 5000)
    return () => clearInterval(id)
  }, [sessions, prevMsgCount])

  const allSessions = Object.values(sessions)
  const liveSessions = allSessions.filter((s) => s.active)
  const totalMessages = allSessions.reduce((a, s) => a + s.messages.length, 0)
  const allRuns = Object.values(runs)
  const completedRuns = allRuns.filter((r) => r.complete && !r.error)
  const failedRuns = allRuns.filter((r) => r.complete && !!r.error)

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
  }

  const metrics: Metric[] = [
    { label: 'UPTIME',          value: formatUptime(uptime),       color: 'var(--primary)' },
    { label: 'LIVE_SESSIONS',   value: liveSessions.length,         color: liveSessions.length > 0 ? 'var(--primary)' : 'var(--muted)' },
    { label: 'TOTAL_SESSIONS',  value: allSessions.length },
    { label: 'TOTAL_MESSAGES',  value: totalMessages,               color: 'var(--secondary)' },
    { label: 'MSG_RATE',        value: messageRate, unit: '/5s' },
    { label: 'OPEN_WINDOWS',    value: windows.filter(w => !w.minimized).length },
    { label: 'TOTAL_WINDOWS',   value: windows.length },
    { label: 'WORKFLOW_NODES',  value: nodes.length },
    { label: 'WORKFLOW_RUNS',   value: allRuns.length },
    { label: 'RUNS_OK',         value: completedRuns.length,        color: 'var(--primary)' },
    { label: 'RUNS_FAILED',     value: failedRuns.length,           color: failedRuns.length > 0 ? 'var(--error)' : 'var(--muted)' },
  ]

  // Per-tool breakdown
  const toolBreakdown = allSessions.reduce<Record<string, { count: number; live: number; messages: number }>>((acc, s) => {
    if (!acc[s.toolId]) acc[s.toolId] = { count: 0, live: 0, messages: 0 }
    acc[s.toolId].count++
    if (s.active) acc[s.toolId].live++
    acc[s.toolId].messages += s.messages.length
    return acc
  }, {})

  return (
    <div className="section-panel">
      <div className="section-header">
        <span className="section-title">// TELEMETRY</span>
        <span className="section-meta">UPTIME {formatUptime(uptime)}</span>
      </div>

      <div className="section-body">
        {/* Metric grid */}
        <div className="panel-block">
          <div className="panel-block-label">SYSTEM_METRICS</div>
          <div className="telemetry-grid">
            {metrics.map((m) => (
              <div key={m.label} className="telemetry-metric">
                <span className="telemetry-metric-value" style={{ color: m.color ?? 'var(--text)' }}>
                  {m.value}{m.unit ?? ''}
                </span>
                <span className="telemetry-metric-label">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live process bars */}
        {liveSessions.length > 0 && (
          <div className="panel-block">
            <div className="panel-block-label">LIVE_PROCESSES</div>
            <div className="process-list">
              {liveSessions.map((s) => (
                <div key={s.id} className="process-row">
                  <div className="process-indicator" />
                  <span className="process-name">{s.toolName.toUpperCase()}</span>
                  <span className="process-pid">#{s.id.slice(0, 12)}</span>
                  <div className="process-bar-track">
                    <div
                      className="process-bar-fill"
                      style={{ width: `${Math.min(100, (s.messages.length / Math.max(1, totalMessages)) * 100)}%` }}
                    />
                  </div>
                  <span className="process-msgs">{s.messages.length} MSGS</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-tool breakdown */}
        {Object.keys(toolBreakdown).length > 0 && (
          <div className="panel-block">
            <div className="panel-block-label">TOOL_BREAKDOWN</div>
            <div className="telemetry-table">
              <div className="telemetry-table-head">
                <span>TOOL</span>
                <span>SESSIONS</span>
                <span>LIVE</span>
                <span>MESSAGES</span>
              </div>
              {Object.entries(toolBreakdown).map(([toolId, stats]) => (
                <div key={toolId} className="telemetry-table-row">
                  <span style={{ color: 'var(--text)', fontSize: 10 }}>{toolId}</span>
                  <span>{stats.count}</span>
                  <span style={{ color: stats.live > 0 ? 'var(--primary)' : 'var(--muted)' }}>{stats.live}</span>
                  <span style={{ color: 'var(--secondary)' }}>{stats.messages}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workflow run history */}
        {allRuns.length > 0 && (
          <div className="panel-block">
            <div className="panel-block-label">WORKFLOW_HISTORY</div>
            <div className="run-history-list">
              {[...allRuns].reverse().slice(0, 10).map((run) => {
                const st = !run.complete ? 'running' : run.error ? 'failed' : 'complete'
                return (
                  <div key={run.id} className="run-history-row">
                    <span className={`run-status-dot run-${st}`} />
                    <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>#{run.id.slice(0,10)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text)', marginLeft: 8 }}>{st.toUpperCase()}</span>
                    <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 'auto' }}>{run.steps.length} STEPS</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {allSessions.length === 0 && allRuns.length === 0 && (
          <div className="panel-empty">
            <span className="mat" style={{ fontSize: 40, color: 'var(--ghost)' }}>monitoring</span>
            <div className="panel-empty-text">NO DATA YET</div>
            <div className="panel-empty-hint">Metrics will populate as you use the system</div>
          </div>
        )}
      </div>
    </div>
  )
}
