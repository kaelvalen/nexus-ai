import { useRef, useCallback, type ReactNode } from 'react'
import { useWindowStore } from '../../store/windowStore'

const TASKBAR_WIDTH = 120

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
  const { focusWindow, closeWindow, minimizeWindow, maximizeWindow, moveWindow, resizeWindow } =
    useWindowStore()

  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, winX: 0, winY: 0 })
  const resizing = useRef(false)
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const onTitleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (maximized) return
      focusWindow(id)
      dragging.current = true
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        winX: position.x,
        winY: position.y,
      }

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
      if (e.button !== 0) return
      if (maximized) return
      e.stopPropagation()
      resizing.current = true
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        w: size.width,
        h: size.height,
      }

      const onMove = (ev: MouseEvent) => {
        if (!resizing.current) return
        resizeWindow(id, {
          width: Math.max(
            320,
            resizeStart.current.w + ev.clientX - resizeStart.current.x
          ),
          height: Math.max(
            240,
            resizeStart.current.h + ev.clientY - resizeStart.current.y
          ),
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

  if (minimized) return null

  const computedStyle = maximized
    ? {
        left: 0,
        top: 0,
        width: `calc(100vw - ${TASKBAR_WIDTH}px)`,
        height: '100vh',
        zIndex,
      }
    : {
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex,
      }

  return (
    <div
      className={`nexus-window absolute flex flex-col ${maximized ? 'nexus-window-maximized' : ''}`}
      style={computedStyle}
      onMouseDown={() => focusWindow(id)}
    >
      {/* Title bar */}
      <div
        className={`nexus-titlebar flex items-center justify-between px-3 py-2 select-none ${maximized ? 'cursor-default' : 'cursor-move'}`}
        onMouseDown={onTitleMouseDown}
        onDoubleClick={() => maximizeWindow(id)}
      >
        <div className="flex items-center gap-2">
          <span className="text-primary text-xs font-bold tracking-widest uppercase">
            {title}
          </span>
          {maximized && (
            <span className="text-muted text-xs" style={{ letterSpacing: '0.05em' }}>
              [MAX]
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="win-btn win-btn-min"
            onClick={(e) => {
              e.stopPropagation()
              minimizeWindow(id)
            }}
            title="Minimize"
          >
            −
          </button>
          <button
            className="win-btn win-btn-max"
            onClick={(e) => {
              e.stopPropagation()
              maximizeWindow(id)
            }}
            title={maximized ? 'Restore' : 'Maximize'}
          >
            {maximized ? '❐' : '□'}
          </button>
          <button
            className="win-btn win-btn-close"
            onClick={(e) => {
              e.stopPropagation()
              closeWindow(id)
            }}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">{children}</div>

      {/* Resize handle — hidden when maximized */}
      {!maximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={onResizeMouseDown}
        >
          <svg
            className="w-full h-full text-primary opacity-40"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M11 5h2v2h-2V5zm0 4h2v2h-2V9zm-4 4h2v2H7v-2zm4 0h2v2h-2v-2z" />
          </svg>
        </div>
      )}
    </div>
  )
}
