/**
 * Module-level registry mapping tileId → terminal state.
 * Keeps xterm instances alive across React unmount/remount (view switches).
 * Used by SearchBar for search and by TerminalTile for persistence.
 */
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { SearchAddon } from '@xterm/addon-search'

export interface TerminalEntry {
  searchAddon: SearchAddon
  terminal: Terminal
  fitAddon: FitAddon
  /** The wrapper div that xterm rendered into (term.open(element)) */
  element: HTMLDivElement
  /** Cleanup function for PTY data subscription */
  cleanupPty: (() => void) | null
  /** Cleanup function for PTY exit subscription */
  cleanupExit: (() => void) | null
  /** Whether the PTY process has exited */
  isExited: boolean
  /** Exit code if exited */
  exitCode: number | null
  /** Saved CWD for restart */
  savedCwd: string | undefined
  /** Current outputLink ref value */
  outputLink: string | null
}

const registry = new Map<string, TerminalEntry>()

export function registerTerminal(id: string, entry: TerminalEntry): void {
  registry.set(id, entry)
}

export function unregisterTerminal(id: string): void {
  registry.delete(id)
}

export function getTerminalEntry(id: string): TerminalEntry | undefined {
  return registry.get(id)
}

export function getAllEntries(): Array<[string, TerminalEntry]> {
  return [...registry.entries()]
}
