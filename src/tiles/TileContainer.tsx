import React, { useState, useCallback, useRef, useEffect, Component } from 'react'
import { useStore } from '../store'
import { TerminalTile } from './TerminalTile'
import { HttpTile } from './HttpTile'
import { PostgresTile } from './PostgresTile'
import { BrowserTile } from './BrowserTile'
import { FileViewerTile, resetFileViewerState } from './FileViewerTile'
import { LensTile } from './LensTile'
import { DockerTile } from './DockerTile'
import { ChartTile } from './ChartTile'
import { InspectorTile } from './InspectorTile'
import { Pencil, Copy, RotateCcw, ClipboardCopy, Link, X, MoreHorizontal, Terminal, BarChart3, Minus, Plus } from 'lucide-react'
import { getTerminalEntry } from '../lib/terminalRegistry'
import type { ShellInfo } from '../types'
import { TileKindIcon } from './TileKindIcon'
import { SemanticZoom } from './SemanticZoom'
import type { Tile } from '../types'

export const TITLE_BAR_H = 28

interface Props {
  tile: Tile
  isSelected?: boolean
}

// ─── Error boundary ────────────────────────────────────────────────────────────

interface EBState { error: Error | null }
class TileErrorBoundary extends Component<{ children: React.ReactNode; tileId: string }, EBState> {
  constructor(props: { children: React.ReactNode; tileId: string }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
          <span className="text-red-400 text-2xl">⚠</span>
          <p className="text-red-300 text-xs font-medium">Tile crashed</p>
          <p className="text-text-muted text-[10px] max-w-xs break-words">{this.state.error.message}</p>
          <button
            className="mt-2 px-3 py-1 text-xs bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-text-secondary rounded transition-colors"
            onClick={() => { resetFileViewerState(this.props.tileId); this.setState({ error: null }) }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Tile container ────────────────────────────────────────────────────────────

export function TileContainer({ tile, isSelected }: Props) {
  const focusedId = useStore((s) => s.focusedId)
  const exitedTileIds = useStore((s) => s.exitedTileIds)
  const viewMode = useStore((s) => s.viewMode)
  const zoom = useStore((s) => s.zoom)
  const drag = useStore((s) => s.drag)
  const { focusTile, removeTile, renameTile, spawnTile, startLinking, setTileFontSize } = useStore()
  const isResizing = drag?.tileId === tile.id && drag?.kind === 'resize'
  const isFocused = focusedId === tile.id
  const isExited = exitedTileIds.includes(tile.id)

  const showContent = viewMode === 'canvas'

  // Semantic zoom: determine which representation to show based on zoom level
  const semanticMode: 'full' | 'summary' | 'badge' =
    zoom >= 0.8 ? 'full' :
    zoom >= 0.6 ? 'summary' :
    'badge'

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(tile.name)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Context menu state
  const [ctxMenuOpen, setCtxMenuOpen] = useState(false)
  const ctxMenuRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  // Mount animation state
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node) &&
        menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)
      ) {
        setCtxMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [ctxMenuOpen])

  const handleTitleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setRenameValue(tile.name)
      setIsRenaming(true)
      setTimeout(() => renameInputRef.current?.select(), 0)
    },
    [tile.name]
  )

  const commitRename = useCallback(() => {
    const name = renameValue.trim()
    if (name && name !== tile.name) renameTile(tile.id, name)
    setIsRenaming(false)
  }, [renameValue, tile.id, tile.name, renameTile])

  const handleRenameKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commitRename()
      if (e.key === 'Escape') setIsRenaming(false)
    },
    [commitRename]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setCtxMenuOpen(true)
    },
    []
  )

  const handleDuplicate = useCallback(() => {
    setCtxMenuOpen(false)
    const newTile = spawnTile(tile.kind, tile.x + 30, tile.y + 30)
    if (tile.userRenamed) {
      renameTile(newTile.id, tile.name + ' (copy)')
    }
  }, [tile, spawnTile, renameTile])

  const handleCopyCwd = useCallback(async () => {
    setCtxMenuOpen(false)
    if (tile.kind !== 'terminal') return
    const cwd = await window.electronAPI.ptyGetCwd(tile.id)
    if (cwd) navigator.clipboard.writeText(cwd)
  }, [tile.id, tile.kind])

  const handleRestartTerminal = useCallback(() => {
    setCtxMenuOpen(false)
    document.dispatchEvent(new CustomEvent('restart-terminal', { detail: { tileId: tile.id } }))
  }, [tile.id])

  const handleLinkOutput = useCallback(() => {
    setCtxMenuOpen(false)
    startLinking(tile.id)
  }, [tile.id, startLinking])

  const handleRenameCtx = useCallback(() => {
    setCtxMenuOpen(false)
    setRenameValue(tile.name)
    setIsRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [tile.name])

  const handleVisualizeSelection = useCallback(() => {
    setCtxMenuOpen(false)
    if (tile.kind !== 'terminal') return
    const entry = getTerminalEntry(tile.id)
    const selection = entry?.terminal.getSelection()
    if (!selection || !selection.trim()) return
    const chartTile = spawnTile('chart', tile.x + tile.w + 30, tile.y, undefined, undefined, undefined, selection)
    renameTile(chartTile.id, `Chart (${tile.name})`)
  }, [tile, spawnTile, renameTile])

  const handleClose = useCallback(() => {
    setCtxMenuOpen(false)
    removeTile(tile.id)
  }, [tile.id, removeTile])

  const borderClass = isExited
    ? 'border-red-500/40'
    : isSelected
      ? 'border-blue-400/50'
      : 'border-border'

  return (
    <div
      style={{
        position: 'absolute',
        left: tile.x,
        top: tile.y,
        width: tile.w,
        height: tile.h,
        zIndex: tile.zIndex,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'scale(1)' : 'scale(0.97)',
        transition: 'opacity 150ms ease, transform 150ms ease',
        transformOrigin: 'top left'
      }}
      onMouseDown={() => focusTile(tile.id)}
      onWheel={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation() }}
    >
      {/* Drop shadow / border */}
      <div
        className={[
          'absolute inset-0 rounded-xl overflow-hidden flex flex-col',
          'bg-tile border',
          borderClass
        ].join(' ')}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-3 bg-tile shrink-0 cursor-grab active:cursor-grabbing"
          style={{ height: TITLE_BAR_H, userSelect: 'none' }}
          onDoubleClick={handleTitleDoubleClick}
          onContextMenu={handleContextMenu}
        >
          {/* Kind icon */}
          <TileKindIcon kind={tile.kind} active={isFocused} exited={isExited} size={13} />

          {/* Title */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKey}
              className="flex-1 min-w-0 bg-transparent outline-none text-xs font-medium text-text-primary"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 min-w-0 truncate text-xs font-medium text-text-secondary">
              {tile.name}
            </span>
          )}

          {/* Link indicator */}
          {tile.outputLink && (
            <span className="text-yellow-400 text-xs" title="Output linked">⇒</span>
          )}

          {/* Font size controls (terminal only) */}
          {tile.kind === 'terminal' && (
            <div className="flex items-center gap-0.5 ml-auto" onMouseDown={(e) => e.stopPropagation()}>
              <button
                className="flex items-center justify-center w-4 h-4 rounded transition-colors"
                onClick={(e) => { e.stopPropagation(); setTileFontSize(tile.id, (tile.fontSize ?? 13) - 1) }}
                title="Decrease font size"
              >
                <Minus size={10} className="text-text-muted hover:text-text-primary" />
              </button>
              <span className="text-[9px] text-text-muted w-4 text-center select-none">{tile.fontSize ?? 13}</span>
              <button
                className="flex items-center justify-center w-4 h-4 rounded transition-colors"
                onClick={(e) => { e.stopPropagation(); setTileFontSize(tile.id, (tile.fontSize ?? 13) + 1) }}
                title="Increase font size"
              >
                <Plus size={10} className="text-text-muted hover:text-text-primary" />
              </button>
            </div>
          )}

          {/* Menu button */}
          <button
            ref={menuBtnRef}
            className={`flex items-center justify-center transition-colors ${tile.kind !== 'terminal' ? 'ml-auto' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setCtxMenuOpen((v) => !v)
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={14} className="text-text-muted hover:text-text-primary" />
          </button>
        </div>

        {/* Content area — skip rendering when canvas is hidden (focus mode)
            to avoid competing with FocusView for xterm/webview elements */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {showContent && semanticMode === 'full' && (
            <TileErrorBoundary tileId={tile.id}>
              {tile.kind === 'terminal' && <TerminalTile tileId={tile.id} />}
              {tile.kind === 'http' && <HttpTile tileId={tile.id} />}
              {tile.kind === 'postgres' && <PostgresTile tileId={tile.id} />}
              {tile.kind === 'browser' && <BrowserTile tileId={tile.id} />}
              {tile.kind === 'file' && <FileViewerTile tileId={tile.id} />}
              {tile.kind === 'lens' && <LensTile tileId={tile.id} />}
              {tile.kind === 'docker' && <DockerTile tileId={tile.id} />}
              {tile.kind === 'chart' && <ChartTile tileId={tile.id} />}
              {tile.kind === 'inspector' && <InspectorTile tileId={tile.id} />}
            </TileErrorBoundary>
          )}
          {showContent && semanticMode !== 'full' && (
            <SemanticZoom tile={tile} mode={semanticMode} />
          )}
        </div>

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize"
          style={{ pointerEvents: 'all' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" className="absolute bottom-1 right-1 text-text-muted/30">
            <path d="M14 14L8 14M14 14L14 8M14 14L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Resize overlay — shows terminal grid dimensions */}
        {isResizing && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div
              className="px-3 py-1.5 rounded-lg text-sm font-mono font-bold shadow-lg"
              style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
            >
              {tile.w} × {tile.h}
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenuOpen && (
        <ContextMenu
          ref={ctxMenuRef}
          tile={tile}
          onRename={handleRenameCtx}
          onDuplicate={handleDuplicate}
          onClose={handleClose}
          onRestartTerminal={handleRestartTerminal}
          onCopyCwd={handleCopyCwd}
          onLinkOutput={handleLinkOutput}
          onVisualizeSelection={handleVisualizeSelection}
        />
      )}
    </div>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface CtxMenuProps {
  tile: Tile
  onRename: () => void
  onDuplicate: () => void
  onClose: () => void
  onRestartTerminal: () => void
  onCopyCwd: () => void
  onLinkOutput: () => void
  onVisualizeSelection: () => void
}

const ContextMenu = React.forwardRef<HTMLDivElement, CtxMenuProps>(function ContextMenu(
  { tile, onRename, onDuplicate, onClose, onRestartTerminal, onCopyCwd, onLinkOutput, onVisualizeSelection },
  ref
) {
  const item = 'flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors'
  const sep = 'my-0.5 border-t border-border'
  const iconSize = 12
  const [shells, setShells] = useState<ShellInfo[]>([])
  const [showShells, setShowShells] = useState(false)
  const { spawnTile } = useStore()

  useEffect(() => {
    if (tile.kind === 'terminal') {
      window.electronAPI.shellsList().then(setShells)
    }
  }, [tile.kind])

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', right: 0, top: TITLE_BAR_H, zIndex: 99999 }}
      className="w-44 rounded border border-border bg-tile shadow-xl py-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={item} onClick={onRename}><Pencil size={iconSize} /> Rename</div>
      <div className={item} onClick={onDuplicate}><Copy size={iconSize} /> Duplicate</div>
      <div className={sep} />
      {tile.kind === 'terminal' && (
        <>
          <div className={item} onClick={onRestartTerminal}><RotateCcw size={iconSize} /> Restart</div>
          <div className={item} onClick={onCopyCwd}><ClipboardCopy size={iconSize} /> Copy CWD</div>
          <div className={item} onClick={onVisualizeSelection}><BarChart3 size={iconSize} /> Visualize Selection</div>
          {shells.length > 1 && (
            <div className="relative">
              <div
                className={item}
                onClick={() => setShowShells(!showShells)}
              >
                <Terminal size={iconSize} /> New with shell...
              </div>
              {showShells && (
                <div
                  className="absolute right-full top-0 mr-1 w-44 rounded border border-border bg-tile shadow-xl py-1"
                >
                  {shells.map((s) => (
                    <div
                      key={s.id}
                      className={item}
                      onClick={() => {
                        spawnTile('terminal', tile.x + 30, tile.y + 30, undefined, undefined, s.path)
                      }}
                    >
                      <span className="text-[10px] font-mono text-text-muted w-4 text-center">&gt;</span>
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div className={item} onClick={onLinkOutput}><Link size={iconSize} /> Link Output</div>
      <div className={sep} />
      <div className={`${item} hover:!text-red-400`} onClick={onClose}><X size={iconSize} /> Close</div>
    </div>
  )
})

