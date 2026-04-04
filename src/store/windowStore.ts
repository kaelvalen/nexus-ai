import { create } from 'zustand'

export type WindowComponent = 'Terminal' | 'WorkflowEditor' | 'Settings'

export interface NexusWindow {
  id: string
  title: string
  component: WindowComponent
  props: Record<string, unknown>
  position: { x: number; y: number }
  size: { width: number; height: number }
  minimized: boolean
  zIndex: number
}

interface WindowStore {
  windows: NexusWindow[]
  topZ: number
  openWindow: (opts: Omit<NexusWindow, 'zIndex' | 'minimized'>) => void
  closeWindow: (id: string) => void
  minimizeWindow: (id: string) => void
  restoreWindow: (id: string) => void
  focusWindow: (id: string) => void
  moveWindow: (id: string, position: { x: number; y: number }) => void
  resizeWindow: (id: string, size: { width: number; height: number }) => void
}

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],
  topZ: 10,

  openWindow: (opts) => {
    const { topZ } = get()
    const newZ = topZ + 1
    set((state) => ({
      topZ: newZ,
      windows: [
        ...state.windows,
        { ...opts, minimized: false, zIndex: newZ },
      ],
    }))
  },

  closeWindow: (id) =>
    set((state) => ({ windows: state.windows.filter((w) => w.id !== id) })),

  minimizeWindow: (id) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, minimized: true } : w
      ),
    })),

  restoreWindow: (id) => {
    const { topZ } = get()
    const newZ = topZ + 1
    set((state) => ({
      topZ: newZ,
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, minimized: false, zIndex: newZ } : w
      ),
    }))
  },

  focusWindow: (id) => {
    const { topZ } = get()
    const newZ = topZ + 1
    set((state) => ({
      topZ: newZ,
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, zIndex: newZ } : w
      ),
    }))
  },

  moveWindow: (id, position) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, position } : w
      ),
    })),

  resizeWindow: (id, size) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, size } : w
      ),
    })),
}))
