/**
 * Minimal input interceptor — passes ALL input directly to PTY.
 * Only tracks the current line buffer for command history.
 * No completions, no ghost text, no key interception.
 */
import type { Terminal } from '@xterm/xterm'

export interface InterceptorCallbacks {
  ptyWrite: (data: string) => void
  onCommandExecuted: (command: string) => void
  getSuggestion: (prefix: string) => string | null
  renderGhostText: (text: string | null) => void
  requestCompletions: (buffer: string) => void
  dismissCompletions: () => void
}

const ENTER = '\r'
const CTRL_C = '\x03'
const CTRL_D = '\x04'
const CTRL_U = '\x15'
const CTRL_L = '\x0c'
const ALT_SCREEN_ON = '\x1b[?1049h'
const ALT_SCREEN_OFF = '\x1b[?1049l'

export class InputInterceptor {
  private buffer = ''
  private isRawMode = false

  constructor(
    private terminal: Terminal,
    private cb: InterceptorCallbacks
  ) {}

  /** Handle user input — pass everything directly to PTY */
  handleInput(data: string): void {
    // Always forward to PTY immediately
    this.cb.ptyWrite(data)

    // Track buffer for command history only
    if (this.isRawMode) return

    if (data === ENTER) {
      const cmd = this.buffer
      this.buffer = ''
      if (cmd.trim()) this.cb.onCommandExecuted(cmd)
    } else if (data === CTRL_C || data === CTRL_D || data === CTRL_U || data === CTRL_L) {
      this.buffer = ''
    } else if (data === '\x7f') {
      // Backspace
      this.buffer = this.buffer.slice(0, -1)
    } else if (!data.startsWith('\x1b')) {
      // Regular printable input
      this.buffer += data
    }
  }

  /** Handle output from PTY to detect raw mode transitions */
  handleOutput(data: string): void {
    if (data.includes(ALT_SCREEN_ON)) {
      this.isRawMode = true
      this.buffer = ''
    } else if (data.includes(ALT_SCREEN_OFF)) {
      this.isRawMode = false
      this.buffer = ''
    }
  }

  /** Insert a completion into the buffer and PTY */
  insertCompletion(text: string): void {
    this.cb.ptyWrite(text)
    this.buffer += text
  }

  /** Get the current input buffer */
  getBuffer(): string {
    return this.buffer
  }

  dispose(): void {}
}
