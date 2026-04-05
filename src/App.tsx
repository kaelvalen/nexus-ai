import { useEffect, useState } from 'react'
import { WindowManager } from './components/WindowManager/WindowManager'
import { SideNav } from './components/Nav/SideNav'
import { TopBar } from './components/Nav/TopBar'
import { TelemetryRibbon } from './components/Nav/TelemetryRibbon'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { ToastContainer } from './components/Toast/ToastContainer'
import { KernelPanel } from './components/Panels/KernelPanel'
import { BuffersPanel } from './components/Panels/BuffersPanel'
import { SessionsPanel } from './components/Panels/SessionsPanel'
import { NetworkPanel } from './components/Panels/NetworkPanel'
import { DebugPanel } from './components/Panels/DebugPanel'
import { TelemetryPanel } from './components/Panels/TelemetryPanel'
import { CodePanel } from './components/Panels/CodePanel'
import { GitPanel } from './components/Panels/GitPanel'
import { useWindowStore } from './store/windowStore'
import { useSessionStore } from './store/sessionStore'
import { onToolExit } from './lib/tauri'

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('kernel')
  const { windows, closeWindow, focusWindow, minimizeWindow } = useWindowStore()
  const { setActive } = useSessionStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (e.ctrlKey && e.key === 'w') {
        const topWin = [...windows].sort((a, b) => b.zIndex - a.zIndex)[0]
        if (topWin) { e.preventDefault(); closeWindow(topWin.id) }
        return
      }
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault()
        const topWin = [...windows].filter(w => !w.minimized).sort((a, b) => b.zIndex - a.zIndex)[0]
        if (topWin) minimizeWindow(topWin.id)
        return
      }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        const visible = windows.filter((w) => !w.minimized)
        if (visible.length < 2) return
        const next = [...visible].sort((a, b) => b.zIndex - a.zIndex)[1]
        if (next) focusWindow(next.id)
        return
      }
      if (e.key === 'Escape' && paletteOpen) setPaletteOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [windows, paletteOpen, closeWindow, focusWindow, minimizeWindow])

  // Mark sessions inactive when their process exits
  useEffect(() => {
    let unlisten: (() => void) | null = null
    onToolExit((e) => setActive(e.session_id, false)).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  }, [setActive])

  const hasWindows = windows.filter(w => !w.minimized).length > 0

  return (
    <>
      {/* Side navigation */}
      <SideNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {/* Top app bar */}
      <TopBar
        activeTab={activeSection}
        onTabChange={setActiveSection}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {/* Main workspace */}
      <main className="workspace">
        {/* Floating windows — always mounted so terminals keep running */}
        <div style={{ display: activeSection === 'kernel' ? 'block' : 'none', position: 'absolute', inset: 0 }}>
          <div className="workspace-grid" />
          <WindowManager />
          {hasWindows ? null : (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="nexus-splash">
                <div className="splash-logo">NEXUS</div>
                <div className="splash-sub">AI Developer OS</div>
                <div className="splash-hint">
                  Press <kbd className="splash-kbd">Ctrl+K</kbd> or click a tool in the sidebar
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section panels */}
        {activeSection === 'buffers'      && <BuffersPanel   onSectionChange={setActiveSection} />}
        {activeSection === 'sessions'     && <SessionsPanel  onSectionChange={setActiveSection} />}
        {activeSection === 'code'         && <CodePanel />}
        {activeSection === 'debug'        && <DebugPanel />}
        {activeSection === 'network'      && <NetworkPanel />}
        {activeSection === 'telemetry'    && <TelemetryPanel />}
        {activeSection === 'git'          && <GitPanel />}
        {activeSection === 'kernel-panel' && <KernelPanel onSectionChange={setActiveSection} />}
      </main>

      {/* Telemetry ribbon */}
      <TelemetryRibbon />

      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Toast notifications */}
      <ToastContainer />
    </>
  )
}
