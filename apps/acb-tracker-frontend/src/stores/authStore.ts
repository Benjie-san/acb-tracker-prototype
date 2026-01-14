import { create } from 'zustand'
import type { Session } from '../types'

type AuthState = {
  session: Session | null
  setSession: (session: Session | null) => void
  clearSession: () => void
}

const readStoredSession = (): Session | null => {
  const raw = localStorage.getItem('auth_session')
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  session: readStoredSession(),
  setSession: (session) => {
    if (session) {
      localStorage.setItem('auth_session', JSON.stringify(session))
    } else {
      localStorage.removeItem('auth_session')
    }
    set({ session })
  },
  clearSession: () => {
    localStorage.removeItem('auth_session')
    set({ session: null })
  },
}))
