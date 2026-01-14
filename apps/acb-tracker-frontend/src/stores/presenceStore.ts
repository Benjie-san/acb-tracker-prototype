import { create } from 'zustand'
import type { PresenceEditor } from '../types'

type PresenceState = {
  presenceMap: Record<string, PresenceEditor[]>
  setPresenceMap: (map: Record<string, PresenceEditor[]>) => void
  updatePresence: (shipmentId: string, editors: PresenceEditor[]) => void
  clearPresence: () => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  presenceMap: {},
  setPresenceMap: (presenceMap) => set({ presenceMap }),
  updatePresence: (shipmentId, editors) =>
    set((state) => {
      const next = { ...state.presenceMap }
      if (editors.length === 0) {
        delete next[shipmentId]
      } else {
        next[shipmentId] = editors
      }
      return { presenceMap: next }
    }),
  clearPresence: () => set({ presenceMap: {} }),
}))
