import { useEffect, useRef, useState, useCallback } from 'react'
import { useSessionStore, type Message } from '../../store/sessionStore'
import { sendInput, killSession } from '../../lib/tauri'

interface Props {
  sessionId: string
  toolId: string
}

// Simple syntax highlight: wrap code fences and inline code
function highlightOutput(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []
  let inCode = false
  let codeLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      if (inCode) {
        result.push(
          <div key={`code-${i}`} className="code-block">
            {codeLines.map((cl, j) => (
              <div key={j} className="code-line">{cl || '\u00A0'}</div>
            ))}
          </div>
        )
        codeLines = []
        inCode = false
      } else {
        inCode = true
      }
    } else if (inCode) {
      codeLines.push(line)
    } else {
      // Highlight inline code `...`
      const parts = line.split(/(`[^`]+`)/)
      result.push(
        <div key={`line-${i}`} className="output-line">
          {parts.map((part, j) => {
            if (part.startsWith('`') && part.endsWith('`')) {
              return <code key={j} className="inline-code">{part.slice(1, -1)}</code>
            }
            return <span key={j}>{part}</span>
          })}
        </div>
      )
    }
  }

  if (inCode && codeLines.length > 0) {
    result.push(
      <div key="code-final" className="code-block">
        {codeLines.map((cl, j) => (
          <div key={j} className="code-line">{cl || '\u00A0'}</div>
        ))}
      </div>
    )
  }

  return result
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`msg-row ${isUser ? 'msg-user' : 'msg-tool'}`}>
      <span className="msg-prefix">{isUser ? '❯' : '◈'}</span>
      <div className="msg-content">
        {isUser ? (
          <span className="user-text">{msg.content}</span>
        ) : (
          <div className="tool-text">{highlightOutput(msg.content)}</div>
        )}
      </div>
      <span className="msg-time">
        {new Date(msg.timestamp).toLocaleTimeString('en', { hour12: false })}
      </span>
    </div>
  )
}

export function TerminalWindow({ sessionId, toolId }: Props) {
  const { sessions, addMessage } = useSessionStore()
  const session = sessions[sessionId]
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [session?.messages])

  const submit = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    addMessage(sessionId, 'user', trimmed)
    setHistory((h) => [trimmed, ...h.slice(0, 99)])
    setHistIdx(-1)
    setInput('')

    try {
      await sendInput(sessionId, trimmed)
    } catch (e) {
      addMessage(sessionId, 'tool', `[ERROR] ${e}`)
    }
  }, [input, sessionId, addMessage])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submit()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIdx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(newIdx)
      setInput(history[newIdx] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIdx = Math.max(histIdx - 1, -1)
      setHistIdx(newIdx)
      setInput(newIdx === -1 ? '' : history[newIdx] ?? '')
    } else if (e.key === 'c' && e.ctrlKey) {
      killSession(sessionId).catch(console.error)
      addMessage(sessionId, 'tool', '^C — session terminated')
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        Session not found
      </div>
    )
  }

  return (
    <div
      className="terminal-window flex flex-col h-full"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Session header */}
      <div className="terminal-header flex items-center gap-3 px-3 py-1.5">
        <span className="text-secondary text-xs font-mono">{toolId}</span>
        <span className="text-muted text-xs font-mono">#{sessionId.slice(0, 8)}</span>
        <span className={`session-status ${session.active ? 'status-active' : 'status-dead'}`}>
          {session.active ? '● LIVE' : '○ DEAD'}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="terminal-messages flex-1 overflow-y-auto p-3 space-y-1">
        {session.messages.length === 0 ? (
          <div className="text-muted text-xs font-mono pt-2">
            {session.active
              ? `Waiting for ${session.toolName} to respond...`
              : `Session ended.`}
          </div>
        ) : (
          session.messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))
        )}
        {/* Cursor blink when active and waiting */}
        {session.active && (
          <div className="text-primary font-mono text-sm">
            <span className="blink">▌</span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="terminal-input-bar flex items-center gap-2 px-3 py-2">
        <span className="text-primary font-mono text-sm">❯</span>
        <input
          ref={inputRef}
          className="terminal-input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={session.active ? 'Send input...' : 'Session ended'}
          disabled={!session.active}
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className="send-btn"
          onClick={submit}
          disabled={!session.active || !input.trim()}
        >
          ⏎
        </button>
      </div>
    </div>
  )
}
