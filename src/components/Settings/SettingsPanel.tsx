import { useState, useEffect } from 'react'

interface BinaryOverride {
  toolId: string
  binary: string
}

const DEFAULT_OVERRIDES: BinaryOverride[] = [
  { toolId: 'windsurf', binary: 'windsurf' },
  { toolId: 'cursor', binary: 'cursor' },
]

export function SettingsPanel() {
  const [overrides, setOverrides] = useState<BinaryOverride[]>(() => {
    try {
      const saved = localStorage.getItem('nexus:binary-overrides')
      return saved ? JSON.parse(saved) : DEFAULT_OVERRIDES
    } catch {
      return DEFAULT_OVERRIDES
    }
  })

  const [theme, setTheme] = useState(() => localStorage.getItem('nexus:theme') ?? 'dark')

  useEffect(() => {
    localStorage.setItem('nexus:binary-overrides', JSON.stringify(overrides))
  }, [overrides])

  useEffect(() => {
    localStorage.setItem('nexus:theme', theme)
  }, [theme])

  const updateOverride = (toolId: string, binary: string) => {
    setOverrides((prev) =>
      prev.map((o) => (o.toolId === toolId ? { ...o, binary } : o))
    )
  }

  return (
    <div className="settings-panel p-6 space-y-6 overflow-y-auto h-full">
      <section>
        <h2 className="settings-heading">Binary Overrides</h2>
        <p className="settings-desc">
          Override the system binary name for launcher tools. Useful when the binary name
          differs across systems (e.g. <code>windsurf</code> vs <code>Windsurf</code>).
        </p>
        <div className="space-y-3 mt-4">
          {overrides.map((o) => (
            <div key={o.toolId} className="settings-row">
              <label className="settings-label">{o.toolId}</label>
              <input
                className="settings-input"
                value={o.binary}
                onChange={(e) => updateOverride(o.toolId, e.target.value)}
                spellCheck={false}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="settings-heading">Appearance</h2>
        <div className="settings-row mt-4">
          <label className="settings-label">Theme</label>
          <select
            className="settings-input"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="dark">Dark (default)</option>
            <option value="darker">Darker</option>
          </select>
        </div>
      </section>

      <section>
        <h2 className="settings-heading">About</h2>
        <div className="settings-desc space-y-1 mt-2">
          <p><span className="text-primary font-bold">NEXUS</span> v0.1.0</p>
          <p className="text-muted">AI Developer OS — Tauri v2 + React + Rust</p>
          <p className="text-muted text-xs mt-2">
            All tools run as local CLI processes. No API keys. No cloud. Everything stays on your machine.
          </p>
        </div>
      </section>
    </div>
  )
}
