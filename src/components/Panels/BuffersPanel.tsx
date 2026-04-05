import { useWindowStore } from '../../store/windowStore'

interface Props {
  onSectionChange: (s: string) => void
}

export function BuffersPanel({ onSectionChange }: Props) {
  const { windows, restoreWindow, closeWindow, focusWindow } = useWindowStore()

  const minimized = windows.filter((w) => w.minimized)
  const visible   = windows.filter((w) => !w.minimized)

  const restoreAndFocus = (id: string) => {
    restoreWindow(id)
    focusWindow(id)
    onSectionChange('kernel')
  }

  return (
    <div className="section-panel">
      <div className="section-header">
        <span className="section-title">// BUFFERS</span>
        <span className="section-meta">{windows.length} TOTAL · {minimized.length} MINIMIZED · {visible.length} VISIBLE</span>
      </div>

      <div className="section-body">
        {/* Minimized buffers */}
        {minimized.length > 0 && (
          <div className="panel-block">
            <div className="panel-block-label">BACKGROUNDED ({minimized.length})</div>
            <div className="buffer-grid">
              {minimized.map((win) => (
                <div key={win.id} className="buffer-card">
                  <div className="buffer-card-header">
                    <span className="mat mat-sm" style={{ color: 'var(--muted)' }}>minimize</span>
                    <span className="buffer-card-title">{win.title.toUpperCase()}</span>
                    <div style={{ flex: 1 }} />
                    <button className="row-action-btn row-action-danger" onClick={() => closeWindow(win.id)} title="Close">
                      <span className="mat mat-sm">close</span>
                    </button>
                  </div>
                  <div className="buffer-card-meta">
                    <span>{win.component.toUpperCase()}</span>
                    <span>{win.size.width}×{win.size.height}px</span>
                  </div>
                  <button className="buffer-restore-btn" onClick={() => restoreAndFocus(win.id)}>
                    <span className="mat mat-sm">flip_to_front</span>
                    RESTORE
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visible windows */}
        {visible.length > 0 && (
          <div className="panel-block">
            <div className="panel-block-label">VISIBLE ({visible.length})</div>
            <div className="buffer-grid">
              {[...visible].sort((a, b) => b.zIndex - a.zIndex).map((win, idx) => (
                <div key={win.id} className="buffer-card buffer-card-visible">
                  <div className="buffer-card-header">
                    <span className="mat mat-sm" style={{ color: 'var(--primary)' }}>crop_square</span>
                    <span className="buffer-card-title">{win.title.toUpperCase()}</span>
                    {idx === 0 && <span className="buffer-focused-badge">FOCUSED</span>}
                    <div style={{ flex: 1 }} />
                    <button className="row-action-btn row-action-danger" onClick={() => closeWindow(win.id)} title="Close">
                      <span className="mat mat-sm">close</span>
                    </button>
                  </div>
                  <div className="buffer-card-meta">
                    <span>{win.component.toUpperCase()}</span>
                    <span>Z:{win.zIndex}</span>
                    <span>{win.size.width}×{win.size.height}</span>
                    <span>{win.maximized ? 'MAXIMIZED' : `@${win.position.x},${win.position.y}`}</span>
                  </div>
                  <button className="buffer-focus-btn" onClick={() => { focusWindow(win.id); onSectionChange('kernel') }}>
                    <span className="mat mat-sm">open_in_full</span>
                    FOCUS
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {windows.length === 0 && (
          <div className="panel-empty">
            <span className="mat" style={{ fontSize: 40, color: 'var(--ghost)' }}>layers</span>
            <div className="panel-empty-text">NO BUFFERS</div>
            <div className="panel-empty-hint">Open a tool to create a buffer</div>
          </div>
        )}
      </div>
    </div>
  )
}
