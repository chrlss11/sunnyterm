import Store from 'electron-store'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ─── Shared types (mirrors src/types/index.ts) ────────────────────────────────

export interface TileData {
  id: string
  x: number
  y: number
  w: number
  h: number
  name: string
  kind: string
  userRenamed: boolean
  outputLink: string | null
  zIndex: number
}

export interface WorkspaceLayout {
  name: string
  tiles: TileData[]
  canvasZoom: number
  canvasPanX: number
  canvasPanY: number
  /** CWD per tile id (terminal tiles only) */
  tileCwds?: Record<string, string>
  savedAt?: string
}

export interface PersistedAppState {
  isDark: boolean
  theme?: string
  lastWorkspace: string | null
  windowBounds?: { x: number; y: number; width: number; height: number }
  /** Default shell path (empty = system default) */
  defaultShell?: string
}

// ─── Storage paths ─────────────────────────────────────────────────────────────

const SUNNYTERM_DIR = path.join(os.homedir(), '.sunnyterm-electron')
const WORKSPACES_DIR = path.join(SUNNYTERM_DIR, 'workspaces')

// ─── electron-store schema ────────────────────────────────────────────────────

interface StoreSchema {
  appState: PersistedAppState
}

// ─── WorkspaceManager ────────────────────────────────────────────────────────

export class WorkspaceManager {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'app-state',
      defaults: {
        appState: {
          isDark: true,
          lastWorkspace: null
        }
      }
    })
    fs.mkdirSync(WORKSPACES_DIR, { recursive: true })
  }

  // ── App state (window bounds, dark mode, last workspace) ─────────────────

  getAppState(): PersistedAppState {
    return this.store.get('appState')
  }

  saveAppState(state: Partial<PersistedAppState>): void {
    const current = this.store.get('appState')
    this.store.set('appState', { ...current, ...state })
  }

  // ── Workspace files ───────────────────────────────────────────────────────

  listWorkspaces(): string[] {
    try {
      return fs.readdirSync(WORKSPACES_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5))
        .sort()
    } catch {
      return []
    }
  }

  saveWorkspace(name: string, layout: WorkspaceLayout): void {
    const safeName = sanitizeName(name)
    const filePath = path.join(WORKSPACES_DIR, `${safeName}.json`)
    const data = JSON.stringify(
      { ...layout, name: safeName, savedAt: new Date().toISOString() },
      null,
      2
    )
    fs.writeFileSync(filePath, data, 'utf8')
  }

  loadWorkspace(name: string): WorkspaceLayout | null {
    const safeName = sanitizeName(name)
    const filePath = path.join(WORKSPACES_DIR, `${safeName}.json`)
    try {
      const data = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(data) as WorkspaceLayout
    } catch {
      return null
    }
  }

  deleteWorkspace(name: string): void {
    const safeName = sanitizeName(name)
    const filePath = path.join(WORKSPACES_DIR, `${safeName}.json`)
    try {
      fs.unlinkSync(filePath)
    } catch {}
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, '_')
}
