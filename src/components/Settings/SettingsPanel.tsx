import { useState, useEffect } from 'react'
import { listTools, type ToolDef } from '../../lib/tauri'

interface BinaryOverride {
  toolId: string
  binary: string
}

function buildDefaultOverrides(tools: ToolDef[]): BinaryOverride[] {
  return tools.map((t) => ({ toolId: t.id, binary: t.binary }))
}

function mergeOverrides(tools: ToolDef[], saved: BinaryOverride[]): BinaryOverride[] {
  return tools.map((t) => {
    const existing = saved.find((o) => o.toolId === t.id)
    return existing ?? { toolId: t.id, binary: t.binary }
  })
}

export function SettingsPanel() {
  const [tools, setTools] = useState<ToolDef[]>([])
  const [overrides, setOverrides] = useState<BinaryOverride[]>([])
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('nexus:font-size') ?? '13'))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    listTools().then((ts) => {
      setTools(ts)
      const raw = localStorage.getItem('nexus:binary-overrides')
      const parsed: BinaryOverride[] = raw ? JSON.parse(raw) : []
      setOverrides(mergeOverrides(ts, parsed))
    }).catch(() => {
      const raw = localStorage.getItem('nexus:binary-overrides')
      if (raw) setOverrides(JSON.parse(raw))
    })
  }, [])

  const saveSettings = () => {
    localStorage.setItem('nexus:binary-overrides', JSON.stringify(overrides))
    localStorage.setItem('nexus:font-size', String(fontSize))
    document.documentElement.style.fontSize = `${fontSize}px`
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const resetOverrides = () => {
    if (tools.length === 0) return
    setOverrides(buildDefaultOverrides(tools))
  }

  const updateOverride = (toolId: string, binary: string) => {
    setOverrides((prev) =>
      prev.map((o) => (o.toolId === toolId ? { ...o, binary } : o))
    )
  }

  return (
    <div className="settings-panel overflow-y-auto h-full">
      {/* Binary Overrides */}
      <section className="settings-section">
        <h2 className="settings-heading">Binary Overrides</h2>
        <p className="settings-desc">
          Map each tool to its CLI binary on your system. Change these if the default binary name doesn't match your installation.
        </p>
        <div className="settings-table mt-4">
          <div className="settings-table-head">
            <span>Tool</span>
            <span>Mode</span>
            <span>Binary</span>
          </div>
          {overrides.map((o) => {
            const tool = tools.find((t) => t.id === o.toolId)
            return (
              <div key={o.toolId} className="settings-table-row">
                <span className="settings-tool-name">
                  <span className="settings-tool-icon">{tool?.icon ?? '?'}</span>
                  {o.toolId}
                </span>
                <span className="settings-tool-mode">{tool?.mode ?? '—'}</span>
                <input
                  className="settings-input"
                  value={o.binary}
                  onChange={(e) => updateOverride(o.toolId, e.target.value)}
                  spellCheck={false}
                  placeholder="binary name or path"
                />
              </div>
            )
          })}
        </div>
        <button className="settings-link-btn mt-3" onClick={resetOverrides}>
          ↺ Reset to defaults
        </button>
      </section>

      {/* Appearance */}
      <section className="settings-section">
        <h2 className="settings-heading">Appearance</h2>
        <div className="settings-row mt-4">
          <label className="settings-label">Font size</label>
          <div className="settings-font-size-row">
            <button
              className="settings-font-btn"
              onClick={() => setFontSize((v) => Math.max(10, v - 1))}
            >−</button>
            <span className="settings-font-value">{fontSize}px</span>
            <button
              className="settings-font-btn"
              onClick={() => setFontSize((v) => Math.min(18, v + 1))}
            >+</button>
          </div>
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section className="settings-section">
        <h2 className="settings-heading">Keyboard Shortcuts</h2>
        <div className="settings-shortcuts mt-3">
          {[
            ['Enter', 'Send message'],
            ['Shift+Enter', 'Multi-line input'],
            ['↑ / ↓', 'Navigate history'],
            ['Ctrl+C (empty input)', 'Kill session'],
            ['Double-click titlebar', 'Maximize / Restore window'],
            ['Delete', 'Delete selected workflow node'],
          ].map(([key, desc]) => (
            <div key={key} className="settings-shortcut-row">
              <span className="settings-shortcut-key">{key}</span>
              <span className="settings-shortcut-desc">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="settings-section">
        <h2 className="settings-heading">About</h2>
        <div className="settings-desc space-y-1 mt-2">
          <p><span className="text-primary font-bold">NEXUS</span> v0.1.0</p>
          <p className="text-muted">AI Developer OS — Tauri v2 + React + Rust</p>
          <p className="text-muted text-xs mt-2">
            All tools run as local CLI processes. No API keys. No cloud. Everything stays on your machine.
          </p>
        </div>
      </section>

      {/* Save */}
      <div className="settings-footer">
        <button
          className="settings-save-btn"
          onClick={saveSettings}
        >
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
