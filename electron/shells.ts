/**
 * Shell detection — finds available shells on the system.
 * Supports macOS, Windows, and Linux.
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export interface ShellInfo {
  /** Unique identifier (e.g., 'powershell', 'bash', 'git-bash') */
  id: string
  /** Display name */
  name: string
  /** Full path to the shell executable */
  path: string
  /** Optional icon hint for the UI */
  icon: string
}

/** Detect available shells on the current system */
export function detectShells(): ShellInfo[] {
  if (process.platform === 'win32') return detectWindowsShells()
  if (process.platform === 'darwin') return detectMacShells()
  return detectLinuxShells()
}

function detectWindowsShells(): ShellInfo[] {
  const shells: ShellInfo[] = []

  // PowerShell 7+ (pwsh)
  const pwshPaths = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
  ]
  for (const p of pwshPaths) {
    if (fs.existsSync(p)) {
      shells.push({ id: 'pwsh', name: 'PowerShell 7', path: p, icon: 'powershell' })
      break
    }
  }
  // Also check if pwsh is on PATH
  if (!shells.find((s) => s.id === 'pwsh')) {
    try {
      const result = execSync('where pwsh.exe', { timeout: 3000 }).toString().trim().split('\n')[0]
      if (result && fs.existsSync(result.trim())) {
        shells.push({ id: 'pwsh', name: 'PowerShell 7', path: result.trim(), icon: 'powershell' })
      }
    } catch {}
  }

  // Windows PowerShell (5.x, built-in)
  const ps5 = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
  if (fs.existsSync(ps5)) {
    shells.push({ id: 'powershell', name: 'Windows PowerShell', path: ps5, icon: 'powershell' })
  }

  // CMD
  const cmd = 'C:\\Windows\\System32\\cmd.exe'
  if (fs.existsSync(cmd)) {
    shells.push({ id: 'cmd', name: 'Command Prompt', path: cmd, icon: 'cmd' })
  }

  // Git Bash
  const gitBashPaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs\\Git\\bin\\bash.exe'),
  ]
  for (const p of gitBashPaths) {
    if (fs.existsSync(p)) {
      shells.push({ id: 'git-bash', name: 'Git Bash', path: p, icon: 'git' })
      break
    }
  }

  // WSL (if available)
  try {
    const wslResult = execSync('where wsl.exe', { timeout: 3000 }).toString().trim().split('\n')[0]
    if (wslResult && fs.existsSync(wslResult.trim())) {
      shells.push({ id: 'wsl', name: 'WSL', path: wslResult.trim(), icon: 'linux' })
    }
  } catch {}

  // MSYS2
  const msys2Paths = [
    'C:\\msys64\\usr\\bin\\bash.exe',
    'C:\\msys2\\usr\\bin\\bash.exe',
  ]
  for (const p of msys2Paths) {
    if (fs.existsSync(p)) {
      shells.push({ id: 'msys2', name: 'MSYS2 Bash', path: p, icon: 'bash' })
      break
    }
  }

  // Nushell
  try {
    const nuResult = execSync('where nu.exe', { timeout: 3000 }).toString().trim().split('\n')[0]
    if (nuResult && fs.existsSync(nuResult.trim())) {
      shells.push({ id: 'nushell', name: 'Nushell', path: nuResult.trim(), icon: 'nushell' })
    }
  } catch {}

  return shells
}

function detectMacShells(): ShellInfo[] {
  const shells: ShellInfo[] = []

  // Read /etc/shells for available shells
  try {
    const etcShells = fs.readFileSync('/etc/shells', 'utf8')
    const lines = etcShells.split('\n').filter((l) => l.trim() && !l.startsWith('#'))

    for (const shellPath of lines) {
      const trimmed = shellPath.trim()
      if (!fs.existsSync(trimmed)) continue

      const name = path.basename(trimmed)
      if (name === 'zsh') shells.push({ id: 'zsh', name: 'Zsh', path: trimmed, icon: 'zsh' })
      else if (name === 'bash') shells.push({ id: 'bash', name: 'Bash', path: trimmed, icon: 'bash' })
      else if (name === 'fish') shells.push({ id: 'fish', name: 'Fish', path: trimmed, icon: 'fish' })
      else if (name === 'sh') shells.push({ id: 'sh', name: 'sh', path: trimmed, icon: 'sh' })
    }
  } catch {}

  // Check for common shells not in /etc/shells
  const extras = [
    { id: 'nushell', name: 'Nushell', cmd: 'nu', icon: 'nushell' },
    { id: 'pwsh', name: 'PowerShell', cmd: 'pwsh', icon: 'powershell' },
  ]
  for (const ex of extras) {
    try {
      const result = execSync(`which ${ex.cmd}`, { timeout: 3000 }).toString().trim()
      if (result && fs.existsSync(result)) {
        shells.push({ id: ex.id, name: ex.name, path: result, icon: ex.icon })
      }
    } catch {}
  }

  return shells
}

function detectLinuxShells(): ShellInfo[] {
  // Same as macOS — Linux also uses /etc/shells
  return detectMacShells()
}
