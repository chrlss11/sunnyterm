import { useEffect } from 'react'
import { useStore } from '../store'
import { tabOrderCache } from '../focus/tabOrderCache'

/**
 * Global keyboard shortcuts
 *
 * Mod+T / Mod+N   — new terminal tile        (Cmd on macOS, Ctrl on Win/Linux)
 * Mod+Shift+N     — new HTTP tile
 * Mod+Shift+P     — new PostgreSQL tile
 * Mod+W           — close focused tile
 * Mod+Z           — undo
 * Mod+Shift+Z     — redo
 * Mod+M           — toggle minimap
 * Mod+F           — toggle search
 * Mod+L           — start linking (focused tile → next clicked tile)
 * Mod+S           — save current workspace
 * Mod+0           — reset zoom to 100% and center
 * Mod+Shift+D     — toggle dark/light mode
 * Mod+1-9         — switch to workspace by index
 * Mod+Q           — quit
 * Tab / Shift+Tab — cycle focus between tiles
 * ?               — show keyboard shortcuts
 * Escape          — cancel linking
 *
 * On macOS: e.metaKey (Cmd) is the modifier.
 * On Windows/Linux: e.ctrlKey is the modifier, BUT only when the focused
 * element is NOT a terminal (to let Ctrl+C/D/Z pass through to shells).
 */

// Cache the platform so we know which modifier to use
let _platform: string | null = null
async function getPlatformCached(): Promise<string> {
  if (!_platform) _platform = await window.electronAPI.getPlatform()
  return _platform
}
// Eagerly fetch on module load
getPlatformCached()
export function useKeyboard() {
  const {
    spawnTile, removeTile, restoreClosedTile,
    undo, redo,
    toggleMinimap, toggleSearch,
    startLinking, cancelLinking,
    saveWorkspace, loadWorkspace,
    resetView, fitAllTiles, zoomIn, zoomOut,
    toggleDark, toggleShortcuts,
    createSection,
    focusedId, linkingFromId, workspaces
  } = useStore()

  // ── Keyboard shortcut handler ─────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // On macOS use Cmd, on Windows/Linux use Ctrl
      const isMac = _platform === 'darwin'
      const meta = isMac ? e.metaKey : e.ctrlKey

      // Ctrl+Tab — toggle canvas/focus view (capture phase handles this below)


      if (e.key === 'Escape') {
        if (linkingFromId) cancelLinking()
        return
      }

      // Tab / Shift+Tab — cycle tile focus (only when NOT in an input/textarea)
      if (e.key === 'Tab' && !meta && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault()
          const tiles = useStore.getState().tiles
          if (tiles.length === 0) return
          const idx = tiles.findIndex((t) => t.id === useStore.getState().focusedId)
          const next = e.shiftKey
            ? (idx - 1 + tiles.length) % tiles.length
            : (idx + 1) % tiles.length
          useStore.getState().focusTile(tiles[next].id)
          return
        }
      }

      // Delete / Backspace — remove focused tile or all selected tiles
      if ((e.key === 'Delete' || e.key === 'Backspace') && !meta && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault()
          const { selectedIds, clearSelection } = useStore.getState()
          if (selectedIds.length > 0) {
            selectedIds.forEach((id) => removeTile(id))
            clearSelection()
          } else if (focusedId) {
            removeTile(focusedId)
          }
          return
        }
      }

      // '?' shortcut — show keyboard shortcuts cheatsheet
      if (e.key === '?' && !meta && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault()
          toggleShortcuts()
          return
        }
      }

      if (!meta) return

      // On Windows/Linux: let Ctrl+C/V/X/A pass through for clipboard operations
      if (!isMac) {
        const k = e.key.toLowerCase()
        if (k === 'c' || k === 'v' || k === 'x' || k === 'a') return
      }

      // Cmd+1-9: switch workspace by index
      const digit = parseInt(e.key, 10)
      if (!isNaN(digit) && digit >= 1 && digit <= 9) {
        const idx = digit - 1
        if (idx < workspaces.length) {
          e.preventDefault()
          loadWorkspace(workspaces[idx])
        }
        return
      }

      // Cmd+0: reset zoom to 100%
      if (e.key === '0') {
        e.preventDefault()
        resetView()
        return
      }

      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault()
          if (e.shiftKey) {
            restoreClosedTile() // Mod+Shift+T — restore last closed tile
          } else {
            spawnTile('terminal')
          }
          break
        case 'n':
          e.preventDefault()
          if (e.shiftKey) {
            useStore.getState().toggleConfirmClear()
          } else {
            spawnTile('terminal')
          }
          break
        case 'p':
          if (e.shiftKey) {
            e.preventDefault()
            spawnTile('postgres')
          }
          break
        case 'b':
          if (e.shiftKey) {
            e.preventDefault()
            spawnTile('browser')
          }
          break
        case 'e':
          if (e.shiftKey) {
            e.preventDefault()
            spawnTile('file')
          }
          break
        case 'h':
          if (e.shiftKey) {
            e.preventDefault()
            spawnTile('http')
          }
          break
        case 'w':
          e.preventDefault()
          if (focusedId) removeTile(focusedId)
          break
        case 'z':
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
          break
        case 'm':
          e.preventDefault()
          toggleMinimap()
          break
        case 'f':
          e.preventDefault()
          toggleSearch()
          break
        case 'l':
          e.preventDefault()
          if (focusedId) startLinking(focusedId)
          break
        case 'g': {
          e.preventDefault()
          const { selectedIds } = useStore.getState()
          if (selectedIds.length >= 1) {
            createSection(selectedIds)
          }
          break
        }
        case 's':
          e.preventDefault()
          saveWorkspace(undefined, true)
          break
        case 'd':
          if (e.shiftKey) {
            e.preventDefault()
            toggleDark()
          }
          break
        case '=':
        case '+':
          e.preventDefault()
          zoomIn()
          break
        case '-':
          e.preventDefault()
          zoomOut()
          break
      }
    }

    // Ctrl+Tab in capture phase — fires before xterm can consume the event
    const handleCtrlTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
        const { viewMode, setViewMode } = useStore.getState()
        setViewMode(viewMode === 'canvas' ? 'focus' : 'canvas')
      }
    }

    // Mod+Arrow in capture phase — cycle tiles in focus mode even when terminal is focused
    const handleCtrlArrow = (e: KeyboardEvent) => {
      const isMac = _platform === 'darwin'
      const modPressed = isMac ? e.metaKey : e.ctrlKey
      if (!modPressed || e.altKey || (isMac && e.ctrlKey) || (!isMac && e.metaKey)) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

      const { viewMode, tiles, focusedId: fid, focusTile: focus } = useStore.getState()
      if (viewMode !== 'focus' || tiles.length <= 1) return

      e.preventDefault()
      e.stopPropagation()

      // Use the focus-mode tab order (respects drag reordering) instead of raw tiles array
      const tileIds = new Set(tiles.map((t) => t.id))
      const cacheKey = [...tileIds].sort().join(',')
      const ordered = tabOrderCache.get(cacheKey)
      const orderedIds = ordered && ordered.length === tiles.length
        ? ordered.filter((id) => tileIds.has(id))
        : tiles.map((t) => t.id)

      const idx = orderedIds.indexOf(fid ?? '')
      const next = e.key === 'ArrowRight'
        ? (idx + 1) % orderedIds.length
        : (idx - 1 + orderedIds.length) % orderedIds.length
      focus(orderedIds[next])
    }

    window.addEventListener('keydown', handleCtrlTab, true) // capture phase
    window.addEventListener('keydown', handleCtrlArrow, true) // capture phase
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleCtrlTab, true)
      window.removeEventListener('keydown', handleCtrlArrow, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    focusedId, linkingFromId, workspaces,
    spawnTile, removeTile, undo, redo,
    toggleMinimap, toggleSearch, startLinking, cancelLinking,
    saveWorkspace, loadWorkspace,
    resetView, fitAllTiles, zoomIn, zoomOut,
    toggleDark, toggleShortcuts, createSection
  ])

  // ── Handle URL open requests from link clicks ────────────────────────────

  useEffect(() => {
    const cleanup = window.electronAPI.onOpenUrl((url) => {
      useStore.getState().spawnTile('browser', undefined, undefined, url)
    })
    return cleanup
  }, [])

  // ── Handle menu actions from main process ─────────────────────────────────

  useEffect(() => {
    const cleanup = window.electronAPI.onMenuAction((action) => {
      switch (action) {
        case 'new-terminal': spawnTile('terminal'); break
        case 'new-file-viewer': spawnTile('file'); break
        case 'new-canvas': useStore.getState().toggleConfirmClear(); break
        case 'close-tile': if (focusedId) removeTile(focusedId); break
        case 'save-workspace': saveWorkspace(undefined, true); break
        case 'undo': undo(); break
        case 'redo': redo(); break
        case 'toggle-minimap': toggleMinimap(); break
        case 'toggle-dark': toggleDark(); break
        case 'reset-zoom': resetView(); break
        case 'fit-tiles': fitAllTiles(); break
        case 'zoom-in': zoomIn(); break
        case 'zoom-out': zoomOut(); break
        case 'show-shortcuts': toggleShortcuts(); break
      }
    })
    return cleanup
  }, [
    focusedId,
    spawnTile, removeTile, saveWorkspace, undo, redo,
    toggleMinimap, toggleDark, resetView, fitAllTiles,
    zoomIn, zoomOut, toggleShortcuts
  ])
}
