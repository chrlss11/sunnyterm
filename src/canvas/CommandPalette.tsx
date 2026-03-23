/**
 * Spatial Command Palette — Cmd/Ctrl+K to open.
 *
 * Type a command, then click on the canvas to place a terminal that executes it.
 * Also supports quick actions like connecting tiles, creating sections, etc.
 *
 * Modes:
 * 1. "run <command>" or just type a command → click canvas → terminal spawns there and runs it
 * 2. "connect" → click two tiles to link them
 * 3. "section <name>" → drag rectangle to create named section
 * 4. Quick tile creation: "terminal", "http", "postgres", "browser", "file"
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import type { TileKind, ShellInfo } from '../types'
import { Terminal, Globe, Database, Compass, FolderOpen, Search, Zap, Link, LayoutGrid, Play, BarChart3 } from 'lucide-react'

interface CommandPaletteProps {
  onClose: () => void
  /** Called when the palette enters "spatial targeting" mode */
  onStartTargeting: (action: SpatialAction) => void
}

export type SpatialAction =
  | { type: 'run'; command: string; name?: string }
  | { type: 'spawn'; kind: TileKind }
  | { type: 'connect' }

interface Suggestion {
  icon: React.ReactNode
  label: string
  description: string
  action: () => void
}

const ICO = 14

export function CommandPalette({ onClose, onStartTargeting }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { spawnTile, tiles } = useStore()
  const [shells, setShells] = useState<ShellInfo[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
    window.electronAPI.shellsList().then(setShells)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const suggestions = getSuggestions(query, tiles, shells, spawnTile, onClose, onStartTargeting)

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions[selectedIdx]) {
        suggestions[selectedIdx].action()
      } else if (query.trim()) {
        // Default: run as command with spatial targeting
        onStartTargeting({ type: 'run', command: query.trim() })
        onClose()
      }
    }
  }, [suggestions, selectedIdx, query, onStartTargeting, onClose])

  return (
    <div
      className="fixed inset-0 z-[99997] flex justify-center"
      style={{ paddingTop: '15vh' }}
      onClick={onClose}
    >
      <div
        className="w-[520px] max-h-[400px] rounded-xl border shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <Zap size={16} style={{ color: 'var(--primary)', opacity: 0.7 }} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
            placeholder="Type a command, tile name, or action..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            esc
          </kbd>
        </div>

        {/* Suggestions */}
        <div className="flex-1 overflow-y-auto py-1">
          {suggestions.length === 0 && query.trim() && (
            <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <div className="flex items-center gap-2">
                <Play size={12} />
                Press Enter to run "<span className="font-mono" style={{ color: 'var(--text-primary)' }}>{query}</span>" — then click on the canvas to place the terminal
              </div>
            </div>
          )}

          {suggestions.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                i === selectedIdx ? 'bg-black/5 dark:bg-white/8' : ''
              }`}
              style={{ color: i === selectedIdx ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              onClick={s.action}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span className="shrink-0" style={{ opacity: 0.6 }}>{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{s.label}</div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{s.description}</div>
              </div>
            </div>
          ))}

          {!query && (
            <div className="px-4 py-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Type a command to run it on the canvas, or choose an action above.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getSuggestions(
  query: string,
  tiles: any[],
  shells: ShellInfo[],
  spawnTile: any,
  onClose: () => void,
  onStartTargeting: (action: SpatialAction) => void
): Suggestion[] {
  const q = query.toLowerCase().trim()
  const suggestions: Suggestion[] = []

  if (!q) {
    // Default suggestions
    suggestions.push(
      {
        icon: <Terminal size={ICO} />,
        label: 'New Terminal',
        description: 'Open a terminal tile (click canvas to place)',
        action: () => { onStartTargeting({ type: 'spawn', kind: 'terminal' }); onClose() }
      },
      {
        icon: <Globe size={ICO} />,
        label: 'New HTTP Client',
        description: 'Open an HTTP request tile',
        action: () => { onStartTargeting({ type: 'spawn', kind: 'http' }); onClose() }
      },
      {
        icon: <Database size={ICO} />,
        label: 'New PostgreSQL',
        description: 'Open a database query tile',
        action: () => { onStartTargeting({ type: 'spawn', kind: 'postgres' }); onClose() }
      },
      {
        icon: <Link size={ICO} />,
        label: 'Connect Tiles',
        description: 'Link output of one tile to another (click two tiles)',
        action: () => { onStartTargeting({ type: 'connect' }); onClose() }
      },
      {
        icon: <Search size={ICO} />,
        label: 'New Lens',
        description: 'Filtered view of a terminal\'s output',
        action: () => { onStartTargeting({ type: 'spawn', kind: 'lens' }); onClose() }
      },
    )
    return suggestions
  }

  // Match tile kinds
  const kindMap: { pattern: string; kind: TileKind; icon: React.ReactNode; label: string }[] = [
    { pattern: 'terminal', kind: 'terminal', icon: <Terminal size={ICO} />, label: 'New Terminal' },
    { pattern: 'http', kind: 'http', icon: <Globe size={ICO} />, label: 'New HTTP Client' },
    { pattern: 'postgres', kind: 'postgres', icon: <Database size={ICO} />, label: 'New PostgreSQL' },
    { pattern: 'browser', kind: 'browser', icon: <Compass size={ICO} />, label: 'New Browser' },
    { pattern: 'file', kind: 'file', icon: <FolderOpen size={ICO} />, label: 'New File Viewer' },
    { pattern: 'lens', kind: 'lens', icon: <Search size={ICO} />, label: 'New Lens' },
    { pattern: 'chart', kind: 'chart', icon: <BarChart3 size={ICO} />, label: 'New Chart' },
  ]

  for (const km of kindMap) {
    if (km.pattern.startsWith(q) || q.startsWith(km.pattern)) {
      suggestions.push({
        icon: km.icon,
        label: km.label,
        description: 'Click on the canvas to place',
        action: () => { onStartTargeting({ type: 'spawn', kind: km.kind }); onClose() }
      })
    }
  }

  // "connect" action
  if ('connect'.startsWith(q) || q.startsWith('connect')) {
    suggestions.push({
      icon: <Link size={ICO} />,
      label: 'Connect Tiles',
      description: 'Click two tiles to link their output',
      action: () => { onStartTargeting({ type: 'connect' }); onClose() }
    })
  }

  // Common commands
  const commonCmds = [
    'npm run dev', 'npm test', 'npm run build',
    'git status', 'git log --oneline', 'git diff',
    'docker ps', 'docker compose up', 'docker logs',
    'ls -la', 'htop', 'curl', 'python', 'node',
  ]

  for (const cmd of commonCmds) {
    if (cmd.includes(q) && q.length >= 2) {
      suggestions.push({
        icon: <Play size={ICO} />,
        label: cmd,
        description: 'Run command — click canvas to place terminal',
        action: () => { onStartTargeting({ type: 'run', command: cmd }); onClose() }
      })
    }
  }

  // Shell-specific commands
  for (const shell of shells) {
    if (shell.name.toLowerCase().includes(q) || shell.id.includes(q)) {
      suggestions.push({
        icon: <Terminal size={ICO} />,
        label: `Open ${shell.name}`,
        description: `New terminal with ${shell.name} — click to place`,
        action: () => {
          // spawnTile with shell override will be handled by spatial targeting
          onStartTargeting({ type: 'run', command: '', name: shell.name })
          onClose()
        }
      })
    }
  }

  // If nothing matched and looks like a command, offer to run it
  if (suggestions.length === 0 && q.length > 1) {
    suggestions.push({
      icon: <Play size={ICO} />,
      label: `Run: ${query}`,
      description: 'Click on the canvas to place a terminal and execute',
      action: () => { onStartTargeting({ type: 'run', command: query }); onClose() }
    })
  }

  return suggestions.slice(0, 8)
}

/**
 * TargetingOverlay — shown when the user needs to click on the canvas to complete an action.
 * Displays a crosshair cursor and instruction text.
 */
export function TargetingOverlay({ action, onCancel, onPlace }: {
  action: SpatialAction
  onCancel: () => void
  onPlace: (canvasX: number, canvasY: number) => void
}) {
  const { zoom, panX, panY } = useStore()

  const getMessage = () => {
    switch (action.type) {
      case 'run': return `Click to place terminal → ${action.command || action.name || 'new terminal'}`
      case 'spawn': return `Click to place ${action.kind} tile`
      case 'connect': return 'Click a tile to start linking, then click another to connect'
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const canvasX = (screenX - panX) / zoom
    const canvasY = (screenY - panY) / zoom
    onPlace(canvasX, canvasY)
  }, [zoom, panX, panY, onPlace])

  return (
    <div
      className="absolute inset-0 z-[9998]"
      style={{ cursor: 'crosshair' }}
      onClick={handleClick}
    >
      {/* Instruction bar */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-xs"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--primary)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: 'var(--primary)' }}
        />
        {getMessage()}
        <kbd
          className="text-[10px] px-1.5 py-0.5 rounded border ml-2 cursor-pointer"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          onClick={(e) => { e.stopPropagation(); onCancel() }}
        >
          esc
        </kbd>
      </div>
    </div>
  )
}
