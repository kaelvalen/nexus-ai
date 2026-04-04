import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'tool'
  content: string
  timestamp: number
}

export interface Session {
  id: string
  toolId: string
  toolName: string
  messages: Message[]
  active: boolean
}

interface SessionStore {
  sessions: Record<string, Session>
  createSession: (id: string, toolId: string, toolName: string) => void
  addMessage: (sessionId: string, role: 'user' | 'tool', content: string) => void
  appendToLastToolMessage: (sessionId: string, content: string) => void
  setActive: (sessionId: string, active: boolean) => void
  removeSession: (sessionId: string) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessions: {},

  createSession: (id, toolId, toolName) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [id]: { id, toolId, toolName, messages: [], active: true },
      },
    })),

  addMessage: (sessionId, role, content) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state
      const msg: Message = {
        id: `${Date.now()}-${Math.random()}`,
        role,
        content,
        timestamp: Date.now(),
      }
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, messages: [...session.messages, msg] },
        },
      }
    }),

  appendToLastToolMessage: (sessionId, content) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state
      const msgs = [...session.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'tool') {
        msgs[msgs.length - 1] = { ...last, content: last.content + content }
      } else {
        msgs.push({
          id: `${Date.now()}-${Math.random()}`,
          role: 'tool',
          content,
          timestamp: Date.now(),
        })
      }
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, messages: msgs },
        },
      }
    }),

  setActive: (sessionId, active) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state
      return {
        sessions: { ...state.sessions, [sessionId]: { ...session, active } },
      }
    }),

  removeSession: (sessionId) =>
    set((state) => {
      const next = { ...state.sessions }
      delete next[sessionId]
      return { sessions: next }
    }),
}))
