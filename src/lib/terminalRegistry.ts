/**
 * Module-level registry mapping tileId → { SearchAddon }
 * Used by SearchBar to call findNext/findPrevious on xterm instances.
 */
import type { SearchAddon } from '@xterm/addon-search'

interface TerminalEntry {
  searchAddon: SearchAddon
}

const registry = new Map<string, TerminalEntry>()

export function registerTerminal(id: string, searchAddon: SearchAddon): void {
  registry.set(id, { searchAddon })
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
