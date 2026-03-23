import React, { useMemo } from 'react'
import { useTrailStore, type TrailPoint } from '../lib/canvasTrails'
import { useStore } from '../store'

/** Format a timestamp as mm:ss relative to the first point */
function formatRelativeTime(ts: number, baseTs: number): string {
  const diff = Math.round((ts - baseTs) / 1000)
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Detect "major stops" where the user stayed roughly in the same place for >2s */
function findStops(points: TrailPoint[]): number[] {
  const THRESHOLD_PX = 30
  const THRESHOLD_MS = 2000
  const stops: number[] = []
  let anchorIdx = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[anchorIdx].x
    const dy = points[i].y - points[anchorIdx].y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > THRESHOLD_PX) {
      // Check if we lingered at anchor long enough
      if (points[i - 1].timestamp - points[anchorIdx].timestamp >= THRESHOLD_MS) {
        stops.push(anchorIdx)
      }
      anchorIdx = i
    }
  }
  // Check final segment
  if (
    points.length > 1 &&
    points[points.length - 1].timestamp - points[anchorIdx].timestamp >= THRESHOLD_MS
  ) {
    stops.push(anchorIdx)
  }
  return stops
}

export function TrailOverlay() {
  const showTrail = useTrailStore((s) => s.showTrail)
  const currentTrail = useTrailStore((s) => s.currentTrail)
  const isReplaying = useTrailStore((s) => s.isReplaying)
  const replayIndex = useTrailStore((s) => s.replayIndex)
  const tiles = useStore((s) => s.tiles)

  const stops = useMemo(() => findStops(currentTrail), [currentTrail])

  if (!showTrail || currentTrail.length < 2) return null

  const baseTs = currentTrail[0].timestamp

  // Build the polyline path in canvas coordinates.
  // Trail stores panX/panY, but the overlay lives inside the canvas transform layer,
  // so we need to convert pan values to canvas coordinates: canvasX = -panX/zoom ...
  // Actually the trail points record panX, panY which are screen-space offsets.
  // The overlay is rendered inside the canvas transform (translate(panX, panY) scale(zoom)).
  // To place a mark at the viewport center in canvas coords:
  //   canvasX = (-panX + viewportWidth/2) / zoom
  //   canvasY = (-panY + viewportHeight/2) / zoom
  // But we don't know viewport size at record time consistently.
  // Simpler: record the center of the viewport as the trail position.
  // The panX/panY values represent the canvas origin offset, so the center of the
  // viewport in canvas space is: cx = (windowWidth/2 - panX) / zoom, cy = (windowHeight/2 - panY) / zoom
  // Since we record panX/panY/zoom, we compute canvas coords here.

  const vw = window.innerWidth
  const vh = window.innerHeight

  const canvasPoints = currentTrail.map((p) => ({
    cx: (vw / 2 - p.x) / p.zoom,
    cy: (vh / 2 - p.y) / p.zoom,
    tileId: p.tileId,
    timestamp: p.timestamp,
  }))

  const pathD = canvasPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx} ${p.cy}`)
    .join(' ')

  // Replay cursor position
  const replayCursor = isReplaying ? canvasPoints[replayIndex] : null

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <linearGradient id="trail-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Trail path */}
      <path
        d={pathD}
        stroke="url(#trail-grad)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Dots at each point */}
      {canvasPoints.map((p, i) => {
        const age = (p.timestamp - baseTs) / (canvasPoints[canvasPoints.length - 1].timestamp - baseTs || 1)
        return (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={2}
            fill="var(--primary)"
            opacity={0.2 + age * 0.5}
          />
        )
      })}

      {/* Timestamp labels at major stops */}
      {stops.map((idx) => {
        const p = canvasPoints[idx]
        return (
          <text
            key={`stop-${idx}`}
            x={p.cx + 6}
            y={p.cy - 6}
            fontSize={9}
            fill="var(--text-muted, #888)"
            opacity={0.7}
          >
            {formatRelativeTime(p.timestamp, baseTs)}
          </text>
        )
      })}

      {/* Connecting lines to focused tiles at stops */}
      {stops.map((idx) => {
        const p = canvasPoints[idx]
        if (!p.tileId) return null
        const tile = tiles.find((t) => t.id === p.tileId)
        if (!tile) return null
        const tileCx = tile.x + tile.w / 2
        const tileCy = tile.y + tile.h / 2
        return (
          <line
            key={`link-${idx}`}
            x1={p.cx}
            y1={p.cy}
            x2={tileCx}
            y2={tileCy}
            stroke="var(--primary)"
            strokeWidth={1}
            strokeOpacity={0.25}
            strokeDasharray="3 3"
          />
        )
      })}

      {/* Start & end markers */}
      <circle
        cx={canvasPoints[0].cx}
        cy={canvasPoints[0].cy}
        r={4}
        fill="var(--primary)"
        opacity={0.7}
      />
      <circle
        cx={canvasPoints[canvasPoints.length - 1].cx}
        cy={canvasPoints[canvasPoints.length - 1].cy}
        r={4}
        fill="var(--primary)"
        opacity={0.9}
        stroke="var(--primary)"
        strokeWidth={2}
        strokeOpacity={0.3}
      />

      {/* Replay cursor */}
      {replayCursor && (
        <>
          <circle
            cx={replayCursor.cx}
            cy={replayCursor.cy}
            r={8}
            fill="var(--primary)"
            opacity={0.4}
          >
            <animate attributeName="r" values="6;10;6" dur="1s" repeatCount="indefinite" />
          </circle>
          <circle
            cx={replayCursor.cx}
            cy={replayCursor.cy}
            r={4}
            fill="var(--primary)"
            opacity={0.9}
          />
        </>
      )}
    </svg>
  )
}
