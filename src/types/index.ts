// ─── Tile kinds ───────────────────────────────────────────────────────────────

export type TileKind = 'terminal' | 'http' | 'postgres' | 'browser' | 'file' | 'lens' | 'chart' | 'docker' | 'inspector'

// ─── Section (Figma-style grouping) ──────────────────────────────────────────

export interface Section {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
}

// ─── Canvas tile ──────────────────────────────────────────────────────────────

export interface Tile {
  id: string
  x: number
  y: number
  w: number
  h: number
  name: string
  kind: TileKind
  userRenamed: boolean
  outputLink: string | null  // tile id this tile pipes output to
  zIndex: number
  fontSize?: number     // per-tile font size (terminal only, default 13)
  initialUrl?: string  // for browser tiles: URL to load on first mount
  initialPath?: string // for file tiles: directory to open
  shell?: string       // for terminal tiles: specific shell path override
  chartData?: string   // for chart tiles: raw data string to parse and visualize
}

// Tile snapshot for undo/redo
export type TileSnapshot = Tile

// ─── Undo/redo ────────────────────────────────────────────────────────────────

export type CanvasAction =
  | { type: 'move'; id: string; from: { x: number; y: number }; to: { x: number; y: number } }
  | { type: 'resize'; id: string; from: { w: number; h: number }; to: { w: number; h: number } }
  | { type: 'create'; snapshot: TileSnapshot }
  | { type: 'delete'; snapshot: TileSnapshot }
  | { type: 'rename'; id: string; oldName: string; newName: string }

// ─── Canvas drag state ────────────────────────────────────────────────────────

export type DragKind = 'move' | 'resize'

export interface DragState {
  tileId: string
  kind: DragKind
  startMouseX: number
  startMouseY: number
  startTileX: number
  startTileY: number
  startTileW: number
  startTileH: number
  /** Starting positions of all selected tiles (for group move) */
  groupStarts?: Record<string, { x: number; y: number }>
}

// ─── Snapping ─────────────────────────────────────────────────────────────────

export interface SnapResult {
  x: number
  y: number
}

// ─── Workspace ────────────────────────────────────────────────────────────────

export interface WorkspaceLayout {
  name: string
  tiles: TileSnapshot[]
  sections?: Section[]
  canvasZoom: number
  canvasPanX: number
  canvasPanY: number
  /** CWD per terminal tile id */
  tileCwds?: Record<string, string>
  savedAt?: string
}

// ─── App state (persisted) ────────────────────────────────────────────────────

export type ViewMode = 'canvas' | 'focus'

export interface PersistedAppState {
  isDark: boolean
  theme?: string
  lastWorkspace: string | null
  viewMode?: ViewMode
  windowBounds?: { x: number; y: number; width: number; height: number }
  defaultShell?: string
}

// ─── ElectronAPI (window.electronAPI injected by preload) ─────────────────────

export interface ElectronAPI {
  // PTY
  ptySpawn: (id: string, shell: string, cols: number, rows: number, cwd?: string) => Promise<number>
  ptyHas: (id: string) => Promise<boolean>
  ptyReattach: (id: string) => Promise<boolean>
  ptyWrite: (id: string, data: string) => Promise<void>
  ptyResize: (id: string, cols: number, rows: number) => Promise<void>
  ptyKill: (id: string) => Promise<void>
  ptyGetCwd: (id: string) => Promise<string | null>
  onPtyData: (id: string, callback: (data: string) => void) => () => void
  onPtyExit: (id: string, callback: (code: number) => void) => () => void

  // Menu actions from main process
  onMenuAction: (callback: (action: string) => void) => () => void

  // URL open requests (link clicks in terminals/webviews)
  onOpenUrl: (callback: (url: string) => void) => () => void

  // Open URL in user's default browser
  openExternal: (url: string) => Promise<void>

  // Workspaces
  workspaceList: () => Promise<string[]>
  workspaceSave: (name: string, layout: WorkspaceLayout) => Promise<void>
  workspaceLoad: (name: string) => Promise<WorkspaceLayout | null>
  workspaceDelete: (name: string) => Promise<void>

  // App state
  appStateLoad: () => Promise<PersistedAppState | null>
  appStateSave: (state: Partial<PersistedAppState>) => Promise<void>

  // HTTP requests (proxied through main to avoid CORS)
  httpRequest: (opts: {
    method: string
    url: string
    headers: Record<string, string>
    body: string | null
  }) => Promise<HttpResponse>

  // PostgreSQL
  pgConnect: (id: string, connectionString: string) => Promise<{ ok: boolean; error?: string }>
  pgDisconnect: (id: string) => Promise<void>
  pgQuery: (id: string, sql: string) => Promise<PgQueryResult>

  // Command history
  historyLoad: () => Promise<string[]>
  historySave: (commands: string[]) => Promise<void>

  // Completions
  completePath: (tileId: string, partial: string) => Promise<CompletionItemResult[]>
  completeGit: (tileId: string, type: 'branch' | 'remote' | 'tag', partial: string) => Promise<CompletionItemResult[]>
  completeCommand: (tokens: string[]) => Promise<CompletionItemResult[]>
  completeCommandGhost: (buffer: string) => Promise<string | null>

  // Filesystem
  fsReadDir: (dirPath: string) => Promise<FsEntry[]>
  fsReadFile: (filePath: string, maxBytes?: number) => Promise<FsFileResult>
  fsGetHome: () => Promise<string>
  fsPickFolder: () => Promise<string | null>

  // Shell management
  shellsList: () => Promise<ShellInfo[]>
  shellsGetDefault: () => Promise<string>
  shellsSetDefault: (shellPath: string) => Promise<void>

  // Platform info
  getPlatform: () => Promise<string>

  // Docker
  dockerList: () => Promise<{ ok: boolean; containers?: any[]; error?: string }>
  dockerLogs: (containerId: string) => Promise<{ ok: boolean; logs?: string; error?: string }>

  // Kubernetes
  k8sContexts: () => Promise<K8sContextsResult>
  k8sCurrentContext: () => Promise<K8sCurrentContextResult>
  k8sNamespaces: () => Promise<K8sNamespacesResult>
  k8sDeployments: (namespace: string) => Promise<K8sDeploymentsResult>
  k8sPods: (namespace: string, labelSelector?: string) => Promise<K8sPodsResult>
  k8sLogs: (namespace: string, podName: string, lines?: number) => Promise<K8sLogsResult>
  k8sDeploymentLogs: (namespace: string, deploymentName: string, lines?: number) => Promise<K8sLogsResult>

  // Auto-updater
  updaterDownload: () => Promise<void>
  updaterInstall: () => Promise<void>
  updaterCheck: () => Promise<string | null>
  onUpdaterAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => () => void
  onUpdaterProgress: (callback: (progress: { percent: number }) => void) => () => void
  onUpdaterReady: (callback: () => void) => () => void

  // MCP Bridge
  onMcpMessage: (channel: string, callback: (...args: any[]) => void) => () => void
  mcpRespond: (channel: string, data: unknown) => void

  // Quick Terminal
  quickTerminalToggle: () => Promise<void>

  // Config hot-reload
  configLoad: () => Promise<SunnyTermConfig>
  configSave: (partial: Partial<SunnyTermConfig>) => Promise<void>
  onConfigChanged: (callback: (changed: Partial<SunnyTermConfig>) => void) => () => void
}

// ─── Config types ─────────────────────────────────────────────────────────────

export interface SunnyTermConfig {
  // Terminal
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  cursorStyle?: 'block' | 'underline' | 'bar'
  cursorBlink?: boolean
  scrollback?: number

  // Canvas
  gridSnap?: number
  defaultTileWidth?: number
  defaultTileHeight?: number

  // Behavior
  confirmOnQuit?: boolean
  autoSaveInterval?: number
}

// ─── Shell types ─────────────────────────────────────────────────────────────

export interface ShellInfo {
  id: string
  name: string
  path: string
  icon: string
}

// ─── Completion types ────────────────────────────────────────────────────────

export interface CompletionItemResult {
  value: string
  label: string
  kind: 'file' | 'directory' | 'branch' | 'remote' | 'tag' | 'command' | 'subcommand' | 'flag'
  description?: string
}

// ─── Filesystem types ────────────────────────────────────────────────────────

export interface FsEntry {
  name: string
  path: string
  isDirectory: boolean
  isSymlink: boolean
  size: number
  modifiedMs: number
}

export interface FsFileResult {
  ok: boolean
  content?: string
  size?: number
  isBinary?: boolean
  error?: string
}

// ─── HTTP types ───────────────────────────────────────────────────────────────

export interface HttpResponse {
  ok: boolean
  status?: number
  statusText?: string
  headers?: Record<string, string>
  body?: string
  elapsed?: number
  error?: string
}

export interface HttpRequestEntry {
  method: string
  url: string
  headers: { key: string; value: string }[]
  body: string
  timestamp: number
  response?: HttpResponse
}

// ─── PostgreSQL types ─────────────────────────────────────────────────────────

export interface PgQueryResult {
  ok: boolean
  fields?: string[]
  rows?: Record<string, unknown>[]
  rowCount?: number | null
  elapsed?: number
  error?: string
}

// ─── Kubernetes types ─────────────────────────────────────────────────────────

export interface K8sContextsResult {
  ok: boolean
  contexts?: string[]
  error?: string
}

export interface K8sCurrentContextResult {
  ok: boolean
  context?: string
  error?: string
}

export interface K8sNamespacesResult {
  ok: boolean
  namespaces?: string[]
  error?: string
}

export interface K8sDeployment {
  name: string
  replicas: number
  ready: number
  available: number
  image: string
  labels: Record<string, string>
}

export interface K8sDeploymentsResult {
  ok: boolean
  deployments?: K8sDeployment[]
  error?: string
}

export interface K8sPod {
  name: string
  status: string
  ready: string
  restarts: number
  age: string
  labels: Record<string, string>
  nodeName: string
}

export interface K8sPodsResult {
  ok: boolean
  pods?: K8sPod[]
  error?: string
}

export interface K8sLogsResult {
  ok: boolean
  logs?: string
  error?: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
