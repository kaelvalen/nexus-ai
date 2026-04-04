import { WindowManager } from './components/WindowManager/WindowManager'
import { Taskbar } from './components/WindowManager/Taskbar'

export default function App() {
  return (
    <div className="nexus-root flex h-screen w-screen overflow-hidden select-none">
      {/* Left vertical taskbar */}
      <Taskbar />

      {/* Main canvas */}
      <main className="flex-1 relative overflow-hidden">
        {/* Grid background */}
        <div className="nexus-grid-bg absolute inset-0 pointer-events-none" />

        {/* Floating windows */}
        <WindowManager />

        {/* Empty state */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="nexus-splash text-center space-y-3">
            <div className="splash-logo">NEXUS</div>
            <div className="splash-sub">AI Developer OS</div>
            <div className="splash-hint">← Select a tool from the taskbar to begin</div>
          </div>
        </div>
      </main>
    </div>
  )
}
