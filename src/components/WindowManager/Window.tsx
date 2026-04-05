import { useRef, useCallback, useState, type ReactNode } from 'react'
import { useWindowStore, type SnapPosition } from '../../store/windowStore'

interface WindowProps {
  id: string
  title: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
  minimized: boolean
  maximized: boolean
  children: ReactNode
}

export function Window({
  id,
  title,
  position,
  size,
  zIndex,
  minimized,
  maximized,
  children,
}: WindowProps) {
  const { focusWindow, closeWindow, minimizeWindow, maximizeWindow, moveWindow, resizeWindow, snapWindow } =
    useWindowStore()
  const [snapMenuOpen, setSnapMenuOpen] = useState(false)

  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, winX: 0, winY: 0 })
  const resizing = useRef(false)
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const onTitleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || maximized) return
      focusWindow(id)
      dragging.current = true
      dragStart.current = { x: e.clientX, y: e.clientY, winX: position.x, winY: position.y }
      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return
        moveWindow(id, {
          x: dragStart.current.winX + ev.clientX - dragStart.current.x,
          y: dragStart.current.winY + ev.clientY - dragStart.current.y,
        })
      }
      const onUp = () => {
        dragging.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [id, position.x, position.y, maximized, focusWindow, moveWindow]
  )

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || maximized) return
      e.stopPropagation()
      resizing.current = true
      resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height }
      const onMove = (ev: MouseEvent) => {
        if (!resizing.current) return
        resizeWindow(id, {
          width: Math.max(320, resizeStart.current.w + ev.clientX - resizeStart.current.x),
          height: Math.max(240, resizeStart.current.h + ev.clientY - resizeStart.current.y),
        })
      }
      const onUp = () => {
        resizing.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [id, size.width, size.height, maximized, resizeWindow]
  )

  const doSnap = (snap: SnapPosition) => { snapWindow(id, snap); setSnapMenuOpen(false) }

  if (minimized) return null

  const computedStyle = maximized
    ? { left: 0, top: 0, width: '100%', height: '100%', zIndex }
    : { left: position.x, top: position.y, width: size.width, height: size.height, zIndex }

  return (
    <div
      className="nexus-window absolute flex flex-col"
      style={computedStyle}
      onMouseDown={() => focusWindow(id)}
    >
      {/* Title bar */}
      <div
        className={`nexus-titlebar select-none ${maximized ? '' : 'cursor-move'}`}
        onMouseDown={onTitleMouseDown}
        onDoubleClick={() => maximizeWindow(id)}
      >
        {/* Left: icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mat mat-sm win-icon">terminal</span>
          <span className="win-title">{title.toUpperCase()}</span>
          {maximized && (
            <span className="win-title-meta">[MAXIMIZED]</span>
          )}
        </div>

        {/* Right: controls */}
        <div className="win-controls" onMouseDown={(e) => e.stopPropagation()}>
          {/* Snap menu */}
          {!maximized && (
            <div style={{ position: 'relative' }}>
              <button
                className="win-btn win-btn-snap"
                onClick={(e) => { e.stopPropagation(); setSnapMenuOpen((v) => !v) }}
                title="Snap window"
              >
                <span className="mat mat-sm">grid_view</span>
              </button>
              {snapMenuOpen && (
                <div className="win-snap-menu" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="win-snap-grid">
                    <button className="win-snap-cell" onClick={() => doSnap('top-left')}    title="Top-left">◰</button>
                    <button className="win-snap-cell" onClick={() => doSnap('top-right')}   title="Top-right">◳</button>
                    <button className="win-snap-cell" onClick={() => doSnap('left')}         title="Left half">◧</button>
                    <button className="win-snap-cell" onClick={() => doSnap('right')}        title="Right half">◨</button>
                    <button className="win-snap-cell" onClick={() => doSnap('bottom-left')}  title="Bottom-left">◱</button>
                    <button className="win-snap-cell" onClick={() => doSnap('bottom-right')} title="Bottom-right">◲</button>
                  </div>
                  <div className="win-snap-labels">SNAP TO POSITION</div>
                </div>
              )}
            </div>
          )}

          <button
            className="win-btn win-btn-min"
            onClick={(e) => { e.stopPropagation(); minimizeWindow(id) }}
            title="Minimize"
          >
            <span className="mat mat-sm">remove</span>
          </button>
          <button
            className="win-btn win-btn-max"
            onClick={(e) => { e.stopPropagation(); maximizeWindow(id) }}
            title={maximized ? 'Restore' : 'Maximize'}
          >
            <span className="mat mat-sm">{maximized ? 'close_fullscreen' : 'open_in_full'}</span>
          </button>
          <button
            className="win-btn win-btn-close"
            onClick={(e) => { e.stopPropagation(); closeWindow(id) }}
            title="Close"
          >
            <span className="mat mat-sm">close</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-hidden relative"
        style={{ minHeight: 0 }}
        onClick={() => setSnapMenuOpen(false)}
      >
        {children}
      </div>

      {/* Resize handle */}
      {!maximized && (
        <div
          className="win-resize-handle"
          onMouseDown={onResizeMouseDown}
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 14, height: 14, cursor: 'se-resize',
            borderTop: '2px solid var(--outline)',
            borderLeft: '2px solid var(--outline)',
            margin: 0,
          }}
        />
      )}
    </div>
  )
}
