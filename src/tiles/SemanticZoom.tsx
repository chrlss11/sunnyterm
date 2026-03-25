import React, { useEffect, useState } from 'react'
import type { Tile } from '../types'
import { getTerminalEntry } from '../lib/terminalRegistry'
import { getActivityLevel } from '../lib/tileActivity'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  tile: Tile
  mode: 'summary' | 'badge'
}

type TileStatus = 'ok' | 'error' | 'running'

interface TileInfo {
  status: TileStatus
  lastCommand: string
  lineCount: number
  detail: string // secondary info line
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTerminalInfo(tileId: string): TileInfo {
  const entry = getTerminalEntry(tileId)
  if (!entry) {
    return { status: 'running', lastCommand: '', lineCount: 0, detail: '' }
  }

  const status: TileStatus = entry.isExited
    ? (entry.exitCode === 0 ? 'ok' : 'error')
    : 'running'

  let lastCommand = ''
  let lineCount = 0

  try {
    const buf = entry.terminal.buffer.active
    lineCount = buf.length

    // Walk backwards through the buffer to find the last prompt line
    for (let i = buf.cursorY; i >= 0; i--) {
      const line = buf.getLine(i)?.translateToString(true) ?? ''
      // Match common prompt patterns: ends with $, >, %, or #
      const promptMatch = line.match(/[$>%#]\s*(.+)$/)
      if (promptMatch) {
        lastCommand = promptMatch[1].trim()
        break
      }
    }
  } catch {
    // xterm buffer may not be accessible
  }

  return { status, lastCommand, lineCount, detail: '' }
}

function getNonTerminalDetail(tile: Tile): string {
  switch (tile.kind) {
    case 'http':
      return 'HTTP Client'
    case 'postgres':
      return 'PostgreSQL'
    case 'browser':
      return tile.initialUrl || 'Browser'
    case 'file':
      return tile.initialPath || 'File Viewer'
    case 'lens':
      return 'Lens'
    case 'docker':
      return 'Docker'
    case 'k8s':
      return 'Kubernetes'
    case 'chart':
      return 'Chart'
    case 'inspector':
      return 'Terminal Inspector'
    default:
      return tile.kind
  }
}

// ─── Status dot colors ───────────────────────────────────────────────────────

const STATUS_COLORS: Record<TileStatus, string> = {
  ok: '#22c55e',      // green-500
  error: '#ef4444',   // red-500
  running: '#eab308', // yellow-500
}

// ─── Summary Mode ────────────────────────────────────────────────────────────

function SemanticSummary({ tile }: { tile: Tile }) {
  const [, setTick] = useState(0)

  // Re-render periodically to keep status fresh
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 2000)
    return () => clearInterval(interval)
  }, [])

  const isTerminal = tile.kind === 'terminal'
  const info = isTerminal ? getTerminalInfo(tile.id) : null
  const detail = isTerminal ? info!.lastCommand : getNonTerminalDetail(tile)
  const status: TileStatus = isTerminal
    ? info!.status
    : 'ok'
  const lineCount = isTerminal ? info!.lineCount : 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        height: '100%',
        padding: '12px 16px',
        gap: 8,
        overflow: 'hidden',
        color: 'var(--text-primary)',
      }}
    >
      {/* Tile name + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: STATUS_COLORS[status],
            flexShrink: 0,
            boxShadow: status === 'running' ? `0 0 6px ${STATUS_COLORS.running}` : undefined,
          }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {tile.name}
        </span>
      </div>

      {/* Last command or detail */}
      {detail && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontFamily: '"Google Sans Mono", monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
          }}
        >
          {isTerminal ? '$ ' : ''}{detail}
        </div>
      )}

      {/* Line count for terminals */}
      {isTerminal && lineCount > 0 && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            opacity: 0.6,
          }}
        >
          {lineCount} lines
        </div>
      )}
    </div>
  )
}

// ─── Badge Mode ──────────────────────────────────────────────────────────────

function SemanticBadge({ tile }: { tile: Tile }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 2000)
    return () => clearInterval(interval)
  }, [])

  const isTerminal = tile.kind === 'terminal'
  const status: TileStatus = isTerminal
    ? (() => {
        const entry = getTerminalEntry(tile.id)
        if (!entry) return 'running'
        return entry.isExited ? (entry.exitCode === 0 ? 'ok' : 'error') : 'running'
      })()
    : 'ok'

  const activityLevel = getActivityLevel(tile.id)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
        overflow: 'hidden',
        color: 'var(--text-primary)',
        opacity: 0.4 + activityLevel * 0.6,
      }}
    >
      {/* Large status circle */}
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: STATUS_COLORS[status],
          boxShadow: status === 'running'
            ? `0 0 12px ${STATUS_COLORS.running}`
            : `0 0 8px ${STATUS_COLORS[status]}40`,
        }}
      />
      {/* Tile name */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '90%',
          textAlign: 'center',
        }}
      >
        {tile.name}
      </span>
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function SemanticZoom({ tile, mode }: Props) {
  if (mode === 'summary') return <SemanticSummary tile={tile} />
  return <SemanticBadge tile={tile} />
}
