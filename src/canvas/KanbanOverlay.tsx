import React, { useCallback } from 'react'
import { useStore } from '../store'
import { Plus } from 'lucide-react'
import type { Section } from '../types'

// Column header colors — one per column, cycling
const COLUMN_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
]

export function KanbanOverlay() {
  const kanbanMode = useStore((s) => s.kanbanMode)
  const sections = useStore((s) => s.sections)
  const tiles = useStore((s) => s.tiles)
  const { spawnTile } = useStore()

  if (!kanbanMode) return null

  const getTilesInSection = (section: Section) => {
    return tiles.filter(t => {
      const cx = t.x + t.w / 2
      const cy = t.y + t.h / 2
      return cx >= section.x && cx <= section.x + section.w &&
             cy >= section.y && cy <= section.y + section.h
    })
  }

  const handleAddTile = useCallback((section: Section) => {
    // Spawn a terminal tile positioned within this section
    const tileY = section.y + section.h - 24
    spawnTile('terminal', section.x + 12, tileY)
  }, [spawnTile])

  return (
    <>
      {sections.map((section, idx) => {
        const color = COLUMN_COLORS[idx % COLUMN_COLORS.length]
        const sectionTiles = getTilesInSection(section)

        return (
          <div
            key={section.id}
            style={{
              position: 'absolute',
              left: section.x,
              top: section.y,
              width: section.w,
              height: 40,
              zIndex: 0,
              pointerEvents: 'none',
            }}
          >
            {/* Colored header bar */}
            <div
              style={{
                height: 40,
                borderRadius: '12px 12px 0 0',
                background: `linear-gradient(135deg, ${color}22, ${color}11)`,
                borderBottom: `2px solid ${color}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                pointerEvents: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Color dot */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 6px ${color}80`,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {section.name}
                </span>
                {/* Count badge */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    background: 'var(--surface)',
                    padding: '1px 6px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  {sectionTiles.length}
                </span>
              </div>

              {/* Add tile button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleAddTile(section)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  transition: 'all 150ms ease',
                }}
                className="hover:bg-white/10 hover:text-white"
                title={`Add tile to ${section.name}`}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        )
      })}
    </>
  )
}
