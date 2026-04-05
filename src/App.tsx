import { useEffect, useState } from 'react'
import { WindowManager } from './components/WindowManager/WindowManager'
import { Taskbar } from './components/WindowManager/Taskbar'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { ToastContainer } from './components/Toast/ToastContainer'
import { StatusBar } from './components/StatusBar/StatusBar'
import { useWindowStore } from './store/windowStore'
import { useSessionStore } from './store/sessionStore'

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { windows, closeWindow, focusWindow, minimizeWindow } = useWindowStore()
  const { sessions } = useSessionStore()

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K — Command Palette
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }

      // Ctrl+W — Close focused window
      if (e.ctrlKey && e.key === 'w') {
        const topWin = [...windows].sort((a, b) => b.zIndex - a.zIndex)[0]
        if (topWin) {
          e.preventDefault()
          closeWindow(topWin.id)
        }
        return
      }

      // Ctrl+M — Minimize focused window
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault()
        const topWin = [...windows].filter(w => !w.minimized).sort((a, b) => b.zIndex - a.zIndex)[0]
        if (topWin) minimizeWindow(topWin.id)
        return
      }

      // Ctrl+Tab — Cycle through windows
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        const visible = windows.filter((w) => !w.minimized)
        if (visible.length < 2) return
        const sorted = [...visible].sort((a, b) => b.zIndex - a.zIndex)
        const next = sorted[1]
        if (next) focusWindow(next.id)
        return
      }

      // Escape — Close palette
      if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [windows, paletteOpen, closeWindow, focusWindow, minimizeWindow])

  const hasWindows = windows.length > 0

  return (
    <div className="nexus-root flex flex-col h-screen w-screen overflow-hidden select-none">
      <div className="flex flex-1 min-h-0">
        {/* Left vertical taskbar */}
        <Taskbar onOpenPalette={() => setPaletteOpen(true)} />

        {/* Main canvas */}
        <main className="flex-1 relative overflow-hidden">
          {/* Grid background */}
          <div className="nexus-grid-bg absolute inset-0 pointer-events-none" />

          {/* Floating windows */}
          <WindowManager />

          {/* Empty state — hidden when windows are open */}
          {!hasWindows && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="nexus-splash text-center space-y-3">
                <div className="splash-logo">NEXUS</div>
                <div className="splash-sub">AI Developer OS</div>
                <div className="splash-hint">Press <kbd className="splash-kbd">Ctrl+K</kbd> or select a tool to begin</div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Status bar */}
      <StatusBar sessions={sessions} windows={windows} onOpenPalette={() => setPaletteOpen(true)} />

      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  )
}
