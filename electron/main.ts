import { app, BrowserWindow, ipcMain, shell, Menu, dialog, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { PtyManager } from './pty'
import { WorkspaceManager } from './workspace'
import { startMcpServer } from './mcp'
import { detectShells } from './shells'
import type { WorkspaceLayout, PersistedAppState } from './workspace'
import { Client as PgClient } from 'pg'
import { HistoryManager } from './history'
import { completePath, completeGit } from './completions'
import { readDirectory, readFileContent, getHomeDir } from './filesystem'

let mainWindow: BrowserWindow | null = null
const ptyManager = new PtyManager()
const workspaceManager = new WorkspaceManager()
const historyManager = new HistoryManager()

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'
const mod = isMac ? '⌘' : 'Ctrl+'

function sendMenuAction(action: string): void {
  mainWindow?.webContents.send('menu:action', action)
}

function createMenu(): void {
  const accel = (key: string) => isMac ? `Cmd+${key}` : `Ctrl+${key}`
  const accelShift = (key: string) => isMac ? `Cmd+Shift+${key}` : `Ctrl+Shift+${key}`

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),

    {
      label: 'File',
      submenu: [
        {
          label: `New Terminal\t${mod}T`,
          accelerator: accel('T'),
          click: () => sendMenuAction('new-terminal')
        },
        {
          label: 'New Canvas',
          click: () => sendMenuAction('new-canvas')
        },
        {
          label: `New File Viewer\t${mod}⇧E`,
          accelerator: accelShift('E'),
          click: () => sendMenuAction('new-file-viewer')
        },
        {
          label: `Close Tile\t${mod}W`,
          accelerator: accel('W'),
          click: () => sendMenuAction('close-tile')
        },
        { type: 'separator' as const },
        {
          label: `Save Workspace\t${mod}S`,
          accelerator: accel('S'),
          click: () => sendMenuAction('save-workspace')
        },
        ...(!isMac ? [
          { type: 'separator' as const },
          { role: 'quit' as const }
        ] : [])
      ]
    },

    {
      label: 'Edit',
      submenu: [
        { label: `Undo\t${mod}Z`, click: () => sendMenuAction('undo') },
        { label: `Redo\t${mod}⇧Z`, click: () => sendMenuAction('redo') },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },

    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', click: () => sendMenuAction('zoom-in') },
        { label: 'Zoom Out', click: () => sendMenuAction('zoom-out') },
        { label: `Reset Zoom\t${mod}0`, click: () => sendMenuAction('reset-zoom') },
        { label: 'Fit All Tiles', click: () => sendMenuAction('fit-tiles') },
        { type: 'separator' as const },
        { label: `Toggle Minimap\t${mod}M`, click: () => sendMenuAction('toggle-minimap') },
        { label: `Toggle Dark Mode\t${mod}⇧D`, click: () => sendMenuAction('toggle-dark') },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },

    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'close' as const }
      ]
    },

    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          click: () => sendMenuAction('show-shortcuts')
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow(): void {
  // Restore saved window bounds if available
  const appState = workspaceManager.getAppState()
  const bounds = appState.windowBounds

  // Determine background color from theme
  const bgColors: Record<string, string> = {
    dark: '#111213', light: '#ebedf0', claude: '#1a1510', vino: '#170d14'
  }
  const bgColor = bgColors[appState.theme ?? 'dark'] ?? '#111213'
  const iconExt = isWin ? 'icon.ico' : 'icon.icns'

  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1400,
    height: bounds?.height ?? 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: bgColor,
    icon: join(__dirname, `../../resources/${iconExt}`),
    ...(isMac ? {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 14, y: 14 },
    } : {
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: {
        color: bgColor,
        symbolColor: '#cdd6f4',
        height: 44
      },
    }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    },
    show: false
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // Confirm before closing if there are open tiles
  let forceQuit = false
  mainWindow.on('close', (e) => {
    if (forceQuit) return
    e.preventDefault()
    dialog.showMessageBox(mainWindow!, {
      type: 'question',
      buttons: ['Quit', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Quit SunnyTerm',
      message: 'Are you sure you want to quit?',
      detail: 'All open terminals will be closed.'
    }).then(({ response }) => {
      if (response === 0) {
        forceQuit = true
        ptyManager.killAll()
        mainWindow?.destroy()
      }
    })
  })

  // Save window bounds on move/resize
  const saveBounds = () => {
    if (!mainWindow) return
    const b = mainWindow.getBounds()
    const current = workspaceManager.getAppState()
    workspaceManager.saveAppState({ ...current, windowBounds: b })
  }
  mainWindow.on('moved', saveBounds)
  mainWindow.on('resized', saveBounds)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Send URL to renderer to open in a BrowserTile
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('open-url', url)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── PTY IPC handlers ─────────────────────────────────────────────────────────

ipcMain.handle('pty:spawn', (_event, id: string, shell: string, cols: number, rows: number, cwd?: string) => {
  return ptyManager.spawn(
    id, shell, cols, rows,
    (data) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(`pty:data:${id}`, data) },
    cwd,
    (exitCode) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(`pty:exit:${id}`, exitCode) }
  )
})

ipcMain.handle('pty:has', (_event, id: string) => {
  return ptyManager.has(id)
})

ipcMain.handle('pty:reattach', (_event, id: string) => {
  return ptyManager.reattach(
    id,
    (data) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(`pty:data:${id}`, data) },
    (exitCode) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(`pty:exit:${id}`, exitCode) }
  )
})

ipcMain.handle('pty:write', (_event, id: string, data: string) => {
  ptyManager.write(id, data)
})

ipcMain.handle('pty:resize', (_event, id: string, cols: number, rows: number) => {
  ptyManager.resize(id, cols, rows)
})

ipcMain.handle('pty:kill', (_event, id: string) => {
  ptyManager.kill(id)
})

ipcMain.handle('pty:getCwd', async (_event, id: string) => {
  return ptyManager.getCwd(id)
})

// ─── Workspace IPC handlers ───────────────────────────────────────────────────

ipcMain.handle('workspace:list', () => {
  return workspaceManager.listWorkspaces()
})

ipcMain.handle('workspace:save', (_event, name: string, layout: WorkspaceLayout) => {
  workspaceManager.saveWorkspace(name, layout)
})

ipcMain.handle('workspace:load', (_event, name: string) => {
  return workspaceManager.loadWorkspace(name)
})

ipcMain.handle('workspace:delete', (_event, name: string) => {
  workspaceManager.deleteWorkspace(name)
})

// ─── App state IPC handlers ───────────────────────────────────────────────────

ipcMain.handle('appState:load', () => {
  return workspaceManager.getAppState()
})

ipcMain.handle('appState:save', (_event, state: Partial<PersistedAppState>) => {
  workspaceManager.saveAppState(state)
})

ipcMain.handle('shell:openExternal', (_event, url: string) => {
  shell.openExternal(url)
})

// ─── HTTP IPC handlers ────────────────────────────────────────────────────────

ipcMain.handle('http:request', async (_event, opts: {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
}) => {
  const startMs = Date.now()
  try {
    const res = await fetch(opts.url, {
      method: opts.method,
      headers: opts.headers,
      body: opts.body || undefined
    })
    const elapsed = Date.now() - startMs
    const responseHeaders: Record<string, string> = {}
    res.headers.forEach((v, k) => { responseHeaders[k] = v })
    const text = await res.text()
    return { ok: true, status: res.status, statusText: res.statusText, headers: responseHeaders, body: text, elapsed }
  } catch (err: unknown) {
    const elapsed = Date.now() - startMs
    return { ok: false, error: (err as Error).message, elapsed }
  }
})

// ─── PostgreSQL IPC handlers ──────────────────────────────────────────────────

// Map of connectionId → PgClient
const pgClients = new Map<string, PgClient>()

ipcMain.handle('pg:connect', async (_event, id: string, connectionString: string) => {
  // Kill existing connection if any
  const existing = pgClients.get(id)
  if (existing) {
    try { await existing.end() } catch { /* ignore */ }
    pgClients.delete(id)
  }
  const client = new PgClient({ connectionString })
  try {
    await client.connect()
    pgClients.set(id, client)
    return { ok: true }
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message }
  }
})

ipcMain.handle('pg:disconnect', async (_event, id: string) => {
  const client = pgClients.get(id)
  if (!client) return
  try { await client.end() } catch { /* ignore */ }
  pgClients.delete(id)
})

ipcMain.handle('pg:query', async (_event, id: string, sql: string) => {
  const client = pgClients.get(id)
  if (!client) return { ok: false, error: 'Not connected' }
  const startMs = Date.now()
  try {
    const result = await client.query(sql)
    const elapsed = Date.now() - startMs
    return {
      ok: true,
      fields: result.fields.map((f) => f.name),
      rows: result.rows,
      rowCount: result.rowCount,
      elapsed
    }
  } catch (err: unknown) {
    const elapsed = Date.now() - startMs
    return { ok: false, error: (err as Error).message, elapsed }
  }
})

// ─── Command history IPC handlers ────────────────────────────────────────────

ipcMain.handle('history:load', () => {
  return historyManager.load()
})

ipcMain.handle('history:save', (_event, commands: string[]) => {
  historyManager.save(commands)
})

// ─── Completion IPC handlers ─────────────────────────────────────────────────

ipcMain.handle('completion:path', async (_event, tileId: string, partial: string) => {
  const cwd = ptyManager.getCwd(tileId) || process.env.HOME || '/'
  return completePath(cwd, partial)
})

ipcMain.handle('completion:git', async (_event, tileId: string, type: 'branch' | 'remote' | 'tag', partial: string) => {
  const cwd = ptyManager.getCwd(tileId) || process.env.HOME || '/'
  return completeGit(cwd, type, partial)
})

// ─── Filesystem IPC handlers ─────────────────────────────────────────────────

ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
  return readDirectory(dirPath)
})

ipcMain.handle('fs:readFile', async (_event, filePath: string, maxBytes?: number) => {
  return readFileContent(filePath, maxBytes)
})

ipcMain.handle('fs:getHome', () => {
  return getHomeDir()
})

ipcMain.handle('fs:pickFolder', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Folder'
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// ─── Shell detection ──────────────────────────────────────────────────────────

let cachedShells: ReturnType<typeof detectShells> | null = null

ipcMain.handle('shells:list', () => {
  if (!cachedShells) cachedShells = detectShells()
  return cachedShells
})

ipcMain.handle('shells:getDefault', () => {
  return workspaceManager.getAppState().defaultShell ?? ''
})

ipcMain.handle('shells:setDefault', (_event, shellPath: string) => {
  const current = workspaceManager.getAppState()
  workspaceManager.saveAppState({ ...current, defaultShell: shellPath })
  ptyManager.configuredDefault = shellPath
})

// ─── Docker IPC handlers ──────────────────────────────────────────────────────

ipcMain.handle('docker:list', async () => {
  try {
    const { execSync } = require('child_process')
    const output = execSync('docker ps -a --format "{{json .}}"', { timeout: 5000 }).toString()
    const containers = output.trim().split('\n').filter(Boolean).map((line: string) => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
    return { ok: true, containers }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
})

ipcMain.handle('docker:logs', async (_event, containerId: string) => {
  try {
    const { execSync } = require('child_process')
    const output = execSync(`docker logs --tail 100 ${containerId}`, { timeout: 5000 }).toString()
    return { ok: true, logs: output }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
})

// ─── Platform info ────────────────────────────────────────────────────────────

ipcMain.handle('platform', () => process.platform)

// ─── App lifecycle ─────────────────────────────────────────────────────────────

app.setName('SunnyTerm')

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.sunnyterm')

  // Set dock icon on macOS
  if (isMac) {
    try {
      const iconPath = join(__dirname, '../../resources/icon.icns')
      const icon = nativeImage.createFromPath(iconPath)
      if (!icon.isEmpty()) app.dock.setIcon(icon)
    } catch (err) {
      console.error('Failed to set dock icon:', err)
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Restore default shell from settings
  const savedShell = workspaceManager.getAppState().defaultShell
  if (savedShell) ptyManager.configuredDefault = savedShell

  createWindow()
  createMenu()

  // Start MCP server for Claude Code integration
  startMcpServer(() => mainWindow, ptyManager)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  ptyManager.killAll()
  pgClients.forEach((client) => { try { client.end() } catch { /* ignore */ } })
  pgClients.clear()
  // On macOS, apps typically stay open until explicitly quit
  if (!isMac) app.quit()
})
