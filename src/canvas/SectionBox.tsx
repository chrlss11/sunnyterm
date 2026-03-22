import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { Section } from '../types'

const LABEL_H = 28
const RESIZE_HANDLE = 24

interface Props {
  section: Section
}

export function SectionBox({ section }: Props) {
  const zoom = useStore((s) => s.zoom)
  const isDark = useStore((s) => s.isDark)
  const { renameSection, removeSection, duplicateSection, moveSection, resizeSection } = useStore()

  const [isRenaming, setIsRenaming] = useState(false)
  const [nameValue, setNameValue] = useState(section.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  // ── Drag state ──────────────────────────────────────────────────────────────

  const dragRef = useRef<{
    kind: 'move' | 'resize'
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent, kind: 'move' | 'resize') => {
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startW: section.w,
      startH: section.h
    }

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return
      const dx = (ev.clientX - dragRef.current.startX) / zoom
      const dy = (ev.clientY - dragRef.current.startY) / zoom
      if (dragRef.current.kind === 'move') {
        moveSection(section.id, dx, dy)
        dragRef.current.startX = ev.clientX
        dragRef.current.startY = ev.clientY
      } else {
        resizeSection(section.id, dragRef.current.startW + dx, dragRef.current.startH + dy)
      }
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [zoom, section.id, section.w, section.h, moveSection, resizeSection])

  // ── Rename ──────────────────────────────────────────────────────────────────

  const startRename = useCallback(() => {
    setNameValue(section.name)
    setIsRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }, [section.name])

  const commitRename = useCallback(() => {
    const name = nameValue.trim()
    if (name && name !== section.name) renameSection(section.id, name)
    setIsRenaming(false)
  }, [nameValue, section.id, section.name, renameSection])

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setIsRenaming(false)
  }, [commitRename])

  // ── Context menu ────────────────────────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
  }, [])

  const borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)'

  return (
    <div
      style={{
        position: 'absolute',
        left: section.x,
        top: section.y,
        width: section.w,
        height: section.h
      }}
    >
      {/* Background + border (no pointer events — canvas interactions pass through) */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          border: `1.5px dashed ${borderColor}`,
          backgroundColor: isDark ? '#191a1c' : '#e0e2e6'
        }}
      />

      {/* Label / drag handle */}
      <div
        className="absolute flex items-center cursor-grab active:cursor-grabbing"
        style={{
          top: 0,
          left: 0,
          right: 0,
          height: LABEL_H,
          paddingLeft: 12,
          paddingRight: 12,
          userSelect: 'none'
        }}
        onPointerDown={(e) => handlePointerDown(e, 'move')}
        onDoubleClick={(e) => { e.stopPropagation(); startRename() }}
        onContextMenu={handleContextMenu}
      >
        {isRenaming ? (
          <input
            ref={inputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKey}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="bg-transparent outline-none text-[11px] font-semibold tracking-wide uppercase"
            style={{ color: labelColor, minWidth: 40 }}
          />
        ) : (
          <span
            className="text-[11px] font-semibold tracking-wide uppercase select-none"
            style={{ color: labelColor }}
          >
            {section.name}
          </span>
        )}
      </div>

      {/* Resize handle (bottom-right) */}
      <div
        className="absolute cursor-nwse-resize"
        style={{
          right: 0,
          bottom: 0,
          width: RESIZE_HANDLE,
          height: RESIZE_HANDLE
        }}
        onPointerDown={(e) => handlePointerDown(e, 'resize')}
      >
        <svg width={RESIZE_HANDLE} height={RESIZE_HANDLE} className="opacity-30">
          <line x1={RESIZE_HANDLE - 6} y1={RESIZE_HANDLE - 2} x2={RESIZE_HANDLE - 2} y2={RESIZE_HANDLE - 6}
            stroke={isDark ? '#fff' : '#000'} strokeWidth={1} />
          <line x1={RESIZE_HANDLE - 10} y1={RESIZE_HANDLE - 2} x2={RESIZE_HANDLE - 2} y2={RESIZE_HANDLE - 10}
            stroke={isDark ? '#fff' : '#000'} strokeWidth={1} />
        </svg>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <SectionContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onRename={() => { setCtxMenu(null); startRename() }}
          onDuplicate={() => { setCtxMenu(null); duplicateSection(section.id) }}
          onRemove={() => { setCtxMenu(null); removeSection(section.id) }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}

// ── Context menu (rendered as portal-like with window listener) ──────────────

function SectionContextMenu({ x, y, onRename, onDuplicate, onRemove, onClose }: {
  x: number; y: number
  onRename: () => void
  onDuplicate: () => void
  onRemove: () => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Use timeout so the opening right-click doesn't immediately close
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointerdown', handleDown)
    }
  }, [onClose])

  const item = 'flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors'

  return (
    <div
      ref={menuRef}
      className="absolute bg-tile border border-border rounded-lg shadow-xl py-1 z-[100]"
      style={{ top: y, left: x, minWidth: 140, pointerEvents: 'auto' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className={item} onPointerUp={onRename}>✏ Rename</div>
      <div className={item} onPointerUp={onDuplicate}>⧉ Duplicate</div>
      <div className="my-0.5 border-t border-border" />
      <div className={`${item} !text-red-400 hover:!text-red-300`} onPointerUp={onRemove}>✕ Remove Section</div>
    </div>
  )
}
