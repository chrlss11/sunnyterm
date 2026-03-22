import React, { useState, useCallback, useRef, useEffect, Component } from 'react'
import { useStore } from '../store'
import { TerminalTile } from './TerminalTile'
import { HttpTile } from './HttpTile'
import { PostgresTile } from './PostgresTile'
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
          <p className="text-white/30 text-[10px] max-w-xs break-words">{this.state.error.message}</p>
          <button
            className="mt-2 px-3 py-1 text-xs bg-white/10 hover:bg-white/20 text-white/70 rounded transition-colors"
            onClick={() => this.setState({ error: null })}
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
  const { focusTile, removeTile, renameTile, spawnTile, startLinking } = useStore()
  const isFocused = focusedId === tile.id
  const isExited = exitedTileIds.includes(tile.id)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(tile.name)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  // Mount animation state
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    const handleClick = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [ctxMenu])

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
      setCtxMenu({ x: e.clientX, y: e.clientY })
    },
    []
  )

  const handleDuplicate = useCallback(() => {
    setCtxMenu(null)
    const newTile = spawnTile(tile.kind, tile.x + 30, tile.y + 30)
    if (tile.userRenamed) {
      renameTile(newTile.id, tile.name + ' (copy)')
    }
  }, [tile, spawnTile, renameTile])

  const handleCopyCwd = useCallback(async () => {
    setCtxMenu(null)
    if (tile.kind !== 'terminal') return
    const cwd = await window.electronAPI.ptyGetCwd(tile.id)
    if (cwd) navigator.clipboard.writeText(cwd)
  }, [tile.id, tile.kind])

  const handleRestartTerminal = useCallback(() => {
    setCtxMenu(null)
    document.dispatchEvent(new CustomEvent('restart-terminal', { detail: { tileId: tile.id } }))
  }, [tile.id])

  const handleLinkOutput = useCallback(() => {
    setCtxMenu(null)
    startLinking(tile.id)
  }, [tile.id, startLinking])

  const handleRenameCtx = useCallback(() => {
    setCtxMenu(null)
    setRenameValue(tile.name)
    setIsRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [tile.name])

  const handleClose = useCallback(() => {
    setCtxMenu(null)
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
          {/* Kind indicator dot */}
          <KindDot kind={tile.kind} isExited={isExited} isFocused={isFocused} />

          {/* Title */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKey}
              className="flex-1 min-w-0 bg-transparent outline-none text-xs font-medium text-white/90"
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

          {/* Close button */}
          <button
            className="hover:text-red-400 flex items-center justify-center transition-colors ml-auto"
            onClick={(e) => { e.stopPropagation(); removeTile(tile.id) }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-text-muted hover:text-red-400 text-sm leading-none">×</span>
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <TileErrorBoundary tileId={tile.id}>
            {tile.kind === 'terminal' && <TerminalTile tileId={tile.id} />}
            {tile.kind === 'http' && <HttpTile tileId={tile.id} />}
            {tile.kind === 'postgres' && <PostgresTile tileId={tile.id} />}
          </TileErrorBoundary>
        </div>

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize"
          style={{ pointerEvents: 'all' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" className="absolute bottom-1 right-1 text-white/20">
            <path d="M14 14L8 14M14 14L14 8M14 14L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          ref={ctxMenuRef}
          x={ctxMenu.x}
          y={ctxMenu.y}
          tile={tile}
          onRename={handleRenameCtx}
          onDuplicate={handleDuplicate}
          onClose={handleClose}
          onRestartTerminal={handleRestartTerminal}
          onCopyCwd={handleCopyCwd}
          onLinkOutput={handleLinkOutput}
        />
      )}
    </div>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface CtxMenuProps {
  x: number
  y: number
  tile: Tile
  onRename: () => void
  onDuplicate: () => void
  onClose: () => void
  onRestartTerminal: () => void
  onCopyCwd: () => void
  onLinkOutput: () => void
}

const ContextMenu = React.forwardRef<HTMLDivElement, CtxMenuProps>(function ContextMenu(
  { x, y, tile, onRename, onDuplicate, onClose, onRestartTerminal, onCopyCwd, onLinkOutput },
  ref
) {
  const item = 'flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors'
  const sep = 'my-0.5 border-t border-border'

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 160),
    top: Math.min(y, window.innerHeight - 200),
    zIndex: 99999
  }

  return (
    <div
      ref={ref}
      style={style}
      className="w-40 rounded border border-border bg-tile shadow-xl py-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={item} onClick={onRename}>✏ Rename</div>
      <div className={item} onClick={onDuplicate}>⧉ Duplicate</div>
      <div className={sep} />
      {tile.kind === 'terminal' && (
        <>
          <div className={item} onClick={onRestartTerminal}>↺ Restart Terminal</div>
          <div className={item} onClick={onCopyCwd}>📋 Copy CWD</div>
        </>
      )}
      <div className={item} onClick={onLinkOutput}>⇒ Link Output</div>
      <div className={sep} />
      <div className={`${item} hover:text-red-400`} onClick={onClose}>✕ Close</div>
    </div>
  )
})

// ── Sub-components ────────────────────────────────────────────────────────────

function KindDot({ kind, isExited, isFocused }: { kind: Tile['kind']; isExited: boolean; isFocused: boolean }) {
  const colors = isExited
    ? 'bg-red-400/60'
    : !isFocused
      ? 'bg-black/15 dark:bg-white/20'
      : { terminal: 'bg-green-400', http: 'bg-blue-400', postgres: 'bg-purple-400' }[kind]
  return <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors}`} />
}
