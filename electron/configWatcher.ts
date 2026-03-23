import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { BrowserWindow } from 'electron'

const CONFIG_DIR = path.join(os.homedir(), '.sunnyterm-electron')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

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

const DEFAULT_CONFIG: SunnyTermConfig = {
  fontFamily: '"Google Sans Mono", "Cascadia Code", Menlo, Monaco, Consolas, monospace',
  fontSize: 13,
  lineHeight: 1.0,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10000,
  gridSnap: 12,
  defaultTileWidth: 640,
  defaultTileHeight: 396,
  confirmOnQuit: true,
  autoSaveInterval: 2000,
}

let currentConfig: SunnyTermConfig = { ...DEFAULT_CONFIG }
let watcher: fs.FSWatcher | null = null

export function loadConfig(): SunnyTermConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      // Create default config file
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8')
      return { ...DEFAULT_CONFIG }
    }
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
    currentConfig = { ...DEFAULT_CONFIG, ...data }
    return currentConfig
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function getConfig(): SunnyTermConfig {
  return currentConfig
}

export function saveConfig(partial: Partial<SunnyTermConfig>): void {
  try {
    const merged = { ...currentConfig, ...partial }
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8')
    currentConfig = merged
  } catch {
    // Silently fail
  }
}

export function startConfigWatcher(win: BrowserWindow): void {
  if (watcher) watcher.close()

  try {
    if (!fs.existsSync(CONFIG_FILE)) return

    watcher = fs.watch(CONFIG_FILE, { persistent: false }, (eventType) => {
      if (eventType === 'change') {
        try {
          const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
          const data = JSON.parse(raw)
          const newConfig = { ...DEFAULT_CONFIG, ...data }
          const changed: Partial<SunnyTermConfig> = {}

          for (const key of Object.keys(newConfig) as (keyof SunnyTermConfig)[]) {
            if (newConfig[key] !== currentConfig[key]) {
              (changed as any)[key] = newConfig[key]
            }
          }

          if (Object.keys(changed).length > 0) {
            currentConfig = newConfig
            if (win && !win.isDestroyed()) {
              win.webContents.send('config:changed', changed)
            }
          }
        } catch {
          // Invalid JSON or read error — ignore
        }
      }
    })
  } catch {
    // Watch failed — ignore
  }
}

export function stopConfigWatcher(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
