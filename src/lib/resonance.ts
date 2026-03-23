/**
 * Tile Resonance — Cross-tile text highlighting.
 *
 * When text is selected in any tile, all other tiles highlight occurrences
 * of that text. The minimap shows which tiles have matches.
 *
 * Usage:
 * - Call setResonance(text) when user selects text in any tile
 * - Call clearResonance() when selection is cleared
 * - Subscribe to resonanceStore for reactive updates
 */

import { create } from 'zustand'
import { getAllEntries } from './terminalRegistry'

interface ResonanceMatch {
  tileId: string
  count: number
}

interface ResonanceStore {
  /** The currently resonating text (null = no resonance) */
  text: string | null
  /** Matches per tile */
  matches: ResonanceMatch[]
  /** Set resonance text and compute matches */
  setResonance: (text: string) => void
  /** Clear resonance */
  clearResonance: () => void
}

export const useResonance = create<ResonanceStore>()((set) => ({
  text: null,
  matches: [],

  setResonance: (text: string) => {
    if (!text || text.length < 2) {
      set({ text: null, matches: [] })
      return
    }

    const matches: ResonanceMatch[] = []
    const entries = getAllEntries()
    const searchText = text.toLowerCase()

    for (const [tileId, entry] of entries) {
      const buffer = entry.terminal.buffer.active
      let count = 0
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i)
        if (line) {
          const lineText = line.translateToString(true).toLowerCase()
          // Count occurrences
          let idx = 0
          while ((idx = lineText.indexOf(searchText, idx)) !== -1) {
            count++
            idx += searchText.length
          }
        }
      }
      if (count > 0) {
        matches.push({ tileId, count })
      }
    }

    // Also use xterm search addon to highlight in each terminal
    for (const [tileId, entry] of entries) {
      if (entry.searchAddon) {
        try {
          entry.searchAddon.findNext(text, { regex: false, caseSensitive: false, decorations: {
            matchBackground: '#f9e2af44',
            matchBorder: '#f9e2af88',
            matchOverviewRuler: '#f9e2af',
            activeMatchBackground: '#f9e2af88',
            activeMatchBorder: '#f9e2af',
            activeMatchColorOverviewRuler: '#f9e2af',
          }})
        } catch {}
      }
    }

    set({ text, matches })
  },

  clearResonance: () => {
    // Clear search highlights from all terminals
    const entries = getAllEntries()
    for (const [, entry] of entries) {
      if (entry.searchAddon) {
        try { entry.searchAddon.clearDecorations() } catch {}
      }
    }
    set({ text: null, matches: [] })
  },
}))
