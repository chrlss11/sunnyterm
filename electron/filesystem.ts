import { readdir, readFile, stat, lstat } from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

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

const MAX_DIR_ENTRIES = 500
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

export async function readDirectory(dirPath: string): Promise<FsEntry[]> {
  let entries
  try {
    entries = await readdir(dirPath, { withFileTypes: true })
  } catch (err: any) {
    // Return empty array with a permission error indicator
    // The renderer will show a message
    throw new Error(err.code === 'EPERM' || err.code === 'EACCES'
      ? `Permission denied: ${dirPath}`
      : err.message)
  }
  const results: FsEntry[] = []

  for (const entry of entries) {
    if (results.length >= MAX_DIR_ENTRIES) break

    const fullPath = path.join(dirPath, entry.name)
    try {
      const isSymlink = entry.isSymbolicLink()
      const st = await stat(fullPath).catch(() => null)
      if (!st) continue

      results.push({
        name: entry.name,
        path: fullPath,
        isDirectory: st.isDirectory(),
        isSymlink,
        size: st.size,
        modifiedMs: st.mtimeMs
      })
    } catch {
      // Skip entries we can't stat (permission errors, broken symlinks)
    }
  }

  // Sort: directories first, then hidden files last, then alphabetical
  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    const aHidden = a.name.startsWith('.')
    const bHidden = b.name.startsWith('.')
    if (aHidden !== bHidden) return aHidden ? 1 : -1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  return results
}

export async function readFileContent(filePath: string, maxBytes?: number): Promise<FsFileResult> {
  try {
    const st = await stat(filePath)
    const limit = maxBytes ?? MAX_FILE_SIZE

    if (st.size > limit) {
      return { ok: false, size: st.size, error: `File too large (${(st.size / 1024 / 1024).toFixed(1)}MB)` }
    }

    const buffer = await readFile(filePath)

    // Detect binary: check first 8KB for null bytes
    const checkLen = Math.min(buffer.length, 8192)
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0) {
        return { ok: true, isBinary: true, size: st.size }
      }
    }

    return {
      ok: true,
      content: buffer.toString('utf-8'),
      size: st.size,
      isBinary: false
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export function getHomeDir(): string {
  return os.homedir()
}
