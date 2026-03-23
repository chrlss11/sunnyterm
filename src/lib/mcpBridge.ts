/**
 * MCP Bridge — handles IPC messages from the MCP server in the main process.
 * Reads canvas state from Zustand store and terminal output from the registry.
 * Uses preload-exposed API (contextIsolation: true).
 */

import { useStore } from '../store'
import { getTerminalEntry } from './terminalRegistry'
import type { TileKind } from '../types'

/** Read N lines from a terminal tile's xterm buffer */
function readTerminalLines(tileId: string, lines: number): string {
  const entry = getTerminalEntry(tileId)
  if (!entry) return ''
  const buffer = entry.terminal.buffer.active
  const totalLines = buffer.length
  const start = Math.max(0, totalLines - lines)
  const output: string[] = []
  for (let i = start; i < totalLines; i++) {
    const line = buffer.getLine(i)
    if (line) output.push(line.translateToString(true))
  }
  return output.join('\n')
}

/** Register a handler for an MCP channel */
function handle(channel: string, handler: (responseChannel: string, ...args: any[]) => void) {
  window.electronAPI.onMcpMessage(channel, (responseChannel: string, ...args: any[]) => {
    handler(responseChannel, ...args)
  })
}

/**
 * Initialize MCP IPC listeners. Call once on app startup.
 */
export function initMcpBridge(): void {
  // ── Get canvas state ───────────────────────────────────────────────────────
  handle('mcp:getCanvas', (rc) => {
    const state = useStore.getState()
    const tiles = state.tiles.map((t) => {
      const entry = getTerminalEntry(t.id)
      return {
        id: t.id,
        kind: t.kind,
        name: t.name,
        x: t.x,
        y: t.y,
        w: t.w,
        h: t.h,
        outputLink: t.outputLink,
        isExited: entry?.isExited ?? false,
      }
    })
    window.electronAPI.mcpRespond(rc, {
      tiles,
      sections: state.sections,
      zoom: state.zoom,
      panX: state.panX,
      panY: state.panY,
      focusedId: state.focusedId,
      viewMode: state.viewMode,
      theme: state.theme,
    })
  })

  // ── Read single tile output ────────────────────────────────────────────────
  handle('mcp:readTile', (rc, tileId: string, lines: number) => {
    const content = readTerminalLines(tileId, lines)
    window.electronAPI.mcpRespond(rc, content || null)
  })

  // ── Read all tiles ─────────────────────────────────────────────────────────
  handle('mcp:readAllTiles', (rc, lines: number) => {
    const state = useStore.getState()
    const result: Record<string, { name: string; kind: string; content: string }> = {}
    for (const tile of state.tiles) {
      result[tile.id] = {
        name: tile.name,
        kind: tile.kind,
        content: readTerminalLines(tile.id, lines),
      }
    }
    window.electronAPI.mcpRespond(rc, result)
  })

  // ── Create tile ────────────────────────────────────────────────────────────
  handle('mcp:createTile', (rc, kind: string, x?: number, y?: number, name?: string, initialUrl?: string, initialPath?: string) => {
    const store = useStore.getState()
    const tile = store.spawnTile(kind as TileKind, x, y, initialUrl, initialPath)
    if (name) store.renameTile(tile.id, name)
    window.electronAPI.mcpRespond(rc, { id: tile.id, name: name ?? tile.name })
  })

  // ── Remove tile ────────────────────────────────────────────────────────────
  handle('mcp:removeTile', (rc, tileId: string) => {
    useStore.getState().removeTile(tileId)
    window.electronAPI.mcpRespond(rc, true)
  })

  // ── Move tile ──────────────────────────────────────────────────────────────
  handle('mcp:moveTile', (rc, tileId: string, x: number, y: number) => {
    const store = useStore.getState()
    useStore.setState({
      tiles: store.tiles.map((t) => t.id === tileId ? { ...t, x, y } : t)
    })
    window.electronAPI.mcpRespond(rc, true)
  })

  // ── Connect tiles ──────────────────────────────────────────────────────────
  handle('mcp:connectTiles', (rc, fromId: string, toId: string) => {
    const store = useStore.getState()
    store.startLinking(fromId)
    store.completeLinking(toId)
    window.electronAPI.mcpRespond(rc, true)
  })

  // ── Create section ─────────────────────────────────────────────────────────
  handle('mcp:createSection', (rc, tileIds: string[], name?: string) => {
    const store = useStore.getState()
    store.setSelectedIds(tileIds)
    store.createSection(tileIds)
    if (name) {
      const sections = useStore.getState().sections
      const newest = sections[sections.length - 1]
      if (newest) store.renameSection(newest.id, name)
    }
    store.clearSelection()
    const sections = useStore.getState().sections
    const newest = sections[sections.length - 1]
    window.electronAPI.mcpRespond(rc, newest ? { id: newest.id } : null)
  })

  // ── Run command ────────────────────────────────────────────────────────────
  handle('mcp:runCommand', (rc, _command: string, name?: string, x?: number, y?: number) => {
    const store = useStore.getState()
    const tile = store.spawnTile('terminal', x, y)
    if (name) store.renameTile(tile.id, name)
    window.electronAPI.mcpRespond(rc, { id: tile.id })
  })

  // ── Set theme ──────────────────────────────────────────────────────────────
  handle('mcp:setTheme', (rc, theme: string) => {
    useStore.getState().setTheme(theme)
    window.electronAPI.mcpRespond(rc, true)
  })

  // ── Rename tile ────────────────────────────────────────────────────────────
  handle('mcp:renameTile', (rc, tileId: string, name: string) => {
    useStore.getState().renameTile(tileId, name)
    window.electronAPI.mcpRespond(rc, true)
  })

  // ── Focus tile ─────────────────────────────────────────────────────────────
  handle('mcp:focusTile', (rc, tileId: string) => {
    useStore.getState().focusTile(tileId)
    window.electronAPI.mcpRespond(rc, true)
  })
}
