import React, { useEffect, useRef } from 'react'
import { InfiniteCanvas } from './canvas/InfiniteCanvas'
import { SearchBar } from './search/SearchBar'
import { WorkspacePicker } from './workspace/WorkspacePicker'
import { useKeyboard } from './hooks/useKeyboard'
import { useStore, DEFAULT_WORKSPACE } from './store'
import { FocusView } from './focus/FocusView'
import { Terminal, Globe, Database, Compass, FolderOpen, Undo2, Redo2, Map, Search, Palette, ZoomIn, ZoomOut, PanelLeftClose, PanelLeftOpen, ChevronDown } from 'lucide-react'
import { THEMES, THEME_ORDER, applyThemeCss, type ThemeName } from './lib/themes'
import type { ViewMode } from './types'
import { Toaster } from 'sonner'

// ── Auto-save debounce (ms) ───────────────────────────────────────────────────
const AUTO_SAVE_DEBOUNCE_MS = 2_000

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  return <AppInner />
}

function AppInner() {
  useKeyboard()
  const isDark = useStore((s) => s.isDark)
  const theme = useStore((s) => s.theme)
  const showShortcuts = useStore((s) => s.showShortcuts)
  const showConfirmClear = useStore((s) => s.showConfirmClear)
  const focusedId = useStore((s) => s.focusedId)
  const tiles = useStore((s) => s.tiles)
  const viewMode = useStore((s) => s.viewMode)
  const { initFromPersisted, toggleShortcuts, toggleConfirmClear, clearCanvas } = useStore()
  const initializedRef = useRef(false)
  const mainRef = useRef<HTMLDivElement>(null)

  // ── Prevent Electron from navigating on file drop ─────────────────────────
  // Must preventDefault on both dragover and drop to stop Electron's default
  // file-open behavior. Terminal tiles handle drops via their own React handlers.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault()
    document.addEventListener('dragover', prevent)
    document.addEventListener('drop', prevent)
    return () => {
      document.removeEventListener('dragover', prevent)
      document.removeEventListener('drop', prevent)
    }
  }, [])

  // ── Reset scroll positions when returning to canvas ────────────────────────
  useEffect(() => {
    if (viewMode === 'canvas' && mainRef.current) {
      // Reset any stale scroll that leaked from FocusView
      mainRef.current.scrollLeft = 0
      mainRef.current.scrollTop = 0
      // Also reset all scrollable children
      const scrollables = mainRef.current.querySelectorAll('*')
      scrollables.forEach((el) => {
        if (el.scrollLeft !== 0 || el.scrollTop !== 0) {
          // Only reset elements that aren't the canvas transform layer
          const isCanvasContent = el.closest('[style*="transform"]')
          if (!isCanvasContent) {
            el.scrollLeft = 0
            el.scrollTop = 0
          }
        }
      })
    }
  }, [viewMode])

  // ── Apply theme CSS variables on theme change ─────────────────────────────
  useEffect(() => {
    const themeDef = THEMES[theme as ThemeName] ?? THEMES.dark
    applyThemeCss(themeDef)
  }, [theme])

  // ── Init from persisted state on first mount ───────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    initFromPersisted()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced auto-save on meaningful canvas changes ──────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const debouncedSave = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        useStore.getState().saveWorkspace(DEFAULT_WORKSPACE)
      }, AUTO_SAVE_DEBOUNCE_MS)
    }

    const unsubscribe = useStore.subscribe((state, prevState) => {
      if (
        state.tiles !== prevState.tiles ||
        state.zoom !== prevState.zoom ||
        state.panX !== prevState.panX ||
        state.panY !== prevState.panY
      ) {
        debouncedSave()
      }
    })

    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [])

  // ── Save on window close ──────────────────────────────────────────────────
  useEffect(() => {
    const handleUnload = () => {
      useStore.getState().saveWorkspace(DEFAULT_WORKSPACE)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  // ── Update window title with focused tile name ────────────────────────────
  useEffect(() => {
    const tile = tiles.find((t) => t.id === focusedId)
    document.title = tile ? `${tile.name} — SunnyTerm` : 'SunnyTerm'
  }, [focusedId, tiles])

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden">
      {/* Toolbar */}
      <Toolbar />

      {/* Main view — InfiniteCanvas always mounted (in-flow), FocusView overlays on top */}
      <div ref={mainRef} className="flex-1 min-h-0 relative overflow-hidden">
        <InfiniteCanvas />
        <SearchBar />
        {viewMode === 'focus' && (
          <div
            className="absolute inset-0 z-10 bg-canvas overflow-hidden"
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <FocusView />
          </div>
        )}
      </div>

      <Toaster
        position="bottom-right"
        theme={isDark ? 'dark' : 'light'}
        toastOptions={{ style: { fontSize: '13px' } }}
      />

      {/* Confirm clear canvas modal */}
      {showConfirmClear && (
        <ConfirmClearModal
          tileCount={tiles.length}
          onConfirm={clearCanvas}
          onCancel={toggleConfirmClear}
        />
      )}

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <ShortcutsModal onClose={toggleShortcuts} />
      )}
    </div>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar() {
  const { spawnTile, toggleMinimap, toggleSearch, undo, redo, resetView, toggleDark, zoomIn, zoomOut, setViewMode } = useStore()
  const undoStack = useStore((s) => s.undoStack)
  const redoStack = useStore((s) => s.redoStack)
  const showMinimap = useStore((s) => s.showMinimap)
  const theme = useStore((s) => s.theme)
  const zoom = useStore((s) => s.zoom)
  const viewMode = useStore((s) => s.viewMode)
  const [expanded, setExpanded] = React.useState(false)

  const ico = 14
  const btn = 'p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/8 transition-colors flex items-center gap-1.5'
  const btnLabel = 'p-1.5 px-2 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/8 transition-colors flex items-center gap-1.5'
  const sep = 'w-px h-5 bg-border mx-0.5'

  return (
    <div
      className="flex items-center gap-0.5 px-3 shrink-0"
      style={{ height: 44, WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS traffic light spacer */}
      <div style={{ width: 72 }} />

      <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          className={btn}
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? 'Collapse toolbar' : 'Expand toolbar'}
        >
          {expanded ? <PanelLeftClose size={ico} /> : <PanelLeftOpen size={ico} />}
        </button>

        {expanded && (
          <>
            <div className={sep} />

            <button className={btn} onClick={() => spawnTile('terminal')} title="New Terminal (⌘T)">
              <Terminal size={ico} />
            </button>
            <button className={btn} onClick={() => spawnTile('http')} title="New HTTP Client (⌘⇧H)">
              <Globe size={ico} />
            </button>
            <button className={btn} onClick={() => spawnTile('postgres')} title="New PostgreSQL Client (⌘⇧P)">
              <Database size={ico} />
            </button>
            <button className={btn} onClick={() => spawnTile('browser')} title="New Browser (⌘⇧B)">
              <Compass size={ico} />
            </button>
            <button className={btn} onClick={() => spawnTile('file')} title="New File Viewer (⌘⇧E)">
              <FolderOpen size={ico} />
            </button>

            <div className={sep} />

            <button className={btn} onClick={undo} disabled={undoStack.length === 0} title="Undo (⌘Z)">
              <Undo2 size={ico} />
            </button>
            <button className={btn} onClick={redo} disabled={redoStack.length === 0} title="Redo (⌘⇧Z)">
              <Redo2 size={ico} />
            </button>

            <div className={sep} />

            <button
              className={`${btn} ${showMinimap ? 'text-blue-400' : ''}`}
              onClick={toggleMinimap}
              title="Toggle Minimap (⌘M)"
            >
              <Map size={ico} />
            </button>
            <button className={btn} onClick={toggleSearch} title="Search (⌘F)">
              <Search size={ico} />
            </button>

            <div className={sep} />

            <button className={btn} onClick={zoomOut} title="Zoom out (⌘-)">
              <ZoomOut size={ico} />
            </button>
            <button
              className={`${btn} font-mono tabular-nums min-w-[42px] justify-center text-[11px]`}
              onClick={resetView}
              title="Reset zoom (⌘0)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button className={btn} onClick={zoomIn} title="Zoom in (⌘+)">
              <ZoomIn size={ico} />
            </button>

            <div className={sep} />

            <ThemePicker />

            <div className={sep} />

            <WorkspacePicker />
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View mode toggle — hidden when toolbar is expanded */}
      {!expanded && <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />}
    </div>
  )
}

// ── View mode toggle ─────────────────────────────────────────────────────────

function ViewModeToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (m: ViewMode) => void }) {
  const isCanvas = viewMode === 'canvas'

  return (
    <div
      className="relative flex items-center rounded-full bg-black/8 dark:bg-white/6 p-[3px]"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Sliding pill */}
      <div
        className="absolute top-[3px] h-[calc(100%-6px)] w-[calc(50%-3px)] rounded-full bg-white/12 shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-200 ease-out"
        style={{ transform: isCanvas ? 'translateX(0)' : 'translateX(100%)' }}
      />

      <button
        onClick={() => onChange('canvas')}
        className={[
          'relative z-10 px-3 py-1 rounded-full text-[11px] font-medium transition-colors duration-150',
          isCanvas ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
        ].join(' ')}
      >
        Canvas
      </button>
      <button
        onClick={() => onChange('focus')}
        className={[
          'relative z-10 px-3 py-1 rounded-full text-[11px] font-medium transition-colors duration-150',
          !isCanvas ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
        ].join(' ')}
      >
        Focus
      </button>
    </div>
  )
}

// ── Confirm clear modal ──────────────────────────────────────────────────────

function ConfirmClearModal({ tileCount, onConfirm, onCancel }: { tileCount: number; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onConfirm, onCancel])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99998]"
      onClick={onCancel}
    >
      <div
        className="bg-tile border border-border rounded-lg shadow-2xl p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-text-primary font-semibold text-sm mb-2">New Canvas</h2>
        <p className="text-text-muted text-xs mb-4">
          This will close all {tileCount} tile{tileCount !== 1 ? 's' : ''} and start fresh. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="text-xs px-3 py-1.5 rounded-md border border-border text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
            onClick={onConfirm}
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Theme picker ──────────────────────────────────────────────────────────

const THEME_COLORS: Record<ThemeName, string> = {
  dark: '#1B1D1F',
  light: '#ffffff',
  claude: '#e8a44a',
  vino: '#c45a7c'
}

function ThemePicker() {
  const theme = useStore((s) => s.theme)
  const { setTheme } = useStore()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = THEMES[theme as ThemeName] ?? THEMES.dark

  return (
    <div ref={ref} className="relative">
      <button
        className="p-1.5 px-2 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/8 transition-colors flex items-center gap-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
          style={{ background: THEME_COLORS[current.name] }}
        />
        <span>{current.label}</span>
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-36 rounded-lg border border-border bg-tile shadow-xl py-1 z-50"
        >
          {THEME_ORDER.map((name) => {
            const t = THEMES[name]
            const isActive = name === current.name
            return (
              <div
                key={name}
                className={`flex items-center gap-2.5 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  isActive
                    ? 'text-text-primary bg-black/5 dark:bg-white/10'
                    : 'text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/8'
                }`}
                onClick={() => { setTheme(name); setOpen(false) }}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                  style={{ background: THEME_COLORS[name] }}
                />
                {t.label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Shortcuts modal ───────────────────────────────────────────────────────────

const SHORTCUTS: { key: string; desc: string }[] = [
  { key: '⌘T', desc: 'New Terminal' },
  { key: '⌘N', desc: 'New Terminal (alias)' },
  { key: '⌘⇧N', desc: 'New Canvas' },
  { key: '⌘⇧P', desc: 'New PostgreSQL pane' },
  { key: '⌘⇧B', desc: 'New Browser pane' },
  { key: '⌘⇧E', desc: 'New File Viewer' },
  { key: '⌘W', desc: 'Close focused tile' },
  { key: '⌘Z', desc: 'Undo' },
  { key: '⌘⇧Z', desc: 'Redo' },
  { key: '⌘M', desc: 'Toggle minimap' },
  { key: '⌘F', desc: 'Toggle search' },
  { key: '⌘L', desc: 'Start output linking' },
  { key: '⌘S', desc: 'Save workspace' },
  { key: '⌘0', desc: 'Reset zoom to 100%' },
  { key: '⌘⇧D', desc: 'Cycle theme' },
  { key: '⌘1–9', desc: 'Switch workspace by index' },
  { key: '⌘+/−', desc: 'Zoom in / out' },
  { key: 'Tab', desc: 'Focus next tile' },
  { key: '⇧Tab', desc: 'Focus previous tile' },
  { key: '?', desc: 'Show this help' },
  { key: '⌘G', desc: 'Group selected into section' },
  { key: 'Esc', desc: 'Cancel linking' },
  { key: 'Space+drag', desc: 'Pan canvas' },
  { key: '⌘+scroll', desc: 'Zoom canvas' },
  { key: 'Double-click', desc: 'New terminal at cursor' },
  { key: 'Right-click tile', desc: 'Context menu (rename, restart, etc.)' },
]

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99998]"
      onClick={onClose}
    >
      <div
        className="bg-tile border border-border rounded-lg shadow-2xl p-5 w-96 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary font-semibold text-sm">Keyboard Shortcuts</h2>
          <button
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between py-0.5">
              <span className="text-text-muted text-xs">{desc}</span>
              <kbd className="font-mono text-[11px] bg-black/5 dark:bg-white/10 text-text-secondary px-1.5 py-0.5 rounded border border-border">
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-text-muted text-[10px] text-center">Press ? or Esc to close</p>
      </div>
    </div>
  )
}
