import { useEffect, useState } from 'react'
import { WindowManager } from './components/WindowManager/WindowManager'
import { SideNav } from './components/Nav/SideNav'
import { TopBar } from './components/Nav/TopBar'
import { TelemetryRibbon } from './components/Nav/TelemetryRibbon'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { ToastContainer } from './components/Toast/ToastContainer'
import { useWindowStore } from './store/windowStore'

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('kernel')
  const { windows, closeWindow, focusWindow, minimizeWindow } = useWindowStore()

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

      {/* Main floating-window workspace */}
      <main className="workspace">
        <div className="workspace-grid" />
        <WindowManager />

        {!hasWindows && (
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
