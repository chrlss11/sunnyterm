import { contextBridge, ipcRenderer } from 'electron'

// Expose a typed API surface to the renderer process via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // PTY operations
  ptySpawn: (id: string, shell: string, cols: number, rows: number, cwd?: string) =>
    ipcRenderer.invoke('pty:spawn', id, shell, cols, rows, cwd),

  ptyHas: (id: string) =>
    ipcRenderer.invoke('pty:has', id),

  ptyReattach: (id: string) =>
    ipcRenderer.invoke('pty:reattach', id),

  ptyWrite: (id: string, data: string) =>
    ipcRenderer.invoke('pty:write', id, data),

  ptyResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('pty:resize', id, cols, rows),

  ptyKill: (id: string) =>
    ipcRenderer.invoke('pty:kill', id),

  ptyGetCwd: (id: string) =>
    ipcRenderer.invoke('pty:getCwd', id),

  // Subscribe to PTY output for a specific tile id
  onPtyData: (id: string, callback: (data: string) => void) => {
    const channel = `pty:data:${id}`
    const handler = (_event: Electron.IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on(channel, handler)
    // Return cleanup function
    return () => ipcRenderer.removeListener(channel, handler)
  },

  // Subscribe to PTY exit for a specific tile id
  onPtyExit: (id: string, callback: (code: number) => void) => {
    const channel = `pty:exit:${id}`
    const handler = (_event: Electron.IpcRendererEvent, code: number) => callback(code)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  // Subscribe to menu actions sent from main process
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
    ipcRenderer.on('menu:action', handler)
    return () => ipcRenderer.removeListener('menu:action', handler)
  },

  // Subscribe to URL open requests (from link clicks in terminals/webviews)
  onOpenUrl: (callback: (url: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, url: string) => callback(url)
    ipcRenderer.on('open-url', handler)
    return () => ipcRenderer.removeListener('open-url', handler)
  },

  // Workspace operations
  workspaceList: () =>
    ipcRenderer.invoke('workspace:list'),

  workspaceSave: (name: string, layout: unknown) =>
    ipcRenderer.invoke('workspace:save', name, layout),

  workspaceLoad: (name: string) =>
    ipcRenderer.invoke('workspace:load', name),

  workspaceDelete: (name: string) =>
    ipcRenderer.invoke('workspace:delete', name),

  // App state (dark mode, last workspace, window bounds)
  appStateLoad: () =>
    ipcRenderer.invoke('appState:load'),

  appStateSave: (state: unknown) =>
    ipcRenderer.invoke('appState:save', state),

  // HTTP requests (via main process to avoid CORS)
  httpRequest: (opts: { method: string; url: string; headers: Record<string, string>; body: string | null }) =>
    ipcRenderer.invoke('http:request', opts),

  // Open URL in user's default browser
  openExternal: (url: string) =>
    ipcRenderer.invoke('shell:openExternal', url),

  // PostgreSQL operations (via main process using pg)
  pgConnect: (id: string, connectionString: string) =>
    ipcRenderer.invoke('pg:connect', id, connectionString),

  pgDisconnect: (id: string) =>
    ipcRenderer.invoke('pg:disconnect', id),

  pgQuery: (id: string, sql: string) =>
    ipcRenderer.invoke('pg:query', id, sql),

  // Command history
  historyLoad: () =>
    ipcRenderer.invoke('history:load'),

  historySave: (commands: string[]) =>
    ipcRenderer.invoke('history:save', commands),

  // Completions (path & git)
  completePath: (tileId: string, partial: string) =>
    ipcRenderer.invoke('completion:path', tileId, partial),

  completeGit: (tileId: string, type: 'branch' | 'remote' | 'tag', partial: string) =>
    ipcRenderer.invoke('completion:git', tileId, type, partial),

  completeCommand: (tokens: string[]) =>
    ipcRenderer.invoke('completion:command', tokens),

  completeCommandGhost: (buffer: string) =>
    ipcRenderer.invoke('completion:commandGhost', buffer),

  // Filesystem operations
  fsReadDir: (dirPath: string) =>
    ipcRenderer.invoke('fs:readDir', dirPath),

  fsReadFile: (filePath: string, maxBytes?: number) =>
    ipcRenderer.invoke('fs:readFile', filePath, maxBytes),

  fsGetHome: () =>
    ipcRenderer.invoke('fs:getHome'),

  fsPickFolder: () =>
    ipcRenderer.invoke('fs:pickFolder'),

  // Shell management
  shellsList: () =>
    ipcRenderer.invoke('shells:list'),

  shellsGetDefault: () =>
    ipcRenderer.invoke('shells:getDefault'),

  shellsSetDefault: (shellPath: string) =>
    ipcRenderer.invoke('shells:setDefault', shellPath),

  // Platform info
  getPlatform: () =>
    ipcRenderer.invoke('platform'),

  // Docker operations
  dockerList: () =>
    ipcRenderer.invoke('docker:list'),

  dockerLogs: (containerId: string) =>
    ipcRenderer.invoke('docker:logs', containerId),

  // Kubernetes operations
  k8sContexts: () =>
    ipcRenderer.invoke('k8s:contexts'),

  k8sCurrentContext: () =>
    ipcRenderer.invoke('k8s:currentContext'),

  k8sNamespaces: () =>
    ipcRenderer.invoke('k8s:namespaces'),

  k8sDeployments: (namespace: string) =>
    ipcRenderer.invoke('k8s:deployments', namespace),

  k8sPods: (namespace: string, labelSelector?: string) =>
    ipcRenderer.invoke('k8s:pods', namespace, labelSelector),

  k8sLogs: (namespace: string, podName: string, lines?: number) =>
    ipcRenderer.invoke('k8s:logs', namespace, podName, lines),

  k8sDeploymentLogs: (namespace: string, deploymentName: string, lines?: number) =>
    ipcRenderer.invoke('k8s:deploymentLogs', namespace, deploymentName, lines),

  // Auto-updater
  updaterDownload: () =>
    ipcRenderer.invoke('updater:download'),

  updaterInstall: () =>
    ipcRenderer.invoke('updater:install'),

  updaterCheck: () =>
    ipcRenderer.invoke('updater:check'),

  onUpdaterAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: any) => callback(info)
    ipcRenderer.on('updater:available', handler)
    return () => ipcRenderer.removeListener('updater:available', handler)
  },

  onUpdaterProgress: (callback: (progress: { percent: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: any) => callback(progress)
    ipcRenderer.on('updater:progress', handler)
    return () => ipcRenderer.removeListener('updater:progress', handler)
  },

  onUpdaterReady: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('updater:ready', handler)
    return () => ipcRenderer.removeListener('updater:ready', handler)
  },

  // MCP Bridge — listen for IPC from main process MCP server
  onMcpMessage: (channel: string, callback: (...args: any[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  mcpRespond: (channel: string, data: unknown) => {
    ipcRenderer.send(channel, data)
  }
})
