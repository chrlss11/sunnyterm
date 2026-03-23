/**
 * Config Bridge — handles config hot-reload in the renderer process.
 * Loads initial config and listens for changes from the file watcher.
 * Applies terminal-related config changes to all xterm.js instances.
 */

import { getAllEntries } from './terminalRegistry'
import { toast } from 'sonner'
import type { SunnyTermConfig } from '../types'

let cleanupListener: (() => void) | null = null

function applyTerminalConfig(changed: Partial<SunnyTermConfig>): void {
  const entries = getAllEntries()
  for (const [, entry] of entries) {
    if (changed.fontFamily !== undefined) entry.terminal.options.fontFamily = changed.fontFamily
    if (changed.fontSize !== undefined) entry.terminal.options.fontSize = changed.fontSize
    if (changed.lineHeight !== undefined) entry.terminal.options.lineHeight = changed.lineHeight
    if (changed.cursorStyle !== undefined) entry.terminal.options.cursorStyle = changed.cursorStyle
    if (changed.cursorBlink !== undefined) entry.terminal.options.cursorBlink = changed.cursorBlink
    if (changed.scrollback !== undefined) entry.terminal.options.scrollback = changed.scrollback

    // Refit after font changes
    if (changed.fontFamily !== undefined || changed.fontSize !== undefined || changed.lineHeight !== undefined) {
      try { entry.fitAddon.fit() } catch { /* ignore */ }
    }
  }
}

/**
 * Initialize config bridge. Call once on app startup.
 */
export function initConfigBridge(): void {
  // Load initial config (no-op for now, terminals use their own defaults;
  // we'll apply on first change)
  window.electronAPI.configLoad().catch(() => {})

  // Listen for config changes from the file watcher
  cleanupListener = window.electronAPI.onConfigChanged((changed: Partial<SunnyTermConfig>) => {
    applyTerminalConfig(changed)

    // Show toast with changed keys
    const keys = Object.keys(changed)
    if (keys.length > 0) {
      toast.success(`Config reloaded: ${keys.join(', ')} changed`, {
        duration: 3000,
      })
    }
  })
}

/**
 * Cleanup config bridge listeners.
 */
export function destroyConfigBridge(): void {
  if (cleanupListener) {
    cleanupListener()
    cleanupListener = null
  }
}
