import React, { useEffect, useRef } from 'react'
import { InfiniteCanvas } from './canvas/InfiniteCanvas'
import { SearchBar } from './search/SearchBar'
import { WorkspacePicker } from './workspace/WorkspacePicker'
import { useKeyboard } from './hooks/useKeyboard'
import { useStore, DEFAULT_WORKSPACE } from './store'
import { FocusView } from './focus/FocusView'
import { Terminal, Globe, Database, Compass, FolderOpen, Undo2, Redo2, Map, Search, Palette, ZoomIn, ZoomOut, PanelLeftClose, PanelLeftOpen, ChevronDown, Container, LayoutGrid, PanelTop, Columns3 } from 'lucide-react'
import { ShellPicker } from './tiles/ShellPicker'
import { THEMES, THEME_ORDER, applyThemeCss, type ThemeName } from './lib/themes'
import { initMcpBridge } from './lib/mcpBridge'
import { initConfigBridge } from './lib/configBridge'
import { UpdateNotification } from './lib/UpdateNotification'
import { useResonance } from './lib/resonance'
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
    initMcpBridge() // Start MCP bridge for Claude Code integration
    initConfigBridge() // Start config hot-reload bridge
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
      {/* Top bar — minimal: window drag area + view mode toggle */}
      <TitleBar />

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

        {/* Canvas bottom toolbar */}
        {viewMode === 'canvas' && <CanvasToolbar />}
      </div>

      {/* Auto-update notification */}
      <UpdateNotification />

      {/* Resonance bar */}
      <ResonanceBar />

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

// ── Title bar (minimal top bar for window dragging) ──────────────────────────

function TitleBar() {
  const viewMode = useStore((s) => s.viewMode)
  const { setViewMode } = useStore()

  return (
    <div
      className="flex items-center justify-center px-3 shrink-0"
      style={{ height: 44, WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* View mode toggle — centered */}
      <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
    </div>
  )
}

// ── Canvas bottom toolbar ────────────────────────────────────────────────────

function CanvasToolbar() {
  const { spawnTile, toggleMinimap, toggleSearch, undo, redo, resetView, zoomIn, zoomOut, toggleAutoGrid, toggleKanbanMode } = useStore()
  const undoStack = useStore((s) => s.undoStack)
  const redoStack = useStore((s) => s.redoStack)
  const showMinimap = useStore((s) => s.showMinimap)
  const autoGrid = useStore((s) => s.autoGrid)
  const kanbanMode = useStore((s) => s.kanbanMode)
  const zoom = useStore((s) => s.zoom)
  const [expanded, setExpanded] = React.useState(true)
  const [platform, setPlatform] = React.useState<string>('darwin')

  React.useEffect(() => {
    window.electronAPI.getPlatform().then(setPlatform)
  }, [])

  const isMac = platform === 'darwin'
  const mod = isMac ? '⌘' : 'Ctrl+'

  const ico = 14
  const btn = 'p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/8 transition-colors flex items-center gap-1.5 cursor-pointer'
  const sep = 'w-px h-5 bg-border mx-0.5'

  return (
    <div
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 px-2 py-1 rounded-xl border border-border bg-toolbar/80 backdrop-blur-md shadow-lg"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
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

          <button className={btn} onClick={() => spawnTile('terminal')} title={`New Terminal (${mod}T)`}>
            <Terminal size={ico} />
          </button>
          <ShellPicker />
          <button className={btn} onClick={() => spawnTile('http')} title={`New HTTP Client (${mod}⇧H)`}>
            <Globe size={ico} />
          </button>
          <button className={btn} onClick={() => spawnTile('postgres')} title={`New PostgreSQL Client (${mod}⇧P)`}>
            <Database size={ico} />
          </button>
          <button className={btn} onClick={() => spawnTile('browser')} title={`New Browser (${mod}⇧B)`}>
            <Compass size={ico} />
          </button>
          <button className={btn} onClick={() => spawnTile('file')} title={`New File Viewer (${mod}⇧E)`}>
            <FolderOpen size={ico} />
          </button>
          <button className={btn} onClick={() => spawnTile('lens')} title="New Lens (filtered view)">
            <Search size={ico} />
          </button>
          <button className={btn} onClick={() => spawnTile('docker')} title="New Docker Topology">
            <Container size={ico} />
          </button>

          <div className={sep} />

          <button className={btn} onClick={undo} disabled={undoStack.length === 0} title={`Undo (${mod}Z)`}>
            <Undo2 size={ico} />
          </button>
          <button className={btn} onClick={redo} disabled={redoStack.length === 0} title={`Redo (${mod}⇧Z)`}>
            <Redo2 size={ico} />
          </button>

          <div className={sep} />

          <button
            className={`${btn} ${showMinimap ? 'text-blue-400' : ''}`}
            onClick={toggleMinimap}
            title={`Toggle Minimap (${mod}M)`}
          >
            <Map size={ico} />
          </button>
          <button
            className={`${btn} ${autoGrid ? 'text-green-400' : ''}`}
            onClick={toggleAutoGrid}
            title="Auto-Grid (tiles auto-arrange, no overlap)"
          >
            <LayoutGrid size={ico} />
          </button>
          <button
            className={`${btn} ${kanbanMode ? 'text-green-400' : ''}`}
            onClick={toggleKanbanMode}
            title="Kanban Mode (sections as columns)"
          >
            <Columns3 size={ico} />
          </button>
          <button className={btn} onClick={toggleSearch} title={`Search (${mod}F)`}>
            <Search size={ico} />
          </button>
          <button
            className={btn}
            onClick={() => window.electronAPI.quickTerminalToggle()}
            title="Quick Terminal Mode (Ctrl+`)"
          >
            <PanelTop size={ico} />
          </button>

          <div className={sep} />

          <button className={btn} onClick={zoomOut} title={`Zoom out (${mod}-)`}>
            <ZoomOut size={ico} />
          </button>
          <button
            className={`${btn} font-mono tabular-nums min-w-[42px] justify-center text-[11px]`}
            onClick={resetView}
            title={`Reset zoom (${mod}0)`}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button className={btn} onClick={zoomIn} title={`Zoom in (${mod}+)`}>
            <ZoomIn size={ico} />
          </button>

          <div className={sep} />

          <ThemePicker />

          <div className={sep} />

          <WorkspacePicker />
        </>
      )}
    </div>
  )
}

// ── View mode toggle ─────────────────────────────────────────────────────────

function ViewModeToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (m: ViewMode) => void }) {
  const isCanvas = viewMode === 'canvas'

  return (
    <div
      className="relative flex items-center rounded-full bg-white dark:bg-white/6 p-[3px] border border-black/8 dark:border-transparent"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Sliding pill */}
      <div
        className="absolute top-[3px] h-[calc(100%-6px)] w-[calc(50%-3px)] rounded-full bg-canvas dark:bg-white/12 shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-out"
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
  'github-light': '#0969da',
  'rose-pine-dawn': '#d7827e',
  'solarized-light': '#eee8d5',
  nord: '#88c0d0',
  dracula: '#bd93f9',
  monokai: '#a6e22e',
  solarized: '#268bd2',
  tokyo: '#7aa2f7',
  catppuccin: '#cba6f7',
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
          className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 dark:border-white/20"
          style={{ background: THEME_COLORS[current.name] }}
        />
        <span className="whitespace-nowrap">{current.label}</span>
        <ChevronDown size={10} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 w-36 rounded-lg border border-border bg-tile shadow-xl py-1 z-50"
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
                  className="w-3 h-3 rounded-full shrink-0 border border-black/10 dark:border-white/20"
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

function getShortcuts(mod: string): { key: string; desc: string }[] {
  return [
    { key: `${mod}T`, desc: 'New Terminal' },
    { key: `${mod}N`, desc: 'New Terminal (alias)' },
    { key: `${mod}⇧N`, desc: 'New Canvas' },
    { key: `${mod}⇧P`, desc: 'New PostgreSQL pane' },
    { key: `${mod}⇧B`, desc: 'New Browser pane' },
    { key: `${mod}⇧E`, desc: 'New File Viewer' },
    { key: `${mod}W`, desc: 'Close focused tile' },
    { key: `${mod}Z`, desc: 'Undo' },
    { key: `${mod}⇧Z`, desc: 'Redo' },
    { key: `${mod}M`, desc: 'Toggle minimap' },
    { key: `${mod}F`, desc: 'Toggle search' },
    { key: `${mod}L`, desc: 'Start output linking' },
    { key: `${mod}S`, desc: 'Save workspace' },
    { key: `${mod}0`, desc: 'Reset zoom to 100%' },
    { key: `${mod}⇧D`, desc: 'Cycle theme' },
    { key: `${mod}1–9`, desc: 'Switch workspace by index' },
    { key: `${mod}+/−`, desc: 'Zoom in / out' },
    { key: 'Tab', desc: 'Focus next tile' },
    { key: '⇧Tab', desc: 'Focus previous tile' },
    { key: '?', desc: 'Show this help' },
    { key: `${mod}G`, desc: 'Group selected into section' },
    { key: `${mod}K`, desc: 'Command palette' },
    { key: `${mod}⇧T`, desc: 'Restore closed tile' },
    { key: 'Esc', desc: 'Cancel linking' },
    { key: 'Ctrl+`', desc: 'Quick Terminal (show/hide)' },
    { key: 'Space+drag', desc: 'Pan canvas' },
    { key: `${mod}+scroll`, desc: 'Zoom canvas' },
    { key: 'Double-click', desc: 'New terminal at cursor' },
    { key: 'Right-click tile', desc: 'Context menu (rename, restart, etc.)' },
  ]
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const [platform, setPlatform] = React.useState<string>('darwin')

  useEffect(() => {
    window.electronAPI.getPlatform().then(setPlatform)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const mod = platform === 'darwin' ? '⌘' : 'Ctrl+'
  const shortcuts = getShortcuts(mod)

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
          {shortcuts.map(({ key, desc }) => (
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

// ── Resonance bar (cross-tile text highlighting indicator) ───────────────────

function ResonanceBar() {
  const text = useResonance((s) => s.text)
  const matches = useResonance((s) => s.matches)
  const clearResonance = useResonance((s) => s.clearResonance)
  const tiles = useStore((s) => s.tiles)

  if (!text) return null

  const totalMatches = matches.reduce((sum, m) => sum + m.count, 0)

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-1.5 rounded-full shadow-lg z-[9999] text-xs"
      style={{
        background: 'var(--surface)',
        border: '1px solid #f9e2af44',
        color: '#f9e2af',
      }}
    >
      <span className="font-mono text-[11px] bg-black/20 px-2 py-0.5 rounded max-w-48 truncate">
        "{text}"
      </span>
      <span className="text-text-muted">
        {totalMatches} matches in {matches.length} tile{matches.length !== 1 ? 's' : ''}
      </span>
      {matches.slice(0, 5).map((m) => {
        const tile = tiles.find((t) => t.id === m.tileId)
        return (
          <span key={m.tileId} className="text-[10px] text-text-secondary">
            {tile?.name ?? m.tileId}: {m.count}
          </span>
        )
      })}
      <button
        className="text-text-muted hover:text-white transition-colors cursor-pointer ml-1"
        onClick={clearResonance}
        title="Clear resonance"
      >
        ×
      </button>
    </div>
  )
}
