import { create } from 'zustand'

export interface TrailPoint {
  x: number       // panX
  y: number       // panY
  zoom: number
  tileId: string | null
  timestamp: number
}

export interface Trail {
  id: string
  name: string
  points: TrailPoint[]
  createdAt: number
}

interface TrailStore {
  // Recording
  isRecording: boolean
  currentTrail: TrailPoint[]

  // Display
  showTrail: boolean

  // Saved trails
  savedTrails: Trail[]
  activeTrailId: string | null

  // Replay
  isReplaying: boolean
  replayIndex: number

  // Actions
  startRecording: () => void
  stopRecording: () => void
  addPoint: (point: TrailPoint) => void
  toggleShowTrail: () => void
  saveTrail: (name: string) => void
  loadTrail: (id: string) => void
  deleteTrail: (id: string) => void
  clearCurrentTrail: () => void
  startReplay: () => void
  stopReplay: () => void
  advanceReplay: () => void
}

const STORAGE_KEY = 'sunnyterm-canvas-trails'

function loadSavedTrails(): Trail[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistTrails(trails: Trail[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trails))
  } catch {
    // ignore quota errors
  }
}

export const useTrailStore = create<TrailStore>()((set, get) => ({
  isRecording: false,
  currentTrail: [],
  showTrail: false,
  savedTrails: loadSavedTrails(),
  activeTrailId: null,
  isReplaying: false,
  replayIndex: 0,

  startRecording: () => set({ isRecording: true, currentTrail: [], showTrail: true }),

  stopRecording: () => set({ isRecording: false }),

  addPoint: (point) =>
    set((s) => ({ currentTrail: [...s.currentTrail, point] })),

  toggleShowTrail: () => set((s) => ({ showTrail: !s.showTrail })),

  saveTrail: (name) => {
    const { currentTrail, savedTrails } = get()
    if (currentTrail.length === 0) return
    const trail: Trail = {
      id: `trail-${Date.now()}`,
      name,
      points: [...currentTrail],
      createdAt: Date.now(),
    }
    const updated = [...savedTrails, trail]
    persistTrails(updated)
    set({ savedTrails: updated, activeTrailId: trail.id })
  },

  loadTrail: (id) => {
    const trail = get().savedTrails.find((t) => t.id === id)
    if (!trail) return
    set({ currentTrail: [...trail.points], activeTrailId: id, showTrail: true })
  },

  deleteTrail: (id) => {
    const updated = get().savedTrails.filter((t) => t.id !== id)
    persistTrails(updated)
    set((s) => ({
      savedTrails: updated,
      activeTrailId: s.activeTrailId === id ? null : s.activeTrailId,
    }))
  },

  clearCurrentTrail: () => set({ currentTrail: [], activeTrailId: null }),

  startReplay: () => {
    const { currentTrail } = get()
    if (currentTrail.length < 2) return
    set({ isReplaying: true, replayIndex: 0, showTrail: true })
  },

  stopReplay: () => set({ isReplaying: false, replayIndex: 0 }),

  advanceReplay: () =>
    set((s) => {
      const next = s.replayIndex + 1
      if (next >= s.currentTrail.length) {
        return { isReplaying: false, replayIndex: 0 }
      }
      return { replayIndex: next }
    }),
}))
