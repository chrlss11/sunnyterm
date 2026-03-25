import React from 'react'
import type { Tile } from '../types'

interface Props {
  kind: Tile['kind']
  active: boolean
  exited?: boolean
  size?: number
}

/**
 * Renders an SVG icon representing the tile type.
 * Active tiles use var(--primary), inactive use the same at 40% opacity.
 * Exited tiles always show red.
 */
export function TileKindIcon({ kind, active, exited, size = 14 }: Props) {
  const color = exited
    ? 'rgba(248, 113, 113, 0.7)'
    : active
      ? 'var(--primary)'
      : 'var(--primary)'
  const opacity = exited ? 1 : active ? 1 : 0.4

  const s = size

  const icons: Record<Tile['kind'], React.ReactNode> = {
    terminal: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
        <path d="M2 3l5 5-5 5" />
        <path d="M9 13h5" />
      </svg>
    ),
    http: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
        <circle cx="8" cy="8" r="6" />
        <path d="M2 8h12" />
        <path d="M8 2c2 2 2.5 4 2.5 6s-.5 4-2.5 6" />
        <path d="M8 2c-2 2-2.5 4-2.5 6s.5 4 2.5 6" />
      </svg>
    ),
    postgres: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
        <ellipse cx="8" cy="4" rx="5" ry="2" />
        <path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4" />
        <path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" />
      </svg>
    ),
    browser: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
        <rect x="2" y="2" width="12" height="12" rx="2" />
        <path d="M2 6h12" />
        <circle cx="4.5" cy="4" r="0.5" fill={color} stroke="none" />
        <circle cx="6.5" cy="4" r="0.5" fill={color} stroke="none" />
      </svg>
    ),
    file: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
        <path d="M4 1h5.5L13 4.5V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z" />
        <path d="M9.5 1v3.5H13" />
      </svg>
    ),
    lens: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
        <circle cx="7" cy="7" r="4" />
        <path d="M10 10l3.5 3.5" />
        <path d="M5 7h4" />
      </svg>
    ),
    chart: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
        <path d="M3 13V8" />
        <path d="M7 13V5" />
        <path d="M11 13V3" />
      </svg>
    ),
    docker: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
        <rect x="1" y="6" width="3" height="2.5" rx="0.3" />
        <rect x="4.5" y="6" width="3" height="2.5" rx="0.3" />
        <rect x="8" y="6" width="3" height="2.5" rx="0.3" />
        <rect x="4.5" y="3" width="3" height="2.5" rx="0.3" />
        <rect x="8" y="3" width="3" height="2.5" rx="0.3" />
        <path d="M14 9.5c-1 1-2.5 2.5-5 3-1.5.3-3 .3-4.5 0C2.5 12 1.5 10.5 1 9" />
      </svg>
    ),
    k8s: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3" />
        <circle cx="8" cy="8" r="1.5" />
      </svg>
    ),
    inspector: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
        <path d="M5.5 6h3" />
        <path d="M5.5 8h2" />
      </svg>
    )
  }

  return <span className="shrink-0 flex items-center">{icons[kind]}</span>
}
