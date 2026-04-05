import { useEffect, useState } from 'react'
import { listTools, checkAllTools, checkToolAvailable, isTauri, type ToolDef, type ToolAvailability } from '../../lib/tauri'

export function NetworkPanel() {
  const [tools, setTools] = useState<ToolDef[]>([])
  const [availability, setAvailability] = useState<Record<string, ToolAvailability>>({})
  const [checking, setChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const runCheck = async () => {
    setChecking(true)
    try {
      const avail = await checkAllTools()
      const map: Record<string, ToolAvailability> = {}
      avail.forEach((a) => { map[a.tool_id] = a })
      setAvailability(map)
      setLastChecked(new Date())
    } catch {
      // in browser dev mode — individually check with null override
      const map: Record<string, ToolAvailability> = {}
      for (const t of tools) {
        try {
          const r = await checkToolAvailable(t.id)
          map[t.id] = r
        } catch {
          map[t.id] = { tool_id: t.id, available: false, resolved_path: null, error: 'check failed' }
        }
      }
      setAvailability(map)
      setLastChecked(new Date())
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    const load = () => listTools().then((ts) => { setTools(ts); }).catch(console.error)
    if (isTauri()) load()
    else setTimeout(load, 300)
  }, [])

  useEffect(() => {
    if (tools.length > 0) runCheck()
  }, [tools.length])

  const available = Object.values(availability).filter((a) => a.available)
  const missing = Object.values(availability).filter((a) => !a.available)

  return (
    <div className="section-panel">
      <div className="section-header">
        <span className="section-title">// NETWORK</span>
        <span className="section-meta">
          {available.length}/{tools.length} TOOLS AVAILABLE
          {lastChecked && ` · CHECKED ${lastChecked.toLocaleTimeString([], { hour12: false })}`}
        </span>
        <button
          className="section-header-btn"
          onClick={runCheck}
          disabled={checking}
          title="Re-check all tools"
        >
          <span className="mat mat-sm">{checking ? 'sync' : 'refresh'}</span>
          {checking ? 'CHECKING…' : 'RECHECK'}
        </button>
      </div>

      <div className="section-body">
        {/* Availability Matrix */}
        <div className="panel-block">
          <div className="panel-block-label">TOOL_AVAILABILITY_MATRIX</div>
          <div className="network-matrix">
            {tools.map((tool) => {
              const avail = availability[tool.id]
              const status = !avail ? 'unknown' : avail.available ? 'ok' : 'miss'
              return (
                <div key={tool.id} className={`network-row network-row-${status}`}>
                  <span className={`network-status-dot dot-${status}`} />
                  <span className="network-tool-icon">{tool.icon}</span>
                  <div className="network-tool-info">
                    <span className="network-tool-name">{tool.name.toUpperCase()}</span>
                    <span className="network-tool-binary">{tool.binary}</span>
                  </div>
                  <div className="network-tool-meta">
                    <span className={`network-badge badge-${status}`}>
                      {!avail ? 'PENDING' : avail.available ? 'FOUND' : 'MISSING'}
                    </span>
                    <span className="network-mode-badge">{tool.mode.toUpperCase()}</span>
                  </div>
                  <div className="network-path">
                    {avail?.available
                      ? <span style={{ color: 'var(--primary)', fontSize: 9 }}>{avail.resolved_path}</span>
                      : avail?.error
                      ? <span style={{ color: 'var(--error)', fontSize: 9 }}>{avail.error}</span>
                      : <span style={{ color: 'var(--muted)', fontSize: 9 }}>—</span>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="panel-block">
          <div className="panel-block-label">CONNECTIVITY_SUMMARY</div>
          <div className="panel-stats-row">
            <div className="panel-stat-card">
              <span className="panel-stat-value" style={{ color: 'var(--primary)' }}>{available.length}</span>
              <span className="panel-stat-label">AVAILABLE</span>
            </div>
            <div className="panel-stat-card">
              <span className="panel-stat-value" style={{ color: 'var(--error)' }}>{missing.length}</span>
              <span className="panel-stat-label">MISSING</span>
            </div>
            <div className="panel-stat-card">
              <span className="panel-stat-value">{tools.length}</span>
              <span className="panel-stat-label">TOTAL</span>
            </div>
            <div className="panel-stat-card">
              <span className="panel-stat-value" style={{ color: tools.length > 0 ? (available.length / tools.length > 0.5 ? 'var(--primary)' : 'var(--error)') : 'var(--muted)' }}>
                {tools.length > 0 ? Math.round((available.length / tools.length) * 100) : 0}%
              </span>
              <span className="panel-stat-label">COVERAGE</span>
            </div>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="panel-block">
            <div className="panel-block-label" style={{ color: 'var(--error)' }}>MISSING_BINARIES</div>
            <div className="missing-list">
              {missing.map((a) => {
                const tool = tools.find((t) => t.id === a.tool_id)
                return (
                  <div key={a.tool_id} className="missing-row">
                    <span className="mat mat-sm" style={{ color: 'var(--error)' }}>error_outline</span>
                    <span style={{ color: 'var(--text)', fontSize: 11 }}>{tool?.binary ?? a.tool_id}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 9, marginLeft: 8 }}>
                      Install or configure a binary override in Settings
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
