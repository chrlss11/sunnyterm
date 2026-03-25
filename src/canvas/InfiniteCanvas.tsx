import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import { TileContainer, TITLE_BAR_H } from '../tiles/TileContainer'
import { SectionBox } from './SectionBox'
import { Minimap } from '../minimap/Minimap'
import { parseCurl } from '../lib/parseCurl'
import { TrailOverlay } from './TrailOverlay'
import { TrailControls } from './TrailControls'
import { CommandPalette, TargetingOverlay, type SpatialAction } from './CommandPalette'
import { KanbanOverlay } from './KanbanOverlay'
import { AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal, AlignCenterVertical, AlignCenterHorizontal, Rows3, Columns3, LayoutGrid, Terminal, Globe, Database, Compass, FolderOpen } from 'lucide-react'
import type { DragState, Tile, TileKind } from '../types'

const RESIZE_HANDLE = 32
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2

/** Hit-tests a screen-space point against a tile (canvas coords already mapped) */
function hitTest(
  canvasX: number,
  canvasY: number,
  tile: { x: number; y: number; w: number; h: number }
): { inTitle: boolean; inResize: boolean; inMenu: boolean; inTile: boolean } {
  const inTile =
    canvasX >= tile.x &&
    canvasX <= tile.x + tile.w &&
    canvasY >= tile.y &&
    canvasY <= tile.y + tile.h

  if (!inTile) return { inTitle: false, inResize: false, inMenu: false, inTile: false }

  const inTitle = canvasY <= tile.y + TITLE_BAR_H
  const inResize =
    canvasX >= tile.x + tile.w - RESIZE_HANDLE &&
    canvasY >= tile.y + tile.h - RESIZE_HANDLE
  const inMenu =
    canvasX >= tile.x + tile.w - TITLE_BAR_H &&
    canvasY <= tile.y + TITLE_BAR_H

  return { inTitle, inResize, inMenu, inTile }
}

export function InfiniteCanvas() {
  const zoom = useStore((s) => s.zoom)
  const panX = useStore((s) => s.panX)
  const panY = useStore((s) => s.panY)
  const tiles = useStore((s) => s.tiles)
  const showMinimap = useStore((s) => s.showMinimap)
  const drag = useStore((s) => s.drag)
  const linkingFromId = useStore((s) => s.linkingFromId)
  const selectedIds = useStore((s) => s.selectedIds)
  const sections = useStore((s) => s.sections)

  const {
    zoomAt, panBy, spawnTile, removeTile, focusTile,
    startDrag, updateDrag, endDrag,
    completeLinking, cancelLinking,
    setSelectedIds, clearSelection
  } = useStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const spaceHeld = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const lastClickTime = useRef(0)
  const [mouseScreen, setMouseScreen] = useState<{ x: number; y: number } | null>(null)
  const [lasso, setLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const isLassoing = useRef(false)
  const lassoStart = useRef({ x: 0, y: 0 })
  const [alignMenu, setAlignMenu] = useState<{ x: number; y: number } | null>(null)
  const [createMenu, setCreateMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null)
  const [showPalette, setShowPalette] = useState(false)
  const [targetingAction, setTargetingAction] = useState<SpatialAction | null>(null)
  const rightClickStart = useRef<{ x: number; y: number } | null>(null)
  const clickStart = useRef<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null)

  // Convert screen coords to canvas coords (accounting for container offset)
  const toCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      const ox = rect?.left ?? 0
      const oy = rect?.top ?? 0
      return {
        x: (screenX - ox - panX) / zoom,
        y: (screenY - oy - panY) / zoom
      }
    },
    [panX, panY, zoom]
  )

  // ── Handle spatial targeting completion ────────────────────────────────────

  const handlePlacement = useCallback((canvasX: number, canvasY: number) => {
    if (!targetingAction) return
    const snapX = Math.round(canvasX / 12) * 12
    const snapY = Math.round(canvasY / 12) * 12

    switch (targetingAction.type) {
      case 'run': {
        const tile = spawnTile('terminal', snapX, snapY)
        if (targetingAction.name) {
          useStore.getState().renameTile(tile.id, targetingAction.name)
        }
        if (targetingAction.command) {
          setTimeout(() => {
            window.electronAPI.ptyWrite(tile.id, targetingAction.command + '\n')
          }, 600)
        }
        break
      }
      case 'spawn':
        spawnTile(targetingAction.kind, snapX, snapY)
        break
      case 'connect':
        break
    }
    setTargetingAction(null)
  }, [targetingAction, spawnTile])

  // ── Keyboard (Space/Ctrl for pan, Cmd+K for palette) ────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey
      if (isMod && e.key === 'k') {
        e.preventDefault()
        setShowPalette(true)
        return
      }
      // Space OR Ctrl to enter pan mode (like Figma)
      if ((e.code === 'Space' && e.target === document.body) || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        spaceHeld.current = true
        if (containerRef.current) containerRef.current.style.cursor = 'grab'
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        spaceHeld.current = false
        if (containerRef.current) containerRef.current.style.cursor = 'default'
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // ── Paste curl detection ──────────────────────────────────────────────────

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // Only intercept paste on the canvas, not in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const text = e.clipboardData?.getData('text/plain')
      if (!text) return

      const parsed = parseCurl(text)
      if (!parsed) return

      e.preventDefault()

      const { spawnTile } = useStore.getState()
      const tile = spawnTile('http')

      // Store curl data for the HTTP tile to consume on mount
      useStore.setState((s) => ({
        pendingCurlData: { ...s.pendingCurlData, [tile.id]: parsed }
      }))
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  // ── Pointer events ────────────────────────────────────────────────────────

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (useStore.getState().viewMode === 'focus') return
      setAlignMenu(null)
      setCreateMenu(null)

      // Middle mouse or space+left = pan (right-click reserved for context menu)
      if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
        isPanning.current = true
        lastMouse.current = { x: e.clientX, y: e.clientY }
        e.currentTarget.setPointerCapture(e.pointerId)
        if (containerRef.current) containerRef.current.style.cursor = 'grabbing'
        return
      }

      if (e.button !== 0) return

      const canvas = toCanvas(e.clientX, e.clientY)

      // Sort tiles by zIndex descending (top-most first)
      const sorted = [...tiles].sort((a, b) => b.zIndex - a.zIndex)
      const hit = sorted.find((t) => {
        const r = hitTest(canvas.x, canvas.y, t)
        return r.inTile
      })

      if (!hit) {
        clearSelection()
        focusTile(null)

        // Record click start for distinguishing click vs lasso drag
        clickStart.current = { x: e.clientX, y: e.clientY, canvasX: canvas.x, canvasY: canvas.y }

        // Start lasso selection
        isLassoing.current = true
        lassoStart.current = { x: canvas.x, y: canvas.y }
        setLasso({ x1: canvas.x, y1: canvas.y, x2: canvas.x, y2: canvas.y })
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }

      focusTile(hit.id)
      const r = hitTest(canvas.x, canvas.y, hit)

      if (r.inMenu) {
        // Handled by the TileContainer menu button
        return
      }

      // Linking mode: clicking a tile completes the link
      if (linkingFromId) {
        if (hit.id !== linkingFromId) {
          completeLinking(hit.id)
        } else {
          cancelLinking()
        }
        return
      }

      if (r.inTitle || r.inResize) {
        // Build group starts if dragging a selected tile
        const isSelected = selectedIds.includes(hit.id)
        let groupStarts: Record<string, { x: number; y: number }> | undefined
        if (isSelected && r.inTitle) {
          groupStarts = {}
          for (const id of selectedIds) {
            const t = tiles.find((tt) => tt.id === id)
            if (t) groupStarts[id] = { x: t.x, y: t.y }
          }
        }

        const dragState: DragState = {
          tileId: hit.id,
          kind: r.inResize ? 'resize' : 'move',
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startTileX: hit.x,
          startTileY: hit.y,
          startTileW: hit.w,
          startTileH: hit.h,
          groupStarts
        }
        startDrag(dragState)
      }
    },
    [tiles, zoom, panX, panY, toCanvas, linkingFromId, selectedIds, focusTile, spawnTile, removeTile, startDrag, completeLinking, cancelLinking, clearSelection]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isPanning.current) {
        panBy(e.clientX - lastMouse.current.x, e.clientY - lastMouse.current.y)
        lastMouse.current = { x: e.clientX, y: e.clientY }
        return
      }
      if (isLassoing.current) {
        const canvas = toCanvas(e.clientX, e.clientY)
        setLasso({ x1: lassoStart.current.x, y1: lassoStart.current.y, x2: canvas.x, y2: canvas.y })
        // Select tiles intersecting the lasso
        const lx1 = Math.min(lassoStart.current.x, canvas.x)
        const ly1 = Math.min(lassoStart.current.y, canvas.y)
        const lx2 = Math.max(lassoStart.current.x, canvas.x)
        const ly2 = Math.max(lassoStart.current.y, canvas.y)
        const ids = tiles
          .filter((t) => t.x + t.w > lx1 && t.x < lx2 && t.y + t.h > ly1 && t.y < ly2)
          .map((t) => t.id)
        setSelectedIds(ids)
        return
      }
      if (drag) {
        updateDrag(e.clientX, e.clientY)
      }
    },
    [drag, panBy, updateDrag, toCanvas, tiles, setSelectedIds]
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isPanning.current) {
        isPanning.current = false
        if (containerRef.current) containerRef.current.style.cursor = 'default'
      }
      if (isLassoing.current) {
        isLassoing.current = false
        setLasso(null)
        clickStart.current = null
      }
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
      endDrag()
    },
    [endDrag]
  )

  // ── Wheel (zoom + pan) ────────────────────────────────────────────────────

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (useStore.getState().viewMode === 'focus') return
      e.preventDefault()
      if (e.metaKey || e.ctrlKey) {
        // Pinch-to-zoom (ctrlKey) or Cmd+scroll (metaKey):
        // Use exponential zoom so that fast pinches zoom faster than slow ones.
        // deltaY sign: positive = zoom out, negative = zoom in (standard browser behaviour)
        const { zoom: currentZoom, panX: currentPanX, panY: currentPanY } = useStore.getState()
        const rect = containerRef.current?.getBoundingClientRect()
        const localX = e.clientX - (rect?.left ?? 0)
        const localY = e.clientY - (rect?.top ?? 0)
        const factor = Math.exp(-e.deltaY * 0.008)
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, currentZoom * factor))
        const newPanX = localX - (localX - currentPanX) * (newZoom / currentZoom)
        const newPanY = localY - (localY - currentPanY) * (newZoom / currentZoom)
        useStore.setState({ zoom: newZoom, panX: newPanX, panY: newPanY })
      } else {
        // Plain scroll = pan
        panBy(-e.deltaX, -e.deltaY)
      }
    },
    [panBy]
  )

  // ── Context menu ─────────────────────────────────────────────────────────

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()

      // Don't open menus while lassoing or panning
      if (isLassoing.current || isPanning.current) return

      if (linkingFromId) {
        cancelLinking()
        return
      }

      if (selectedIds.length >= 2) {
        // Show align menu when tiles are selected
        setAlignMenu({ x: e.clientX, y: e.clientY })
      } else {
        // Show create menu on right-click on empty canvas
        const canvas = toCanvas(e.clientX, e.clientY)
        // Check if clicking on a tile — if so, let tile context menu handle it
        const sorted = [...tiles].sort((a, b) => b.zIndex - a.zIndex)
        const hit = sorted.find((t) => hitTest(canvas.x, canvas.y, t).inTile)
        if (!hit) {
          setCreateMenu({ x: e.clientX, y: e.clientY, canvasX: canvas.x, canvasY: canvas.y })
        }
      }
    },
    [linkingFromId, cancelLinking, selectedIds, tiles, toCanvas]
  )

  // ── Render ────────────────────────────────────────────────────────────────

  // Sort tiles for rendering (lowest zIndex first = rendered below)
  const sortedTiles = [...tiles].sort((a, b) => a.zIndex - b.zIndex)

  const isDark = useStore((s) => s.isDark)
  const gridSpacing = 16
  const dotColor = isDark ? 'rgba(255,255,255,0.13)' : 'rgba(138,138,150,0.25)'
  const glowDotColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(100,100,120,0.6)'

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden w-full h-full bg-canvas select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onContextMenu={onContextMenu}
      onMouseMove={(e) => setMouseScreen({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setMouseScreen(null)}
      style={{ touchAction: 'none' }}
    >
      {/* Dot grid (screen-space, not affected by canvas scale) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at center, ${dotColor} 1px, transparent 1px)`,
          backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
          backgroundPosition: `${panX % gridSpacing}px ${panY % gridSpacing}px`
        }}
      />

      {/* Glow layer near cursor */}
      {mouseScreen && containerRef.current && (() => {
        const rect = containerRef.current!.getBoundingClientRect()
        const localX = mouseScreen.x - rect.left
        const localY = mouseScreen.y - rect.top
        return (
          <div
            className="absolute pointer-events-none"
            style={{
              left: localX - GLOW_RADIUS,
              top: localY - GLOW_RADIUS,
              width: GLOW_RADIUS * 2,
              height: GLOW_RADIUS * 2,
              backgroundImage: `radial-gradient(circle at center, ${glowDotColor} 1px, transparent 1px)`,
              backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
              backgroundPosition: `${(panX % gridSpacing) - (localX - GLOW_RADIUS)}px ${(panY % gridSpacing) - (localY - GLOW_RADIUS)}px`,
              mask: 'radial-gradient(circle, black 0%, transparent 70%)',
              WebkitMask: 'radial-gradient(circle, black 0%, transparent 70%)'
            }}
          />
        )
      })()}

      {/* Canvas transform layer — uses CSS zoom instead of transform: scale()
           so that interactive children (xterm.js terminals) get correct
           pointer-event coordinate mapping from the browser. */}
      <div
        style={{
          position: 'absolute',
          transform: `translate(${panX / zoom}px, ${panY / zoom}px)`,
          zoom: zoom,
        }}
      >

        {/* Sections (behind tiles) */}
        {sections.map((section) => (
          <SectionBox key={section.id} section={section} />
        ))}

        {/* Kanban column headers (on top of sections, behind tiles) */}
        <KanbanOverlay />

        {/* Tiles */}
        {sortedTiles.map((tile) => (
          <TileContainer key={tile.id} tile={tile} isSelected={selectedIds.includes(tile.id)} />
        ))}

        {/* Lasso selection rectangle */}
        {lasso && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(lasso.x1, lasso.x2),
              top: Math.min(lasso.y1, lasso.y2),
              width: Math.abs(lasso.x2 - lasso.x1),
              height: Math.abs(lasso.y2 - lasso.y1),
              border: '1.5px dashed rgba(100,150,255,0.5)',
              backgroundColor: 'rgba(100,150,255,0.08)',
              borderRadius: 4,
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Canvas trail overlay (inside canvas transform) */}
        <TrailOverlay />
      </div>

      {/* Link lines overlay (screen-space SVG, not scaled by canvas transform) */}
      <LinkLines tiles={tiles} panX={panX} panY={panY} zoom={zoom} />

      {/* Canvas trail controls (floating, bottom-left) */}
      <TrailControls />

      {/* Minimap (fixed overlay, not affected by canvas transform) */}
      {showMinimap && <Minimap />}

      {/* Align context menu */}
      {alignMenu && selectedIds.length >= 2 && (
        <AlignMenu
          x={alignMenu.x}
          y={alignMenu.y}
          containerRef={containerRef}
          onClose={() => setAlignMenu(null)}
        />
      )}

      {/* Create tile context menu */}
      {createMenu && (
        <CreateMenu
          x={createMenu.x}
          y={createMenu.y}
          canvasX={createMenu.canvasX}
          canvasY={createMenu.canvasY}
          containerRef={containerRef}
          onClose={() => setCreateMenu(null)}
        />
      )}

      {/* Spatial Command Palette */}
      {showPalette && (
        <CommandPalette
          onClose={() => setShowPalette(false)}
          onStartTargeting={(action) => setTargetingAction(action)}
        />
      )}

      {/* Targeting overlay (click to place) */}
      {targetingAction && (
        <TargetingOverlay
          action={targetingAction}
          onCancel={() => setTargetingAction(null)}
          onPlace={handlePlacement}
        />
      )}
    </div>
  )
}

// ── Link lines overlay ────────────────────────────────────────────────────────

interface LinkLinesProps {
  tiles: Tile[]
  panX: number
  panY: number
  zoom: number
}

function LinkLines({ tiles, panX, panY, zoom }: LinkLinesProps) {
  // Compute screen-space center of a tile's right edge
  const tileCenterRight = (t: Tile) => ({
    x: (t.x + t.w) * zoom + panX,
    y: (t.y + t.h / 2) * zoom + panY
  })
  const tileCenterLeft = (t: Tile) => ({
    x: t.x * zoom + panX,
    y: (t.y + t.h / 2) * zoom + panY
  })

  const links = tiles.flatMap((t) => {
    if (!t.outputLink) return []
    const target = tiles.find((o) => o.id === t.outputLink)
    if (!target) return []
    const from = tileCenterRight(t)
    const to = tileCenterLeft(target)
    return [{ id: `${t.id}->${t.outputLink}`, from, to }]
  })

  if (links.length === 0) return null

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      <defs>
        <marker id="link-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#facc15" opacity="0.8" />
        </marker>
      </defs>
      {links.map(({ id, from, to }) => {
        const cx1 = from.x + Math.abs(to.x - from.x) * 0.4
        const cx2 = to.x - Math.abs(to.x - from.x) * 0.4
        return (
          <path
            key={id}
            d={`M ${from.x} ${from.y} C ${cx1} ${from.y}, ${cx2} ${to.y}, ${to.x} ${to.y}`}
            stroke="#facc15"
            strokeWidth="1.5"
            strokeOpacity="0.7"
            fill="none"
            strokeDasharray="4 3"
            markerEnd="url(#link-arrow)"
          />
        )
      })}
    </svg>
  )
}

// ── Create tile context menu ────────────────────────────────────────────────

function CreateMenu({ x, y, canvasX, canvasY, containerRef, onClose }: {
  x: number; y: number; canvasX: number; canvasY: number
  containerRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
}) {
  const { spawnTile, spawnSection } = useStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const rect = containerRef.current?.getBoundingClientRect()
  const menuX = x - (rect?.left ?? 0)
  const menuY = y - (rect?.top ?? 0)

  const item = 'flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors'
  const ico = 13

  const { alignTiles, tiles: allTiles } = useStore()

  const spawn = (kind: TileKind) => {
    spawnTile(kind, canvasX - 320, canvasY - 200)
    onClose()
  }

  const handleArrangeGrid = () => {
    // Select all tiles then align as grid
    const allIds = allTiles.map((t) => t.id)
    useStore.getState().setSelectedIds(allIds)
    alignTiles('grid')
    useStore.getState().clearSelection()
    onClose()
  }

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', left: menuX, top: menuY, zIndex: 99999 }}
      className="w-44 rounded-lg border border-border bg-tile shadow-xl py-1"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1 text-[10px] text-text-muted font-medium uppercase tracking-wider">New Tile</div>
      <div className={item} onClick={() => spawn('terminal')}><Terminal size={ico} /> Terminal</div>
      <div className={item} onClick={() => spawn('http')}><Globe size={ico} /> HTTP</div>
      <div className={item} onClick={() => spawn('postgres')}><Database size={ico} /> PostgreSQL</div>
      <div className={item} onClick={() => spawn('browser')}><Compass size={ico} /> Browser</div>
      <div className={item} onClick={() => spawn('file')}><FolderOpen size={ico} /> File Viewer</div>
      <div className={item} onClick={() => spawn('inspector')}>
        <svg width={ico} height={ico} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
          <path d="M5.5 6h3" />
          <path d="M5.5 8h2" />
        </svg>
        Inspector
      </div>
      <div className="my-1 border-t border-border" />
      <div className={item} onClick={() => { spawnSection(canvasX - 320, canvasY - 200); onClose() }}><LayoutGrid size={ico} /> Group</div>
      {allTiles.length > 1 && (
        <>
          <div className="my-0.5 border-t border-border" />
          <div className={item} onClick={handleArrangeGrid}><LayoutGrid size={ico} /> Arrange in Grid</div>
        </>
      )}
    </div>
  )
}

// ── Align context menu ──────────────────────────────────────────────────────

function AlignMenu({ x, y, containerRef, onClose }: {
  x: number; y: number
  containerRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
}) {
  const { alignTiles } = useStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const rect = containerRef.current?.getBoundingClientRect()
  const menuX = x - (rect?.left ?? 0)
  const menuY = y - (rect?.top ?? 0)

  const item = 'flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors'
  const sep = 'my-0.5 border-t border-border'
  const ico = 13

  const handle = (dir: Parameters<typeof alignTiles>[0]) => {
    alignTiles(dir)
    onClose()
  }

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', left: menuX, top: menuY, zIndex: 99999 }}
      className="w-48 rounded-lg border border-border bg-tile shadow-xl py-1"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1 text-[10px] text-text-muted font-medium uppercase tracking-wider">Align</div>
      <div className={item} onClick={() => handle('left')}><AlignStartVertical size={ico} /> Align Left</div>
      <div className={item} onClick={() => handle('h-center')}><AlignCenterVertical size={ico} /> Align Center</div>
      <div className={item} onClick={() => handle('right')}><AlignEndVertical size={ico} /> Align Right</div>
      <div className={sep} />
      <div className={item} onClick={() => handle('top')}><AlignStartHorizontal size={ico} /> Align Top</div>
      <div className={item} onClick={() => handle('v-center')}><AlignCenterHorizontal size={ico} /> Align Middle</div>
      <div className={item} onClick={() => handle('bottom')}><AlignEndHorizontal size={ico} /> Align Bottom</div>
      <div className={sep} />
      <div className="px-3 py-1 text-[10px] text-text-muted font-medium uppercase tracking-wider">Distribute</div>
      <div className={item} onClick={() => handle('h-distribute')}><Columns3 size={ico} /> Distribute Horizontally</div>
      <div className={item} onClick={() => handle('v-distribute')}><Rows3 size={ico} /> Distribute Vertically</div>
      <div className={item} onClick={() => handle('grid')}><LayoutGrid size={ico} /> Arrange in Grid</div>
    </div>
  )
}

// ── Dot grid constants ───────────────────────────────────────────────────────

const GRID_SPACING = 24
const GLOW_RADIUS = 180
