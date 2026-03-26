import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { ILink, ILinkProvider } from '@xterm/xterm'
import { SearchAddon } from '@xterm/addon-search'
import { ImageAddon } from '@xterm/addon-image'

import '@xterm/xterm/css/xterm.css'
import { useStore } from '../store'
import { TITLE_BAR_H } from './TileContainer'
import { registerTerminal, unregisterTerminal, getTerminalEntry } from '../lib/terminalRegistry'
import type { TerminalEntry } from '../lib/terminalRegistry'
import { stripAnsi } from '../lib/stripAnsi'
import { markActivity } from '../lib/tileActivity'
import { registerCommandParser, findPreviousPrompt, findNextPrompt, clearCommands } from '../lib/commandMarkers'
import { InputInterceptor } from '../lib/inputInterceptor'
// GhostTextRenderer removed — no inline suggestions
import { initHistory, addCommand, findMatch } from '../lib/commandHistory'
// CompletionDropdown removed — all input goes directly to shell
import { TerminalShortcuts } from './TerminalShortcuts'
import { THEMES, type ThemeName } from '../lib/themes'

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  tileId: string
  /** Override dimensions for non-canvas views (focus mode) */
  overrideW?: number
  overrideH?: number
}

export function TerminalTile({ tileId, overrideW, overrideH }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  // Track current theme for terminal init effect (avoids re-running on theme change)
  const themeRef = useRef('dark')

  const [exitInfo, setExitInfo] = useState<{ code: number } | null>(null)
  // incrementing this forces terminal + PTY to fully reinitialise
  const [instanceKey, setInstanceKey] = useState(0)

  const interceptorRef = useRef<InputInterceptor | null>(null)

  const tiles = useStore((s) => s.tiles)
  const isDark = useStore((s) => s.isDark)
  const theme = useStore((s) => s.theme)
  const zoom = useStore((s) => s.zoom)
  const focusedId = useStore((s) => s.focusedId)
  themeRef.current = theme

  const tile = tiles.find((t) => t.id === tileId)

  const outputLinkRef = useRef<string | null>(tile?.outputLink ?? null)
  outputLinkRef.current = tile?.outputLink ?? null

  const { autoRenameTile, consumeTileCwd, markTileExited, markTileAlive } = useStore()

  // ── Terminal + PTY init ────────────────────────────────────────────────────
  // On first mount: create xterm + PTY. On view switch: reattach existing xterm DOM.
  // On restart (instanceKey > 0): dispose old, create fresh.

  useEffect(() => {
    if (!containerRef.current) return

    // Check if we have a persistent xterm instance for this tile
    const existing = getTerminalEntry(tileId)

    if (existing && instanceKey === 0) {
      // ── Reattach existing xterm DOM element (view switch) ──────────────
      containerRef.current.appendChild(existing.element)
      termRef.current = existing.terminal
      fitAddonRef.current = existing.fitAddon

      // Restore exit state
      if (existing.isExited) {
        setExitInfo({ code: existing.exitCode! })
      } else {
        setExitInfo(null)
      }

      // Sync outputLink ref
      existing.outputLink = tile?.outputLink ?? null

      return () => {
        // On unmount: detach DOM but keep xterm alive
        if (existing.element.parentNode === containerRef.current) {
          containerRef.current!.removeChild(existing.element)
        }
        termRef.current = null
        fitAddonRef.current = null
      }
    }

    // ── Create new xterm instance (first mount or restart) ──────────────

    // If restarting, fully dispose the old instance
    if (instanceKey > 0) {
      const old = getTerminalEntry(tileId)
      if (old) {
        old.cleanupPty?.()
        old.cleanupExit?.()
        window.electronAPI.ptyKill(tileId)
        old.terminal.dispose()
        unregisterTerminal(tileId)
      }
    }

    setExitInfo(null)

    // Create a detached wrapper div for xterm to render into.
    // Padding lives here (not on containerRef) so xterm's mouse coordinate
    // mapping stays aligned — xterm uses getBoundingClientRect on its own
    // elements, and extra parent padding would shift the offset.
    const xtermElement = document.createElement('div')
    xtermElement.style.width = '100%'
    xtermElement.style.height = '100%'
    xtermElement.style.padding = '6px 8px'
    xtermElement.style.boxSizing = 'border-box'
    containerRef.current.appendChild(xtermElement)

    const currentTheme = THEMES[themeRef.current as ThemeName] ?? THEMES.dark
    const isMacPlatform = navigator.platform.includes('Mac')
    const term = new Terminal({
      theme: currentTheme.terminal,
      fontFamily: '"Google Sans Mono", "Cascadia Code", Menlo, Monaco, Consolas, monospace',
      fontSize: tile?.fontSize ?? 13,
      lineHeight: 1.0,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      allowProposedApi: true,
      macOptionIsMeta: isMacPlatform,
      // Don't use windowsMode — it breaks text selection
    })

    // Ctrl+C copies when text is selected, otherwise sends SIGINT
    // Ctrl+V pastes from clipboard
    // Ctrl+A selects all terminal text
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (!isMacPlatform && e.ctrlKey && !e.shiftKey && !e.altKey && e.type === 'keydown') {
        if (e.key === 'c' && term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection())
          return false
        }
        if (e.key === 'v') {
          navigator.clipboard.readText().then((text) => {
            if (text) window.electronAPI.ptyWrite(tileId, text)
          })
          return false
        }
        if (e.key === 'a') {
          term.selectAll()
          return false
        }
      }
      return true
    })

    // Right-click context menu: copy if selected, paste otherwise
    xtermElement.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if (term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection())
        term.clearSelection()
      } else {
        navigator.clipboard.readText().then((text) => {
          if (text) window.electronAPI.ptyWrite(tileId, text)
        })
      }
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()

    const imageAddon = new ImageAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(imageAddon)

    term.open(xtermElement)

    // ── Shell Integration: register OSC 133 command boundary parser ────────
    registerCommandParser(tileId, term)

    // ── Smart Links: custom link provider for URLs, file paths, Docker IDs ─
    const smartLinkProvider: ILinkProvider = {
      provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void) {
        const line = term.buffer.active.getLine(bufferLineNumber - 1)
        if (!line) { callback(undefined); return }
        const text = line.translateToString(true)
        const links: ILink[] = []

        // File paths with optional line:col — /path/to/file.ts:42:10
        const filePathRegex = /(?:^|\s)((?:\/[\w.\-+@]+)+(?::(\d+)(?::(\d+))?)?)/g
        let match: RegExpExecArray | null
        while ((match = filePathRegex.exec(text)) !== null) {
          const startIndex = match.index + (match[0][0] === ' ' ? 1 : 0)
          const matchText = match[1]
          links.push({
            range: {
              start: { x: startIndex + 1, y: bufferLineNumber },
              end: { x: startIndex + matchText.length + 1, y: bufferLineNumber }
            },
            text: matchText,
            activate(_event: MouseEvent, linkText: string) {
              const parts = linkText.split(':')
              const filePath = parts[0]
              useStore.getState().spawnTile('file', undefined, undefined, undefined, filePath)
            }
          })
        }

        // URLs (http/https)
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g
        while ((match = urlRegex.exec(text)) !== null) {
          const urlText = match[0]
          const urlIndex = match.index
          links.push({
            range: {
              start: { x: urlIndex + 1, y: bufferLineNumber },
              end: { x: urlIndex + urlText.length + 1, y: bufferLineNumber }
            },
            text: urlText,
            activate(_event: MouseEvent, linkText: string) {
              useStore.getState().spawnTile('browser', undefined, undefined, linkText)
            }
          })
        }

        // Docker container IDs (12+ hex chars preceded by docker context)
        const dockerRegex = /\b([0-9a-f]{12,64})\b/g
        while ((match = dockerRegex.exec(text)) !== null) {
          const before = text.substring(Math.max(0, match.index - 20), match.index)
          if (/container|docker|CONTAINER/i.test(before)) {
            const dockerText = match[0]
            const dockerIndex = match.index
            links.push({
              range: {
                start: { x: dockerIndex + 1, y: bufferLineNumber },
                end: { x: dockerIndex + dockerText.length + 1, y: bufferLineNumber }
              },
              text: dockerText,
              activate() {
                useStore.getState().spawnTile('docker')
              }
            })
          }
        }

        callback(links.length > 0 ? links : undefined)
      }
    }
    term.registerLinkProvider(smartLinkProvider)

    // ── Command navigation (Ctrl+Up / Ctrl+Down to jump between prompts) ──
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type !== 'keydown' || !event.ctrlKey) return true
      if (event.key === 'ArrowUp') {
        const currentLine = term.buffer.active.viewportY
        const target = findPreviousPrompt(tileId, currentLine)
        if (target >= 0) {
          term.scrollToLine(target)
        }
        return false // prevent default
      }
      if (event.key === 'ArrowDown') {
        const currentLine = term.buffer.active.viewportY
        const target = findNextPrompt(tileId, currentLine)
        if (target >= 0) {
          term.scrollToLine(target)
        }
        return false
      }
      return true
    })

    // Resize terminal to match tile dimensions immediately, before PTY spawn
    const initCols = tileCols(tile?.w ?? 640)
    const initRows = tileRows(tile?.h ?? 400)
    term.resize(initCols, initRows)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Create registry entry
    const entry: TerminalEntry = {
      searchAddon,
      terminal: term,
      fitAddon,
      element: xtermElement,
      cleanupPty: null,
      cleanupExit: null,
      isExited: false,
      exitCode: null,
      savedCwd: undefined,
      outputLink: tile?.outputLink ?? null
    }
    registerTerminal(tileId, entry)

    // Determine CWD: use workspace-restored CWD on first mount, saved CWD on restart
    const cwd = instanceKey === 0
      ? (consumeTileCwd(tileId) ?? undefined)
      : entry.savedCwd

    markTileAlive(tileId)

    // ── Ghost text disabled for performance ──────────────────────────────
    const ghostRenderer = { setGhostText(_: string | null) {}, dispose() {} }

    // ── Completion helper ─────────────────────────────────────────────────
    // ── Input interceptor (minimal — just tracks commands for history) ───
    initHistory()

    const interceptor = new InputInterceptor(term, {
      ptyWrite: (data) => window.electronAPI.ptyWrite(tileId, data),
      onCommandExecuted: (cmd) => addCommand(cmd),
      getSuggestion: () => null,
      renderGhostText: () => {},
      requestCompletions: () => {},
      dismissCompletions: () => {}
    })
    interceptorRef.current = interceptor

    // Helper to subscribe to PTY data/exit events
    let lastActivityMark = 0
    const subscribePty = () => {
      const cleanup = window.electronAPI.onPtyData(tileId, (data) => {
        term.write(data)
        // Throttle activity marking to avoid per-chunk overhead
        const now = Date.now()
        if (now - lastActivityMark > 500) { lastActivityMark = now; markActivity(tileId) }
        interceptor.handleOutput(data) // detect raw mode
        const link = entry.outputLink
        if (link) {
          const clean = stripAnsi(data)
          if (clean) window.electronAPI.ptyWrite(link, clean)
        }
      })
      entry.cleanupPty = cleanup

      const cleanupExit = window.electronAPI.onPtyExit(tileId, async (code) => {
        const cwd = await window.electronAPI.ptyGetCwd(tileId).catch(() => null)
        entry.savedCwd = cwd ?? undefined
        entry.isExited = true
        entry.exitCode = code
        setExitInfo({ code })
        markTileExited(tileId)
      })
      entry.cleanupExit = cleanupExit
    }

    // Try to reattach to an existing PTY (survives HMR), otherwise spawn new
    window.electronAPI.ptyHas(tileId).then((exists) => {
      if (exists) {
        window.electronAPI.ptyReattach(tileId).then((ok) => {
          if (ok) {
            subscribePty()
          } else {
            return window.electronAPI.ptySpawn(tileId, tile?.shell ?? '', tileCols(tile?.w ?? 640), tileRows(tile?.h ?? 400), cwd).then(subscribePty)
          }
        })
      } else {
        window.electronAPI.ptySpawn(tileId, tile?.shell ?? '', tileCols(tile?.w ?? 640), tileRows(tile?.h ?? 400), cwd).then(subscribePty)
      }
    }).catch((err) => {
      term.write(`\r\n\x1b[31mFailed to spawn PTY: ${err}\x1b[0m\r\n`)
    })

    // Forward user input through interceptor (handles ghost text + completions)
    term.onData((data) => {
      if (entry.isExited) return
      interceptor.handleInput(data)
    })

    term.onResize(({ cols, rows }) => {
      window.electronAPI.ptyResize(tileId, cols, rows)
    })

    // Tile Resonance — cross-tile highlighting on text selection
    term.onSelectionChange(() => {
      const sel = term.getSelection()
      if (sel && sel.trim().length >= 2) {
        // Lazy import to avoid circular deps
        import('../lib/resonance').then(({ useResonance }) => {
          useResonance.getState().setResonance(sel.trim())
        })
      } else {
        import('../lib/resonance').then(({ useResonance }) => {
          useResonance.getState().clearResonance()
        })
      }
    })

    // Listen for restart requests dispatched from context menu
    const handleRestartEvent = (e: Event) => {
      const { tileId: id } = (e as CustomEvent).detail
      if (id === tileId) setInstanceKey((k) => k + 1)
    }
    document.addEventListener('restart-terminal', handleRestartEvent)

    return () => {
      document.removeEventListener('restart-terminal', handleRestartEvent)
      const tileStillExists = useStore.getState().tiles.some((t) => t.id === tileId)

      if (!tileStillExists) {
        // Tile was removed — fully dispose
        interceptor.dispose()
        ghostRenderer.dispose()
        interceptorRef.current = null
        entry.cleanupPty?.()
        entry.cleanupExit?.()
        window.electronAPI.ptyKill(tileId)
        term.dispose()
        unregisterTerminal(tileId)
        clearCommands(tileId)
      } else {
        // View switch or HMR — detach DOM but keep xterm alive
        if (xtermElement.parentNode === containerRef.current) {
          containerRef.current!.removeChild(xtermElement)
        }
      }

      termRef.current = null
      fitAddonRef.current = null
    }
  }, [tileId, instanceKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-focus terminal when this tile becomes focused ──────────────────────

  useEffect(() => {
    if (focusedId === tileId && termRef.current) {
      // Immediate focus + delayed focus to handle re-render timing
      termRef.current.focus()
      const t = setTimeout(() => termRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [focusedId, tileId])

  // ── Keep outputLink ref in sync on registry entry ──────────────────────────

  useEffect(() => {
    const entry = getTerminalEntry(tileId)
    if (entry) entry.outputLink = tile?.outputLink ?? null
  }, [tile?.outputLink, tileId])

  // ── Sync terminal theme when theme changes ──────────────────────────────

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    const themeDef = THEMES[theme as ThemeName] ?? THEMES.dark
    term.options.theme = themeDef.terminal
    // Force xterm to repaint with new theme colors
    term.refresh(0, term.rows - 1)
    // Update the container background to match
    if (containerRef.current) {
      const viewport = containerRef.current.querySelector('.xterm-viewport') as HTMLElement
      if (viewport) viewport.style.backgroundColor = themeDef.terminal.background
    }
  }, [theme])

  // ── Adaptive font size: tile.fontSize is the canvas size, focus scales up ──
  const viewMode = useStore((s) => s.viewMode)

  useEffect(() => {
    const term = termRef.current
    if (!term || !tile) return

    // tile.fontSize is the BASE size for canvas mode
    const canvasSize = tile.fontSize ?? 13
    let fs: number

    if (overrideW && overrideH) {
      // Focus mode: scale up proportionally to the viewport/tile ratio
      const wRatio = overrideW / Math.max(tile.w, 300)
      const hRatio = overrideH / Math.max(tile.h, 200)
      const scale = Math.min(wRatio, hRatio)
      // Scale the canvas font size up, clamped between canvasSize and 28
      fs = Math.round(Math.max(canvasSize, Math.min(canvasSize * scale * 0.75, 28)))
    } else {
      // Canvas mode: use the tile's font size directly
      fs = canvasSize
    }

    if (term.options.fontSize !== fs) {
      term.options.fontSize = fs
      try { fitAddonRef.current?.fit() } catch {}
    }
  }, [tile?.fontSize, viewMode, overrideW, overrideH, tile?.w, tile?.h])

  // ── Fit terminal to tile dimensions ──────────────────────────────────────
  // Uses tile.w/tile.h directly instead of DOM measurements to avoid
  // issues with CSS transforms (zoom) and mount animations (scale 0.97→1)

  useEffect(() => {
    const term = termRef.current
    if (!term || !tile) return

    const doFit = () => {
      if (!termRef.current) return
      const core = (termRef.current as any)._core
      const dims = core?._renderService?.dimensions?.css?.cell
      if (!dims?.width || !dims?.height) {
        // Renderer not ready yet, use fitAddon as fallback
        try { fitAddonRef.current?.fit() } catch {}
        return
      }

      // Use override dimensions if provided (focus mode), otherwise tile dimensions
      const effW = overrideW ?? tile.w
      const effH = overrideH ?? tile.h
      const availW = effW - TERM_PAD_X
      const availH = effH - TITLE_BAR_H - TERM_PAD_Y
      const cols = Math.max(2, Math.floor(availW / dims.width) - 1)
      const rows = Math.max(1, Math.floor(availH / dims.height))

      if (cols !== termRef.current.cols || rows !== termRef.current.rows) {
        termRef.current.resize(cols, rows)
      }
    }

    // Staggered fits: 0ms (immediate), 100ms (after render), 200ms (after animation)
    const t1 = setTimeout(doFit, 0)
    const t2 = setTimeout(doFit, 100)
    const t3 = setTimeout(doFit, 200)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [tile?.w, tile?.h, tile?.fontSize, overrideW, overrideH, zoom, tileId, instanceKey])

  const handleRestart = () => {
    setExitInfo(null)
    markTileAlive(tileId)
    setInstanceKey((k) => k + 1)
  }

  // ── Paste image from clipboard (Ctrl+V with image) ──────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const term = termRef.current
    if (!term) return
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find((item) => item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        const name = btoa(file.name || 'clipboard.png')
        const seq = `\x1b]1337;File=inline=1;size=${file.size};name=${name}:${base64}\x07`
        term.write(seq)
        term.write('\r\n')
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const term = termRef.current
    if (!term) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        // Display image inline using iTerm2 inline image protocol
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          // iTerm2 inline image: ESC ] 1337 ; File=inline=1;size=N;name=NAME:BASE64 ST
          const name = btoa(file.name)
          const seq = `\x1b]1337;File=inline=1;size=${file.size};name=${name}:${base64}\x07`
          term.write(seq)
          term.write('\r\n')
        }
        reader.readAsDataURL(file)
      } else {
        // For non-image files, type the file path into the terminal
        const path = (file as any).path
        if (path) {
          window.electronAPI.ptyWrite(tileId, path.includes(' ') ? `"${path}"` : path)
        }
      }
    }
  }, [tileId])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return (
    <div className="w-full h-full relative" onDrop={handleDrop} onDragOver={handleDragOver} onPaste={handlePaste}>
      <div ref={containerRef} className="w-full h-full" />

      {exitInfo === null && <TerminalShortcuts tileId={tileId} />}

      {exitInfo !== null && (
        <div
          className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-3"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="text-white text-sm font-medium">
            Process exited (code {exitInfo.code})
          </div>
          <button
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors cursor-pointer"
            onClick={handleRestart}
          >
            ↺ Restart
          </button>
        </div>
      )}
    </div>
  )
}

// Terminal padding (must match the style on containerRef)
const TERM_PAD_X = 8 * 2 // 8px left + 8px right
const TERM_PAD_Y = 6 * 2 // 6px top + 6px bottom

// Calculate cols/rows from tile pixel dimensions and font metrics
function tileCols(tileW: number) { return Math.max(10, Math.floor((tileW - TERM_PAD_X) / 7.8) - 1) }
function tileRows(tileH: number) { return Math.max(5, Math.floor((tileH - TITLE_BAR_H - TERM_PAD_Y) / 13)) }
