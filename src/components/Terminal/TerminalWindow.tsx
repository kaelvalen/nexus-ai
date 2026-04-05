import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useSessionStore } from '../../store/sessionStore'
import { sendInput, killSession, resizePty, onToolOutput, onToolExit } from '../../lib/tauri'

interface Props {
  sessionId: string
  toolId: string
}

export function TerminalWindow({ sessionId, toolId }: Props) {
  const { sessions, setActive } = useSessionStore()
  const session = sessions[sessionId]
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background: '#080c10',
        foreground: '#c0cdd8',
        cursor: '#00ff88',
        cursorAccent: '#080c10',
        black: '#080c10',
        red: '#ff4444',
        green: '#00ff88',
        yellow: '#f0a500',
        blue: '#4d9fff',
        magenta: '#c678dd',
        cyan: '#00d4ff',
        white: '#c0cdd8',
        brightBlack: '#4a6070',
        brightRed: '#ff6b6b',
        brightGreen: '#00ff88',
        brightYellow: '#ffcc00',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitRef.current = fitAddon

    // Send keystrokes directly to PTY as raw bytes
    term.onData((data) => {
      sendInput(sessionId, data).catch(console.error)
    })

    // Sync terminal size to PTY on resize
    term.onResize(({ rows, cols }) => {
      resizePty(sessionId, rows, cols).catch(console.error)
    })

    // ResizeObserver to fit terminal when container changes size
    const ro = new ResizeObserver(() => {
      fitAddon.fit()
    })
    ro.observe(containerRef.current)

    // Listen for output from this session
    let unlistenOutput: (() => void) | null = null
    let unlistenExit: (() => void) | null = null

    onToolOutput((event) => {
      if (event.session_id === sessionId) {
        term.write(event.data)
      }
    }).then((fn) => { unlistenOutput = fn })

    onToolExit((event) => {
      if (event.session_id === sessionId) {
        setActive(sessionId, false)
        term.write('\r\n\x1b[31m— session ended —\x1b[0m\r\n')
      }
    }).then((fn) => { unlistenExit = fn })

    return () => {
      ro.disconnect()
      unlistenOutput?.()
      unlistenExit?.()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [sessionId])

  const handleKill = () => {
    killSession(sessionId).catch(console.error)
    termRef.current?.write('\r\n\x1b[31m^C — killed\x1b[0m\r\n')
  }

  const handleCopy = () => {
    const selection = termRef.current?.getSelection()
    if (selection) {
      navigator.clipboard.writeText(selection)
    } else {
      // copy all visible buffer
      const buf: string[] = []
      const t = termRef.current
      if (!t) return
      for (let i = 0; i < t.buffer.active.length; i++) {
        buf.push(t.buffer.active.getLine(i)?.translateToString(true) ?? '')
      }
      navigator.clipboard.writeText(buf.join('\n').trimEnd())
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-xs font-mono">
        Session not found: {sessionId}
      </div>
    )
  }

  return (
    <div className="terminal-window flex flex-col h-full">
      {/* Header */}
      <div className="terminal-header flex items-center gap-2 px-3 py-1.5">
        <span className="text-secondary text-xs font-mono font-semibold">{session.toolName}</span>
        <span className="text-muted text-xs font-mono">#{sessionId.slice(0, 8)}</span>
        <span className={`session-status ${session.active ? 'status-active' : 'status-dead'}`}>
          {session.active ? '● live' : '○ ended'}
        </span>
        <div className="flex-1" />
        <span className="text-muted text-xs font-mono">{toolId}</span>
        <button
          className="terminal-action-btn"
          onClick={handleCopy}
          title="Copy selection or all"
        >
          ⎘ copy
        </button>
        <button
          className="terminal-action-btn terminal-action-btn-danger"
          onClick={handleKill}
          disabled={!session.active}
          title="Kill session"
        >
          ✕ kill
        </button>
      </div>

      {/* xterm.js container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ padding: '4px 2px' }}
      />
    </div>
  )
}
