/**
 * MCP Server for SunnyTerm — lets Claude Code see and control the canvas.
 *
 * Runs in the Electron main process on a local HTTP port.
 * Communicates with the renderer via BrowserWindow.webContents IPC.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import type { BrowserWindow } from 'electron'
import { z } from 'zod'
import type { PtyManager } from './pty'

const MCP_PORT = 24842

interface TileInfo {
  id: string
  kind: string
  name: string
  x: number
  y: number
  w: number
  h: number
  outputLink: string | null
  isExited: boolean
}

interface SectionInfo {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
}

interface CanvasState {
  tiles: TileInfo[]
  sections: SectionInfo[]
  zoom: number
  panX: number
  panY: number
  focusedId: string | null
  viewMode: string
  theme: string
}

/**
 * Ask the renderer for data via IPC. Returns null on timeout.
 */
function askRenderer<T>(win: BrowserWindow, channel: string, ...args: unknown[]): Promise<T | null> {
  return new Promise((resolve) => {
    if (!win || win.isDestroyed()) { resolve(null); return }
    const timeout = setTimeout(() => resolve(null), 3000)
    const responseChannel = `${channel}:response:${Date.now()}`
    const { ipcMain } = require('electron')
    ipcMain.once(responseChannel, (_event: unknown, data: T) => {
      clearTimeout(timeout)
      resolve(data)
    })
    win.webContents.send(channel, responseChannel, ...args)
  })
}

export function startMcpServer(getWindow: () => BrowserWindow | null, ptyManager: PtyManager): void {
  const server = new McpServer({
    name: 'sunnyterm',
    version: '0.5.2',
  })

  // ── Resources ──────────────────────────────────────────────────────────────

  // ── Tools ──────────────────────────────────────────────────────────────────

  server.tool(
    'get_canvas',
    'Get the current canvas state: all tiles, sections, viewport, and theme',
    {},
    async () => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'SunnyTerm window not available' }] }
      const state = await askRenderer<CanvasState>(win, 'mcp:getCanvas')
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(state, null, 2) }]
      }
    }
  )

  server.tool(
    'read_tile',
    'Read the output/content of a tile by ID. For terminals: last N lines. For others: current content.',
    { tileId: z.string().describe('The tile ID to read'), lines: z.number().optional().describe('Number of lines to read (default 100)') },
    async ({ tileId, lines }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'SunnyTerm window not available' }] }
      const result = await askRenderer<string>(win, 'mcp:readTile', tileId, lines ?? 100)
      return {
        content: [{ type: 'text' as const, text: result ?? 'Tile not found or empty' }]
      }
    }
  )

  server.tool(
    'write_to_tile',
    'Send text/commands to a terminal tile. The text is written to the PTY stdin.',
    { tileId: z.string().describe('Terminal tile ID'), text: z.string().describe('Text to write (include \\n for Enter)') },
    async ({ tileId, text }) => {
      try {
        ptyManager.write(tileId, text)
        return { content: [{ type: 'text' as const, text: `Wrote ${text.length} chars to tile ${tileId}` }] }
      } catch {
        return { content: [{ type: 'text' as const, text: `Failed to write to tile ${tileId} — tile may not exist or PTY is dead` }] }
      }
    }
  )

  server.tool(
    'create_tile',
    'Create a new tile on the canvas',
    {
      kind: z.enum(['terminal', 'http', 'postgres', 'browser', 'file', 'lens']).describe('Tile type'),
      x: z.number().optional().describe('X position (auto if omitted)'),
      y: z.number().optional().describe('Y position (auto if omitted)'),
      name: z.string().optional().describe('Tile name'),
      initialUrl: z.string().optional().describe('For browser tiles: URL to open'),
      initialPath: z.string().optional().describe('For file tiles: directory to open'),
    },
    async ({ kind, x, y, name, initialUrl, initialPath }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      const result = await askRenderer<{ id: string; name: string }>(
        win, 'mcp:createTile', kind, x, y, name, initialUrl, initialPath
      )
      return {
        content: [{ type: 'text' as const, text: result ? `Created ${kind} tile: ${result.id} (${result.name})` : 'Failed to create tile' }]
      }
    }
  )

  server.tool(
    'remove_tile',
    'Remove/close a tile from the canvas',
    { tileId: z.string().describe('Tile ID to remove') },
    async ({ tileId }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      await askRenderer(win, 'mcp:removeTile', tileId)
      return { content: [{ type: 'text' as const, text: `Removed tile ${tileId}` }] }
    }
  )

  server.tool(
    'move_tile',
    'Move a tile to a new position on the canvas',
    { tileId: z.string(), x: z.number(), y: z.number() },
    async ({ tileId, x, y }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      await askRenderer(win, 'mcp:moveTile', tileId, x, y)
      return { content: [{ type: 'text' as const, text: `Moved tile ${tileId} to (${x}, ${y})` }] }
    }
  )

  server.tool(
    'connect_tiles',
    'Connect output of one tile to another (pipe terminal output)',
    { fromId: z.string().describe('Source tile ID'), toId: z.string().describe('Target tile ID') },
    async ({ fromId, toId }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      await askRenderer(win, 'mcp:connectTiles', fromId, toId)
      return { content: [{ type: 'text' as const, text: `Connected ${fromId} → ${toId}` }] }
    }
  )

  server.tool(
    'create_section',
    'Group tiles into a named section',
    { tileIds: z.array(z.string()).describe('Tile IDs to group'), name: z.string().optional().describe('Section name') },
    async ({ tileIds, name }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      const result = await askRenderer<{ id: string }>(win, 'mcp:createSection', tileIds, name)
      return { content: [{ type: 'text' as const, text: result ? `Created section ${result.id}` : 'Failed' }] }
    }
  )

  server.tool(
    'run_command',
    'Create a terminal tile and immediately run a command in it',
    {
      command: z.string().describe('Command to execute'),
      name: z.string().optional().describe('Tile name'),
      x: z.number().optional(),
      y: z.number().optional(),
      cwd: z.string().optional().describe('Working directory'),
    },
    async ({ command, name, x, y, cwd }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      const result = await askRenderer<{ id: string }>(
        win, 'mcp:runCommand', command, name, x, y, cwd
      )
      if (!result) return { content: [{ type: 'text' as const, text: 'Failed to create terminal' }] }
      // Wait a moment for PTY to be ready, then write the command
      await new Promise((r) => setTimeout(r, 500))
      ptyManager.write(result.id, command + '\n')
      return { content: [{ type: 'text' as const, text: `Created terminal ${result.id} and running: ${command}` }] }
    }
  )

  server.tool(
    'read_all_tiles',
    'Read output from ALL terminal tiles at once. Useful for getting a full picture of the workspace.',
    { lines: z.number().optional().describe('Lines per tile (default 50)') },
    async ({ lines }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      const result = await askRenderer<Record<string, { name: string; kind: string; content: string }>>(
        win, 'mcp:readAllTiles', lines ?? 50
      )
      if (!result) return { content: [{ type: 'text' as const, text: 'No tiles' }] }
      let text = ''
      for (const [id, tile] of Object.entries(result)) {
        text += `\n━━━ ${tile.name} (${tile.kind}) [${id}] ━━━\n${tile.content}\n`
      }
      return { content: [{ type: 'text' as const, text: text || 'No tiles on canvas' }] }
    }
  )

  server.tool(
    'set_theme',
    'Change the canvas theme',
    { theme: z.enum(['dark', 'light', 'claude', 'vino']).describe('Theme name') },
    async ({ theme }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      await askRenderer(win, 'mcp:setTheme', theme)
      return { content: [{ type: 'text' as const, text: `Theme set to ${theme}` }] }
    }
  )

  server.tool(
    'rename_tile',
    'Rename a tile on the canvas',
    { tileId: z.string(), name: z.string() },
    async ({ tileId, name }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      await askRenderer(win, 'mcp:renameTile', tileId, name)
      return { content: [{ type: 'text' as const, text: `Renamed tile ${tileId} to "${name}"` }] }
    }
  )

  server.tool(
    'focus_tile',
    'Focus/bring attention to a specific tile',
    { tileId: z.string() },
    async ({ tileId }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      await askRenderer(win, 'mcp:focusTile', tileId)
      return { content: [{ type: 'text' as const, text: `Focused tile ${tileId}` }] }
    }
  )

  server.tool(
    'scaffold_workspace',
    'Create a complete workspace layout from a description. Creates multiple tiles arranged logically.',
    {
      tiles: z.array(z.object({
        kind: z.enum(['terminal', 'http', 'postgres', 'browser', 'file']),
        name: z.string(),
        x: z.number(),
        y: z.number(),
        command: z.string().optional().describe('For terminals: command to run immediately'),
        url: z.string().optional().describe('For browser tiles: URL'),
        path: z.string().optional().describe('For file tiles: directory'),
      })).describe('Array of tiles to create'),
      sectionName: z.string().optional().describe('Group all tiles into a named section'),
    },
    async ({ tiles, sectionName }) => {
      const win = getWindow()
      if (!win) return { content: [{ type: 'text' as const, text: 'Window not available' }] }
      const createdIds: string[] = []
      for (const t of tiles) {
        const result = await askRenderer<{ id: string }>(
          win, 'mcp:createTile', t.kind, t.x, t.y, t.name, t.url, t.path
        )
        if (result) {
          createdIds.push(result.id)
          // If terminal with command, wait and send it
          if (t.kind === 'terminal' && t.command) {
            await new Promise((r) => setTimeout(r, 500))
            ptyManager.write(result.id, t.command + '\n')
          }
        }
      }
      // Create section if requested
      if (sectionName && createdIds.length > 0) {
        await askRenderer(win, 'mcp:createSection', createdIds, sectionName)
      }
      return {
        content: [{ type: 'text' as const, text: `Created ${createdIds.length} tiles: ${createdIds.join(', ')}${sectionName ? ` in section "${sectionName}"` : ''}` }]
      }
    }
  )

  // ── Start HTTP server ──────────────────────────────────────────────────────

  // Track transports for session management
  const transports = new Map<string, StreamableHTTPServerTransport>()

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.url === '/mcp') {
      if (req.method === 'POST') {
        // Read body
        const body = await new Promise<string>((resolve) => {
          let data = ''
          req.on('data', (chunk: Buffer) => { data += chunk.toString() })
          req.on('end', () => resolve(data))
        })

        // Check for existing session
        const sessionId = req.headers['mcp-session-id'] as string | undefined

        if (sessionId && transports.has(sessionId)) {
          // Existing session
          const transport = transports.get(sessionId)!
          // Simulate the request handling
          req.body = body
          await transport.handleRequest(req, res, body)
        } else {
          // New session - create transport
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => `sunnyterm-${Date.now()}`,
            onsessioninitialized: (sid) => {
              transports.set(sid, transport)
            }
          })

          transport.onclose = () => {
            const sid = [...transports.entries()].find(([, t]) => t === transport)?.[0]
            if (sid) transports.delete(sid)
          }

          await server.connect(transport)
          await transport.handleRequest(req, res, body)
        }
      } else if (req.method === 'GET') {
        // SSE stream for notifications
        const sessionId = req.headers['mcp-session-id'] as string | undefined
        if (sessionId && transports.has(sessionId)) {
          const transport = transports.get(sessionId)!
          await transport.handleRequest(req, res)
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No session' }))
        }
      } else if (req.method === 'DELETE') {
        const sessionId = req.headers['mcp-session-id'] as string | undefined
        if (sessionId && transports.has(sessionId)) {
          const transport = transports.get(sessionId)!
          await transport.handleRequest(req, res)
          transports.delete(sessionId)
        } else {
          res.writeHead(404)
          res.end()
        }
      } else {
        res.writeHead(405)
        res.end()
      }
    } else {
      // Health check / info
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        name: 'SunnyTerm MCP Server',
        version: '0.5.2',
        endpoint: '/mcp',
        tools: server.getRegisteredTools?.() ?? 'available'
      }))
    }
  })

  httpServer.listen(MCP_PORT, '127.0.0.1', () => {
    console.log(`[MCP] SunnyTerm MCP server running on http://127.0.0.1:${MCP_PORT}/mcp`)
  })

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[MCP] Port ${MCP_PORT} already in use, MCP server disabled`)
    } else {
      console.error('[MCP] Server error:', err)
    }
  })
}
