import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { getTerminalEntry, getAllEntries } from '../lib/terminalRegistry'
import type { IDisposable } from '@xterm/xterm'

// ─── Types ───────────────────────────────────────────────────────────────────

type EventType = 'CSI' | 'OSC' | 'DCS' | 'ESC' | 'SGR' | 'OTHER'

interface EscapeEvent {
  id: number
  timestamp: number
  type: EventType
  raw: string
  decoded: string
}

interface TerminalModes {
  cursorVisible: boolean
  applicationKeypad: boolean
  mouseReporting: string
  bracketedPaste: boolean
}

interface CellInfo {
  row: number
  col: number
  char: string
  codepoint: number
  fg: string
  bg: string
  bold: boolean
  italic: boolean
  underline: boolean
  dim: boolean
  strikethrough: boolean
}

interface TerminalState {
  cursorRow: number
  cursorCol: number
  rows: number
  cols: number
  modes: TerminalModes
  activeFg: string
  activeBg: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _eventId = 0
function nextEventId() { return _eventId++ }

function classifySequence(raw: string): { type: EventType; decoded: string } {
  // CSI sequences: ESC [
  if (raw.startsWith('\x1b[') || raw.startsWith('CSI')) {
    // SGR (Select Graphic Rendition) ends with 'm'
    if (raw.endsWith('m')) {
      return { type: 'SGR', decoded: decodeSGR(raw) }
    }
    // Cursor movement
    if (raw.endsWith('A')) return { type: 'CSI', decoded: 'Cursor Up' }
    if (raw.endsWith('B')) return { type: 'CSI', decoded: 'Cursor Down' }
    if (raw.endsWith('C')) return { type: 'CSI', decoded: 'Cursor Forward' }
    if (raw.endsWith('D')) return { type: 'CSI', decoded: 'Cursor Back' }
    if (raw.endsWith('H')) return { type: 'CSI', decoded: 'Cursor Position' }
    if (raw.endsWith('J')) return { type: 'CSI', decoded: 'Erase in Display' }
    if (raw.endsWith('K')) return { type: 'CSI', decoded: 'Erase in Line' }
    if (raw.endsWith('h')) return { type: 'CSI', decoded: 'Set Mode' }
    if (raw.endsWith('l')) return { type: 'CSI', decoded: 'Reset Mode' }
    if (raw.endsWith('r')) return { type: 'CSI', decoded: 'Set Scrolling Region' }
    if (raw.endsWith('n')) return { type: 'CSI', decoded: 'Device Status Report' }
    if (raw.endsWith('t')) return { type: 'CSI', decoded: 'Window Manipulation' }
    return { type: 'CSI', decoded: 'CSI Sequence' }
  }
  // OSC sequences: ESC ]
  if (raw.startsWith('\x1b]') || raw.startsWith('OSC')) {
    if (raw.includes(';')) {
      const code = raw.match(/\](\d+)/)?.[1]
      if (code === '0' || code === '2') return { type: 'OSC', decoded: 'Set Window Title' }
      if (code === '7') return { type: 'OSC', decoded: 'Set Working Directory' }
      if (code === '8') return { type: 'OSC', decoded: 'Hyperlink' }
      if (code === '4') return { type: 'OSC', decoded: 'Set Color' }
      if (code === '52') return { type: 'OSC', decoded: 'Clipboard' }
      return { type: 'OSC', decoded: `OSC ${code}` }
    }
    return { type: 'OSC', decoded: 'OSC Sequence' }
  }
  // DCS: ESC P
  if (raw.startsWith('\x1bP') || raw.startsWith('DCS')) {
    return { type: 'DCS', decoded: 'Device Control String' }
  }
  // Plain ESC
  if (raw.startsWith('\x1b') || raw.startsWith('ESC')) {
    return { type: 'ESC', decoded: 'Escape Sequence' }
  }
  return { type: 'OTHER', decoded: raw }
}

function decodeSGR(raw: string): string {
  const match = raw.match(/\[([0-9;]*)m/)
  if (!match) return 'SGR'
  const codes = match[1].split(';').map(Number)
  const parts: string[] = []
  for (const c of codes) {
    if (c === 0) parts.push('Reset')
    else if (c === 1) parts.push('Bold')
    else if (c === 2) parts.push('Dim')
    else if (c === 3) parts.push('Italic')
    else if (c === 4) parts.push('Underline')
    else if (c === 7) parts.push('Reverse')
    else if (c === 9) parts.push('Strikethrough')
    else if (c >= 30 && c <= 37) parts.push(`FG ${c - 30}`)
    else if (c >= 40 && c <= 47) parts.push(`BG ${c - 40}`)
    else if (c >= 90 && c <= 97) parts.push(`Bright FG ${c - 90}`)
    else if (c >= 100 && c <= 107) parts.push(`Bright BG ${c - 100}`)
    else if (c === 38) parts.push('FG Extended')
    else if (c === 48) parts.push('BG Extended')
    else parts.push(`${c}`)
  }
  return `SGR: ${parts.join(', ')}`
}

function escapeForDisplay(raw: string): string {
  return raw
    .replace(/\x1b/g, 'ESC')
    .replace(/\x07/g, 'BEL')
    .replace(/\x00/g, 'NUL')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

function colorToHex(color: number | undefined): string {
  if (color === undefined || color === -1) return 'default'
  // xterm.js can return RGBA as a single number
  if (color >= 0 && color <= 255) return `palette(${color})`
  const r = (color >> 24) & 0xff
  const g = (color >> 16) & 0xff
  const b = (color >> 8) & 0xff
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ─── Event type colors ───────────────────────────────────────────────────────

const TYPE_COLORS: Record<EventType, string> = {
  CSI: '#3b82f6',
  OSC: '#8b5cf6',
  DCS: '#ec4899',
  ESC: '#f59e0b',
  SGR: '#10b981',
  OTHER: '#6b7280',
}

// ─── Tab styles ──────────────────────────────────────────────────────────────

type TabName = 'events' | 'state' | 'cells'

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  tileId: string
}

export function InspectorTile({ tileId }: Props) {
  const tiles = useStore((s) => s.tiles)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabName>('events')
  const [events, setEvents] = useState<EscapeEvent[]>([])
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState<EventType | 'ALL'>('ALL')
  const [termState, setTermState] = useState<TerminalState | null>(null)
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null)
  const [cellRow, setCellRow] = useState('')
  const [cellCol, setCellCol] = useState('')
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const disposablesRef = useRef<IDisposable[]>([])

  pausedRef.current = paused

  // Available terminal tiles to inspect
  const terminalTiles = tiles.filter(t => t.kind === 'terminal' && t.id !== tileId)

  // Register escape sequence handlers on selected terminal
  useEffect(() => {
    // Cleanup previous handlers
    disposablesRef.current.forEach(d => d.dispose())
    disposablesRef.current = []
    setEvents([])
    setTermState(null)
    setSelectedCell(null)

    if (!sourceId) return

    const entry = getTerminalEntry(sourceId)
    if (!entry) return

    const term = entry.terminal
    const parser = (term as any)._core?._inputHandler?._parser

    if (!parser) {
      // Fallback: just watch data writes for escape sequences
      const onData = term.onData((data: string) => {
        if (pausedRef.current) return
        // Parse escape sequences from data
        const escRegex = /\x1b(?:\[[0-9;?]*[a-zA-Z@`]|\][^\x07]*\x07|\][^\x1b]*\x1b\\|P[^\\]*\x1b\\|[()][AB012]|[=><MNOcn78])/g
        let match
        while ((match = escRegex.exec(data)) !== null) {
          const raw = match[0]
          const { type, decoded } = classifySequence(raw)
          setEvents(prev => {
            const next = [...prev, { id: nextEventId(), timestamp: Date.now(), type, raw, decoded }]
            return next.slice(-500) // Keep last 500 events
          })
        }
      })
      disposablesRef.current.push(onData)
      return
    }

    // Register CSI handler for all final bytes
    try {
      // We'll use a data listener + regex approach since parser API is complex
      const onWriteParsed = term.onWriteParsed(() => {
        // This fires after each write parse — we can use it for state updates
        if (tab === 'state') {
          updateTermState()
        }
      })
      disposablesRef.current.push(onWriteParsed)
    } catch {
      // onWriteParsed might not exist in all versions
    }

    // Listen to data being written to terminal
    const origWrite = term.write.bind(term)
    let capturing = true

    // Use onData for input (what user types)
    // Use a MutationObserver/timer approach to watch output
    const dataInterval = setInterval(() => {
      if (!capturing) return
      updateTermState()
    }, 1000)

    // Intercept data from PTY by watching the onData from the pty side
    const cleanupPty = window.electronAPI.onPtyData(sourceId, (data: string) => {
      if (pausedRef.current) return

      // Parse escape sequences from incoming data
      const escRegex = /\x1b(?:\[[0-9;?]*[a-zA-Z@`]|\][^\x07]*(?:\x07|\x1b\\)|\P[^\\]*\x1b\\|[()][AB012]|[=><MNOcn78])/g
      let match
      while ((match = escRegex.exec(data)) !== null) {
        const raw = match[0]
        const { type, decoded } = classifySequence(raw)
        setEvents(prev => {
          const next = [...prev, { id: nextEventId(), timestamp: Date.now(), type, raw, decoded }]
          return next.slice(-500)
        })
      }
    })
    disposablesRef.current.push({ dispose: cleanupPty })

    function updateTermState() {
      const entry = getTerminalEntry(sourceId!)
      if (!entry) return
      const t = entry.terminal
      const buf = t.buffer.active

      setTermState({
        cursorRow: buf.cursorY,
        cursorCol: buf.cursorX,
        rows: t.rows,
        cols: t.cols,
        modes: {
          cursorVisible: (t as any)._core?.coreService?.decPrivateModes?.cursorVisible ?? true,
          applicationKeypad: (t as any)._core?.coreService?.decPrivateModes?.applicationKeypad ?? false,
          mouseReporting: 'unknown',
          bracketedPaste: (t as any)._core?.coreService?.decPrivateModes?.bracketedPasteMode ?? false,
        },
        activeFg: 'default',
        activeBg: 'default',
      })
    }

    updateTermState()

    return () => {
      capturing = false
      clearInterval(dataInterval)
      disposablesRef.current.forEach(d => d.dispose())
      disposablesRef.current = []
    }
  }, [sourceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll events
  useEffect(() => {
    if (!paused && tab === 'events') {
      eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events, paused, tab])

  // Cell inspection
  const inspectCell = useCallback(() => {
    if (!sourceId) return
    const row = parseInt(cellRow)
    const col = parseInt(cellCol)
    if (isNaN(row) || isNaN(col)) return

    const entry = getTerminalEntry(sourceId)
    if (!entry) return

    const buf = entry.terminal.buffer.active
    const line = buf.getLine(row)
    if (!line) {
      setSelectedCell(null)
      return
    }

    const cell = line.getCell(col)
    if (!cell) {
      setSelectedCell(null)
      return
    }

    const char = cell.getChars()
    setSelectedCell({
      row,
      col,
      char: char || ' ',
      codepoint: char ? char.codePointAt(0) ?? 0 : 32,
      fg: colorToHex((cell as any).getFgColor?.() ?? -1),
      bg: colorToHex((cell as any).getBgColor?.() ?? -1),
      bold: cell.isBold() === 1,
      italic: cell.isItalic() === 1,
      underline: cell.isUnderline() === 1,
      dim: cell.isDim() === 1,
      strikethrough: cell.isStrikethrough() === 1,
    })
  }, [sourceId, cellRow, cellCol])

  // Filtered events
  const filteredEvents = filter === 'ALL' ? events : events.filter(e => e.type === filter)

  // ─── Render: Source selector ────────────────────────────────────────────────

  if (!sourceId) {
    return (
      <div className="flex flex-col h-full p-4 gap-3 overflow-auto">
        <div className="text-text-primary text-sm font-semibold">Terminal Inspector</div>
        <div className="text-text-muted text-xs">Select a terminal tile to inspect:</div>
        {terminalTiles.length === 0 ? (
          <div className="text-text-muted text-xs italic mt-4">No terminal tiles available. Create a terminal first.</div>
        ) : (
          <div className="flex flex-col gap-1.5 mt-2">
            {terminalTiles.map(t => (
              <button
                key={t.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-white/8 border border-border transition-colors text-left"
                onClick={() => setSourceId(t.id)}
              >
                <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 3l5 5-5 5" />
                  <path d="M9 13h5" />
                </svg>
                <span className="font-medium">{t.name}</span>
                <span className="text-text-muted ml-auto font-mono text-[10px]">{t.id.slice(0, 15)}...</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Render: Inspector panel ────────────────────────────────────────────────

  const sourceTile = tiles.find(t => t.id === sourceId)
  const sourceLabel = sourceTile?.name ?? sourceId

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
        <button
          className="text-text-muted hover:text-text-primary text-[10px] transition-colors"
          onClick={() => setSourceId(null)}
          title="Change source"
        >
          &larr;
        </button>
        <span className="text-[11px] text-text-secondary font-medium truncate">
          Inspecting: <span className="text-text-primary">{sourceLabel}</span>
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border shrink-0">
        {(['events', 'state', 'cells'] as TabName[]).map(t => (
          <button
            key={t}
            className={`px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2 ${
              tab === t
                ? 'text-text-primary border-blue-400'
                : 'text-text-muted hover:text-text-secondary border-transparent'
            }`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'events' && (
          <EventsTab
            events={filteredEvents}
            filter={filter}
            onFilterChange={setFilter}
            paused={paused}
            onTogglePause={() => setPaused(p => !p)}
            onClear={() => setEvents([])}
            eventsEndRef={eventsEndRef}
          />
        )}
        {tab === 'state' && (
          <StateTab state={termState} sourceId={sourceId} />
        )}
        {tab === 'cells' && (
          <CellsTab
            cellRow={cellRow}
            cellCol={cellCol}
            onRowChange={setCellRow}
            onColChange={setCellCol}
            onInspect={inspectCell}
            cellInfo={selectedCell}
          />
        )}
      </div>
    </div>
  )
}

// ─── Events Tab ──────────────────────────────────────────────────────────────

function EventsTab({
  events, filter, onFilterChange, paused, onTogglePause, onClear, eventsEndRef
}: {
  events: EscapeEvent[]
  filter: EventType | 'ALL'
  onFilterChange: (f: EventType | 'ALL') => void
  paused: boolean
  onTogglePause: () => void
  onClear: () => void
  eventsEndRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border shrink-0 flex-wrap">
        {/* Filter buttons */}
        {(['ALL', 'CSI', 'OSC', 'SGR', 'ESC', 'DCS'] as const).map(f => (
          <button
            key={f}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
              filter === f
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-text-muted hover:text-text-secondary border border-transparent'
            }`}
            onClick={() => onFilterChange(f)}
          >
            {f}
          </button>
        ))}
        <div className="flex-1" />
        <button
          className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
            paused ? 'bg-yellow-500/20 text-yellow-300' : 'text-text-muted hover:text-text-secondary'
          }`}
          onClick={onTogglePause}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          className="px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-red-400 transition-colors"
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-auto font-mono text-[11px]" style={{ scrollbarWidth: 'thin' }}>
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-xs">
            {paused ? 'Paused — no new events captured' : 'Waiting for escape sequences...'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-tile z-10">
              <tr className="text-text-muted text-[10px] uppercase tracking-wider">
                <th className="text-left px-2 py-1 w-16">Time</th>
                <th className="text-left px-2 py-1 w-12">Type</th>
                <th className="text-left px-2 py-1">Raw</th>
                <th className="text-left px-2 py-1">Decoded</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => {
                const time = new Date(ev.timestamp)
                const ts = `${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}.${time.getMilliseconds().toString().padStart(3, '0')}`
                return (
                  <tr key={ev.id} className="hover:bg-white/5 border-b border-white/3">
                    <td className="px-2 py-0.5 text-text-muted whitespace-nowrap">{ts}</td>
                    <td className="px-2 py-0.5">
                      <span
                        className="px-1 py-0.5 rounded text-[9px] font-bold"
                        style={{
                          color: TYPE_COLORS[ev.type],
                          background: TYPE_COLORS[ev.type] + '18',
                        }}
                      >
                        {ev.type}
                      </span>
                    </td>
                    <td className="px-2 py-0.5 text-text-muted truncate max-w-[140px]" title={escapeForDisplay(ev.raw)}>
                      {escapeForDisplay(ev.raw).slice(0, 40)}
                    </td>
                    <td className="px-2 py-0.5 text-text-secondary truncate">{ev.decoded}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div ref={eventsEndRef} />
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-t border-border text-[10px] text-text-muted shrink-0">
        <span>{events.length} events</span>
        {paused && <span className="text-yellow-400">PAUSED</span>}
      </div>
    </div>
  )
}

// ─── State Tab ───────────────────────────────────────────────────────────────

function StateTab({ state, sourceId }: { state: TerminalState | null; sourceId: string }) {
  const [, setTick] = useState(0)

  // Refresh state periodically
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(interval)
  }, [])

  // Live-read state
  const entry = getTerminalEntry(sourceId)
  const liveState: TerminalState | null = entry ? (() => {
    const t = entry.terminal
    const buf = t.buffer.active
    return {
      cursorRow: buf.cursorY,
      cursorCol: buf.cursorX,
      rows: t.rows,
      cols: t.cols,
      modes: state?.modes ?? {
        cursorVisible: true,
        applicationKeypad: false,
        mouseReporting: 'unknown',
        bracketedPaste: false,
      },
      activeFg: 'default',
      activeBg: 'default',
    }
  })() : state

  if (!liveState) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        No terminal state available
      </div>
    )
  }

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between py-1.5 px-3 hover:bg-white/3">
      <span className="text-text-muted text-xs">{label}</span>
      <span className="text-text-primary text-xs font-mono">{value}</span>
    </div>
  )

  const boolBadge = (val: boolean) => (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${val ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-text-muted'}`}>
      {val ? 'ON' : 'OFF'}
    </span>
  )

  return (
    <div className="overflow-auto h-full" style={{ scrollbarWidth: 'thin' }}>
      <div className="px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider border-b border-border">Cursor</div>
      {row('Position', `(${liveState.cursorCol}, ${liveState.cursorRow})`)}
      {row('Visible', boolBadge(liveState.modes.cursorVisible))}

      <div className="px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider border-b border-border mt-1">Dimensions</div>
      {row('Columns', liveState.cols)}
      {row('Rows', liveState.rows)}

      <div className="px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider border-b border-border mt-1">Terminal Modes</div>
      {row('Application Keypad', boolBadge(liveState.modes.applicationKeypad))}
      {row('Bracketed Paste', boolBadge(liveState.modes.bracketedPaste))}
      {row('Mouse Reporting', <span className="text-text-secondary">{liveState.modes.mouseReporting}</span>)}

      <div className="px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider border-b border-border mt-1">Colors</div>
      {row('Active Foreground', liveState.activeFg)}
      {row('Active Background', liveState.activeBg)}
    </div>
  )
}

// ─── Cells Tab ───────────────────────────────────────────────────────────────

function CellsTab({
  cellRow, cellCol, onRowChange, onColChange, onInspect, cellInfo
}: {
  cellRow: string
  cellCol: string
  onRowChange: (v: string) => void
  onColChange: (v: string) => void
  onInspect: () => void
  cellInfo: CellInfo | null
}) {
  const inputCls = 'bg-white/5 border border-border rounded px-2 py-1 text-xs font-mono text-text-primary outline-none focus:border-blue-500/50 w-16'

  return (
    <div className="overflow-auto h-full p-3" style={{ scrollbarWidth: 'thin' }}>
      {/* Cell selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-text-muted text-xs">Row:</span>
        <input
          className={inputCls}
          value={cellRow}
          onChange={e => onRowChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onInspect()}
          placeholder="0"
        />
        <span className="text-text-muted text-xs">Col:</span>
        <input
          className={inputCls}
          value={cellCol}
          onChange={e => onColChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onInspect()}
          placeholder="0"
        />
        <button
          className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors"
          onClick={onInspect}
        >
          Inspect
        </button>
      </div>

      {/* Cell info */}
      {cellInfo ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider bg-white/3">
            Cell ({cellInfo.col}, {cellInfo.row})
          </div>

          <div className="divide-y divide-white/5">
            <CellRow label="Character" value={
              <span className="flex items-center gap-2">
                <span className="text-lg leading-none">{cellInfo.char}</span>
                <span className="text-text-muted text-[10px]">U+{cellInfo.codepoint.toString(16).toUpperCase().padStart(4, '0')}</span>
              </span>
            } />
            <CellRow label="Foreground" value={cellInfo.fg} />
            <CellRow label="Background" value={cellInfo.bg} />
            <CellRow label="Bold" value={cellInfo.bold ? 'Yes' : 'No'} />
            <CellRow label="Italic" value={cellInfo.italic ? 'Yes' : 'No'} />
            <CellRow label="Underline" value={cellInfo.underline ? 'Yes' : 'No'} />
            <CellRow label="Dim" value={cellInfo.dim ? 'Yes' : 'No'} />
            <CellRow label="Strikethrough" value={cellInfo.strikethrough ? 'Yes' : 'No'} />
          </div>
        </div>
      ) : (
        <div className="text-text-muted text-xs text-center mt-8">
          Enter row and column numbers, then click Inspect to examine a cell.
        </div>
      )}
    </div>
  )
}

function CellRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3">
      <span className="text-text-muted text-xs">{label}</span>
      <span className="text-text-primary text-xs font-mono">{value}</span>
    </div>
  )
}
