import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CwdStore {
  cwd: string
  setCwd: (path: string) => void
}

export const useCwdStore = create<CwdStore>()(
  persist(
    (set) => ({
      cwd: '~',
      setCwd: (path) => set({ cwd: path }),
    }),
    { name: 'nexus:cwd' }
  )
)
