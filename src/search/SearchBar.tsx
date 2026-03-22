import React, { useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { getTerminalEntry, getAllEntries } from '../lib/terminalRegistry'

const SEARCH_DECORATIONS = {
  matchBackground: '#ffff00',
  matchBorder: '#ff8800',
  matchOverviewRuler: '#ff8800',
  activeMatchBackground: '#ff8800',
  activeMatchBorder: '#ffff00',
  activeMatchColorOverviewRuler: '#ff8800'
}

/**
 * Global search bar — Cmd+F to open.
 * Searches the focused terminal tile via xterm SearchAddon.
 * Falls back to searching all terminals if none focused.
 * Enter = next match, Shift+Enter = previous match.
 */
export function SearchBar() {
  const searchOpen = useStore((s) => s.searchOpen)
  const searchQuery = useStore((s) => s.searchQuery)
  const focusedId = useStore((s) => s.focusedId)
  const { setSearchQuery, toggleSearch } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [searchOpen])

  // Clear highlights when closed
  useEffect(() => {
    if (!searchOpen) {
      for (const [, entry] of getAllEntries()) {
        entry.searchAddon.clearDecorations()
      }
    }
  }, [searchOpen])

  const getTargetAddons = useCallback(() => {
    if (focusedId) {
      const entry = getTerminalEntry(focusedId)
      if (entry) return [entry.searchAddon]
    }
    // No focused terminal — search all
    return getAllEntries().map(([, e]) => e.searchAddon)
  }, [focusedId])

  const runSearch = useCallback((query: string, forward: boolean) => {
    if (!query) return
    const addons = getTargetAddons()
    for (const addon of addons) {
      if (forward) {
        addon.findNext(query, { incremental: false, decorations: SEARCH_DECORATIONS })
      } else {
        addon.findPrevious(query, { incremental: false, decorations: SEARCH_DECORATIONS })
      }
    }
  }, [getTargetAddons])

  const handleQueryChange = useCallback((q: string) => {
    setSearchQuery(q)
    if (q) {
      const addons = getTargetAddons()
      for (const addon of addons) {
        addon.findNext(q, { incremental: true, decorations: SEARCH_DECORATIONS })
      }
    } else {
      for (const [, entry] of getAllEntries()) {
        entry.searchAddon.clearDecorations()
      }
    }
  }, [setSearchQuery, getTargetAddons])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      toggleSearch()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      runSearch(searchQuery, !e.shiftKey)
    }
  }, [toggleSearch, runSearch, searchQuery])

  if (!searchOpen) return null

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-tile/95 backdrop-blur-sm border border-border rounded-lg shadow-2xl flex items-center gap-2 px-3 py-2">
      <span className="text-text-muted text-sm">⌕</span>
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search terminals…"
        className="bg-transparent outline-none text-text-primary text-sm w-64 placeholder-text-muted"
      />
      <button
        onClick={() => runSearch(searchQuery, false)}
        className="text-text-muted hover:text-text-primary text-xs transition-colors px-1"
        title="Previous match (Shift+Enter)"
      >
        ↑
      </button>
      <button
        onClick={() => runSearch(searchQuery, true)}
        className="text-text-muted hover:text-text-primary text-xs transition-colors px-1"
        title="Next match (Enter)"
      >
        ↓
      </button>
      <button
        onClick={toggleSearch}
        className="text-text-muted hover:text-text-primary text-xs transition-colors ml-1"
        title="Close (Escape)"
      >
        ✕
      </button>
    </div>
  )
}
