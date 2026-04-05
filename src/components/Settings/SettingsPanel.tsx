import { useState, useEffect, useCallback } from 'react'
import { listTools, checkAllTools, checkToolAvailable, type ToolDef, type ToolAvailability } from '../../lib/tauri'
import { toast } from '../../store/toastStore'

interface BinaryOverride {
  toolId: string
  binary: string
}

const FONT_FAMILIES = [
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
  { label: 'Fira Code', value: '"Fira Code", monospace' },
  { label: 'Cascadia Code', value: '"Cascadia Code", monospace' },
  { label: 'Source Code Pro', value: '"Source Code Pro", monospace' },
  { label: 'Consolas', value: 'Consolas, monospace' },
  { label: 'Monospace', value: 'monospace' },
]

const ACCENT_COLORS = [
  { label: 'Neon Green', primary: '#00ff88', secondary: '#00d4ff' },
  { label: 'Cyan Blue', primary: '#00d4ff', secondary: '#00ff88' },
  { label: 'Purple', primary: '#c678dd', secondary: '#61afef' },
  { label: 'Orange', primary: '#f0a500', secondary: '#ff6b6b' },
  { label: 'Pink', primary: '#ff6b9d', secondary: '#c678dd' },
  { label: 'White', primary: '#e0e6ed', secondary: '#8ba4b0' },
]

function buildDefaultOverrides(tools: ToolDef[]): BinaryOverride[] {
  return tools.map((t) => ({ toolId: t.id, binary: t.binary }))
}

function mergeOverrides(tools: ToolDef[], saved: BinaryOverride[]): BinaryOverride[] {
  return tools.map((t) => {
    const existing = saved.find((o) => o.toolId === t.id)
    return existing ?? { toolId: t.id, binary: t.binary }
  })
}

function applyTheme(primary: string, secondary: string) {
  document.documentElement.style.setProperty('--primary', primary)
  document.documentElement.style.setProperty('--secondary', secondary)
}

function applyFont(family: string, size: number) {
  document.documentElement.style.fontFamily = family
  document.documentElement.style.fontSize = `${size}px`
}

export function SettingsPanel() {
  const [tools, setTools] = useState<ToolDef[]>([])
  const [overrides, setOverrides] = useState<BinaryOverride[]>([])
  const [availability, setAvailability] = useState<Record<string, ToolAvailability>>({})
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('nexus:font-size') ?? '13'))
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('nexus:font-family') ?? FONT_FAMILIES[0].value)
  const [accentIdx, setAccentIdx] = useState(() => {
    const saved = localStorage.getItem('nexus:accent-idx')
    return saved ? parseInt(saved) : 0
  })

  const refreshAvailability = useCallback((toolIds: string[], binaryMap: Record<string, string>) => {
    toolIds.forEach((id) => {
      checkToolAvailable(id, binaryMap[id]).then((res) => {
        setAvailability((prev) => ({ ...prev, [id]: res }))
      }).catch(() => {})
    })
  }, [])

  useEffect(() => {
    listTools().then((ts) => {
      setTools(ts)
      const raw = localStorage.getItem('nexus:binary-overrides')
      const parsed: BinaryOverride[] = raw ? JSON.parse(raw) : []
      const merged = mergeOverrides(ts, parsed)
      setOverrides(merged)
      const binaryMap = Object.fromEntries(merged.map((o) => [o.toolId, o.binary]))
      checkAllTools().then((avail) => {
        const map: Record<string, ToolAvailability> = {}
        avail.forEach((a) => { map[a.tool_id] = a })
        setAvailability(map)
      }).catch(() => refreshAvailability(ts.map((t) => t.id), binaryMap))
    }).catch(() => {
      const raw = localStorage.getItem('nexus:binary-overrides')
      if (raw) setOverrides(JSON.parse(raw))
    })
  }, [refreshAvailability])

  // Live preview font size
  useEffect(() => {
    applyFont(fontFamily, fontSize)
  }, [fontSize, fontFamily])

  // Live preview accent
  useEffect(() => {
    const accent = ACCENT_COLORS[accentIdx]
    if (accent) applyTheme(accent.primary, accent.secondary)
  }, [accentIdx])

  const saveSettings = () => {
    localStorage.setItem('nexus:binary-overrides', JSON.stringify(overrides))
    localStorage.setItem('nexus:font-size', String(fontSize))
    localStorage.setItem('nexus:font-family', fontFamily)
    localStorage.setItem('nexus:accent-idx', String(accentIdx))
    toast.success('Settings saved')
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

  const recheckOverride = (toolId: string, binary: string) => {
    checkToolAvailable(toolId, binary).then((res) => {
      setAvailability((prev) => ({ ...prev, [toolId]: res }))
    }).catch(() => {})
  }

  const changeFontSize = (delta: number) => {
    setFontSize((v) => Math.min(20, Math.max(10, v + delta)))
  }

  return (
    <div className="settings-panel">
      {/* Binary Overrides */}
      <section className="settings-section">
        <h2 className="settings-heading">// BINARY_OVERRIDES</h2>
        <p className="settings-desc">
          Map each tool to its CLI binary. Change if the default name doesn't match your installation.
        </p>
        <div className="settings-table" style={{ marginTop: 16 }}>
          <div className="settings-table-head">
            <span>Tool</span>
            <span>Mode</span>
            <span>Binary / Path</span>
          </div>
          {overrides.map((o) => {
            const tool = tools.find((t) => t.id === o.toolId)
            const avail = availability[o.toolId]
            return (
              <div key={o.toolId} className="settings-table-row">
                <span className="settings-tool-name">
                  <span className="settings-tool-icon">{tool?.icon ?? '?'}</span>
                  {o.toolId}
                </span>
                <span className="settings-tool-mode">{tool?.mode ?? '—'}</span>
                <div className="settings-input-row">
                  <input
                    className="settings-input"
                    value={o.binary}
                    onChange={(e) => updateOverride(o.toolId, e.target.value)}
                    onBlur={(e) => recheckOverride(o.toolId, e.target.value)}
                    spellCheck={false}
                    placeholder="binary name or absolute path"
                  />
                  {avail && (
                    <span
                      className={`settings-avail-dot ${avail.available ? 'avail-ok' : 'avail-miss'}`}
                      title={avail.available ? avail.resolved_path ?? 'found' : avail.error ?? 'not found'}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <button className="settings-link-btn" style={{ marginTop: 10 }} onClick={resetOverrides}>
          ↺ RESET_TO_DEFAULTS
        </button>
      </section>

      {/* Appearance */}
      <section className="settings-section">
        <h2 className="settings-heading">// APPEARANCE</h2>

        {/* Font size */}
        <div className="settings-row" style={{ marginTop: 16 }}>
          <label className="settings-label">Font size</label>
          <div className="settings-font-size-row">
            <button className="settings-font-btn" onClick={() => changeFontSize(-1)}>−</button>
            <span className="settings-font-value">{fontSize}px</span>
            <button className="settings-font-btn" onClick={() => changeFontSize(1)}>+</button>
          </div>
        </div>

        {/* Font family */}
        <div className="settings-row" style={{ marginTop: 12 }}>
          <label className="settings-label">Font family</label>
          <div className="settings-font-family-row">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f.value}
                className={`settings-font-family-btn ${fontFamily === f.value ? 'settings-font-family-active' : ''}`}
                onClick={() => setFontFamily(f.value)}
                style={{ fontFamily: f.value }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accent color */}
        <div className="settings-row" style={{ alignItems: 'flex-start', marginTop: 12 }}>
          <label className="settings-label">Accent color</label>
          <div className="settings-accent-row">
            {ACCENT_COLORS.map((c, i) => (
              <button
                key={c.label}
                className={`settings-accent-btn ${accentIdx === i ? 'settings-accent-active' : ''}`}
                style={{ '--accent-color': c.primary } as React.CSSProperties}
                onClick={() => setAccentIdx(i)}
                title={c.label}
              >
                <span className="settings-accent-swatch" style={{ background: c.primary }} />
                <span className="settings-accent-label">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section className="settings-section">
        <h2 className="settings-heading">// KEYBINDINGS</h2>
        <div className="settings-shortcuts" style={{ marginTop: 12 }}>
          {[
            ['Ctrl+K', 'Open Command Palette'],
            ['Ctrl+W', 'Close focused window'],
            ['Ctrl+M', 'Minimize focused window'],
            ['Ctrl+Tab', 'Cycle through windows'],
            ['Double-click titlebar', 'Maximize / Restore window'],
            ['Delete', 'Delete selected workflow node'],
            ['ESC', 'Close palette / dismiss'],
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
        <h2 className="settings-heading">// ABOUT</h2>
        <div className="settings-desc" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p><span style={{ color: 'var(--primary)', fontWeight: 700 }}>NEXUS_AI_OS</span> v0.1.0</p>
          <p>AI Developer OS — Tauri v2 + React + Rust</p>
          <p style={{ marginTop: 6, fontSize: 9, color: 'var(--muted)' }}>
            All tools run as local CLI processes. No API keys. No cloud.
          </p>
        </div>
      </section>

      {/* Save */}
      <div className="settings-footer">
        <button className="settings-save-btn" onClick={saveSettings}>
          Save Settings
        </button>
      </div>
    </div>
  )
}
