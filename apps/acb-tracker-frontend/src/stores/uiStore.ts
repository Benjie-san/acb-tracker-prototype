import { create } from 'zustand'
import type { Theme } from '../types'

type UiState = {
  theme: Theme
  isSidebarOpen: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setSidebarOpen: (isOpen: boolean) => void
  toggleSidebar: () => void
}

const readStoredTheme = (): Theme => {
  const raw = localStorage.getItem('acb_theme')
  if (raw === 'light' || raw === 'dark') return raw
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export const useUiStore = create<UiState>((set) => ({
  theme: readStoredTheme(),
  isSidebarOpen: window.innerWidth >= 1100,
  setTheme: (theme) => {
    localStorage.setItem('acb_theme', theme)
    set({ theme })
  },
  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('acb_theme', next)
      return { theme: next }
    })
  },
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}))
