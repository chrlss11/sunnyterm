/**
 * LensTile — A filtered, live view of another terminal's output.
 *
 * Features:
 * - Subscribes to a source terminal's output stream
 * - Applies a regex filter, only showing matching lines
 * - Color-tinted background to distinguish lens type
 * - Zero process overhead (pure filter, no PTY)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useStore } from '../store'
import { TITLE_BAR_H } from './TileContainer'
import { getTerminalEntry } from '../lib/terminalRegistry'
import { THEMES, type ThemeName } from '../lib/themes'

interface Props {
  tileId: string
  overrideW?: number
  overrideH?: number
}

const LENS_PRESETS = [
  { label: 'Errors', filter: '(?i)(error|fatal|panic|exception|fail)', color: '#f38ba8' },
  { label: 'Warnings', filter: '(?i)(warn|warning|deprecated)', color: '#f9e2af' },
  { label: 'HTTP', filter: '(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\\s', color: '#89b4fa' },
  { label: 'SQL', filter: '(?i)(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)', color: '#a6e3a1' },
  { label: 'Custom', filter: '', color: '#cba6f7' },
]

export function LensTile({ tileId, overrideW, overrideH }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [sourceId, setSourceId] = useState<string>('')
  const [filterText, setFilterText] = useState<string>(LENS_PRESETS[0].filter)
  const [lensColor, setLensColor] = useState<string>(LENS_PRESETS[0].color)
  const [presetIdx, setPresetIdx] = useState(0)
  const [configuring, setConfiguring] = useState(true)
  const [matchCount, setMatchCount] = useState(0)

  const tiles = useStore((s) => s.tiles)
  const theme = useStore((s) => s.theme)

  const terminalTiles = tiles.filter((t) => t.kind === 'terminal' && t.id !== tileId)

  const startLens = useCallback(() => {
    if (!sourceId || !filterText) return
    setConfiguring(false)
  }, [sourceId, filterText])

  // Create xterm and subscribe to source
  useEffect(() => {
    if (configuring || !containerRef.current || !sourceId) return

    const currentTheme = THEMES[theme as ThemeName] ?? THEMES.dark
    const term = new Terminal({
      theme: {
        ...currentTheme.terminal,
        background: adjustBg(currentTheme.terminal.background ?? '#111213', lensColor),
      },
      fontFamily: '"Google Sans Mono", "Cascadia Code", Menlo, Monaco, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.0,
      cursorBlink: false,
      cursorStyle: 'underline',
      scrollback: 5000,
      disableStdin: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    termRef.current = term
    fitAddonRef.current = fitAddon

    // Try to compile regex
    let regex: RegExp
    try {
      regex = new RegExp(filterText)
    } catch {
      regex = new RegExp(filterText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    }

    let count = 0

    // Subscribe to source terminal's PTY output
    const cleanup = window.electronAPI.onPtyData(sourceId, (data: string) => {
      // Split by newlines, filter, and write matches
      const lines = data.split('\n')
      for (const line of lines) {
        const stripped = line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
        if (regex.test(stripped)) {
          term.write(line + '\r\n')
          count++
          setMatchCount(count)
        }
      }
    })

    // Also replay existing buffer from source
    const entry = getTerminalEntry(sourceId)
    if (entry) {
      const buffer = entry.terminal.buffer.active
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i)
        if (line) {
          const text = line.translateToString(true)
          if (regex.test(text)) {
            term.writeln(text)
            count++
          }
        }
      }
      setMatchCount(count)
    }

    // Fit
    try { fitAddon.fit() } catch {}

    return () => {
      cleanup()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [configuring, sourceId, filterText, lensColor, theme])

  // Resize on tile dimensions change
  const tile = tiles.find((t) => t.id === tileId)
  const w = overrideW ?? tile?.w ?? 640
  const h = overrideH ?? tile?.h ?? 400

  useEffect(() => {
    if (fitAddonRef.current) {
      try { fitAddonRef.current.fit() } catch {}
    }
  }, [w, h])

  if (configuring) {
    return (
      <div className="flex flex-col h-full p-3 gap-2 text-xs" style={{ color: 'var(--text-primary)' }}>
        <div className="font-medium text-sm flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: lensColor }} />
          Configure Lens
        </div>

        {/* Source selector */}
        <label className="text-text-muted">Source Terminal</label>
        <select
          className="bg-black/10 dark:bg-white/10 border border-border rounded px-2 py-1 text-xs outline-none"
          style={{ color: 'var(--text-primary)' }}
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        >
          <option value="">Select a terminal...</option>
          {terminalTiles.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        {/* Preset buttons */}
        <label className="text-text-muted mt-1">Filter Preset</label>
        <div className="flex flex-wrap gap-1">
          {LENS_PRESETS.map((p, i) => (
            <button
              key={p.label}
              className={`px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                presetIdx === i ? 'border-blue-500 bg-blue-500/20' : 'border-border hover:border-white/30'
              }`}
              style={{ color: p.color }}
              onClick={() => {
                setPresetIdx(i)
                if (p.filter) setFilterText(p.filter)
                setLensColor(p.color)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom regex */}
        <label className="text-text-muted mt-1">Regex Filter</label>
        <input
          className="bg-black/10 dark:bg-white/10 border border-border rounded px-2 py-1 text-xs font-mono outline-none"
          style={{ color: 'var(--text-primary)' }}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Regular expression..."
        />

        {/* Start button */}
        <button
          className="mt-2 px-3 py-1.5 rounded text-xs font-medium bg-blue-600/60 hover:bg-blue-500/70 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={startLens}
          disabled={!sourceId || !filterText}
        >
          Start Lens
        </button>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {/* Lens indicator bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-2 z-10 text-[10px]"
        style={{ height: 20, background: `${lensColor}22`, color: lensColor, borderBottom: `1px solid ${lensColor}44` }}
      >
        <span className="font-medium">
          {LENS_PRESETS[presetIdx]?.label ?? 'Lens'} — {terminalTiles.find((t) => t.id === sourceId)?.name ?? sourceId}
        </span>
        <span className="font-mono">{matchCount} matches</span>
      </div>
      {/* Terminal output */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', paddingTop: 20, boxSizing: 'border-box' }}
      />
    </div>
  )
}

/** Tint a background color slightly towards the lens color */
function adjustBg(bg: string, tint: string): string {
  // Simple: just return the bg with very slight tint via CSS
  // For now return the bg as-is (the lens bar provides the color coding)
  return bg
}
