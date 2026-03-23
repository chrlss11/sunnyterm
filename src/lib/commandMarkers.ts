import type { Terminal } from '@xterm/xterm'

// Track command boundaries per terminal tile via OSC 133 sequences

export interface CommandEntry {
  promptLine: number       // line where prompt started
  commandStartLine: number // line where command execution started
  commandEndLine: number   // line where command ended
  exitCode: number
  timestamp: number
}

const commandEntries = new Map<string, CommandEntry[]>()

export function registerCommandParser(tileId: string, terminal: Terminal) {
  const entries: CommandEntry[] = []
  commandEntries.set(tileId, entries)

  let currentPromptLine = -1
  let currentCommandStartLine = -1

  // Register OSC 133 handler
  terminal.parser.registerOscHandler(133, (data: string) => {
    const bufferLine = terminal.buffer.active.cursorY + terminal.buffer.active.baseY

    if (data === 'A') {
      // Prompt start
      currentPromptLine = bufferLine
    } else if (data === 'C') {
      // Command execution start
      currentCommandStartLine = bufferLine
    } else if (data.startsWith('D;')) {
      // Command end with exit code
      const exitCode = parseInt(data.substring(2), 10) || 0
      if (currentPromptLine >= 0) {
        entries.push({
          promptLine: currentPromptLine,
          commandStartLine: currentCommandStartLine >= 0 ? currentCommandStartLine : currentPromptLine,
          commandEndLine: bufferLine,
          exitCode,
          timestamp: Date.now()
        })
      }
      currentPromptLine = -1
      currentCommandStartLine = -1
    }
    return false // don't prevent default handling
  })
}

export function getCommands(tileId: string): CommandEntry[] {
  return commandEntries.get(tileId) ?? []
}

export function getLastCommand(tileId: string): CommandEntry | null {
  const entries = commandEntries.get(tileId) ?? []
  return entries.length > 0 ? entries[entries.length - 1] : null
}

export function clearCommands(tileId: string) {
  commandEntries.delete(tileId)
}

/**
 * Find the previous prompt line relative to the current viewport position.
 * Returns the buffer line number to scroll to, or -1 if none found.
 */
export function findPreviousPrompt(tileId: string, currentLine: number): number {
  const entries = commandEntries.get(tileId) ?? []
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].promptLine < currentLine) {
      return entries[i].promptLine
    }
  }
  return -1
}

/**
 * Find the next prompt line relative to the current viewport position.
 * Returns the buffer line number to scroll to, or -1 if none found.
 */
export function findNextPrompt(tileId: string, currentLine: number): number {
  const entries = commandEntries.get(tileId) ?? []
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].promptLine > currentLine) {
      return entries[i].promptLine
    }
  }
  return -1
}
