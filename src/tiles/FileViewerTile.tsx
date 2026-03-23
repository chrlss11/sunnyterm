import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { Folder, FolderOpen as FolderOpenIcon, File, FileText, ChevronRight, ChevronDown, AlertCircle, FolderSearch, Terminal } from 'lucide-react'
import { highlightCode, getLanguageFromFilename } from '../lib/syntaxHighlight'
import type { ThemeName } from '../lib/themes'
import type { FsEntry, FsFileResult } from '../types'

// ── Persistent state registry (survives view switches) ───────────────────────

interface FileViewerState {
  currentDir: string
  expandedDirs: Set<string>
  dirContents: Map<string, FsEntry[]>
  selectedFile: string | null
  fileContent: FsFileResult | null
  highlightedHtml: string
  sidebarWidth: number
}

const stateRegistry = new Map<string, FileViewerState>()

interface Props {
  tileId: string
}

export function FileViewerTile({ tileId }: Props) {
  const tile = useStore((s) => s.tiles.find((t) => t.id === tileId))
  const theme = useStore((s) => s.theme) as ThemeName
  const { spawnTile } = useStore()

  // Restore persisted state or use defaults
  const saved = stateRegistry.get(tileId)
  const [currentDir, setCurrentDir] = useState<string>(saved?.currentDir ?? '')
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(saved?.expandedDirs ?? new Set())
  const [dirContents, setDirContents] = useState<Map<string, FsEntry[]>>(saved?.dirContents ?? new Map())
  const [selectedFile, setSelectedFile] = useState<string | null>(saved?.selectedFile ?? null)
  const [fileContent, setFileContent] = useState<FsFileResult | null>(saved?.fileContent ?? null)
  const [highlightedHtml, setHighlightedHtml] = useState<string>(saved?.highlightedHtml ?? '')
  const [loading, setLoading] = useState(false)
  const [dirError, setDirError] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(saved?.sidebarWidth ?? 220)
  const [editingPath, setEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState('')
  const pathInputRef = useRef<HTMLInputElement>(null)
  const resizing = useRef(false)

  // Keep a ref with latest state for the unmount cleanup
  const stateRef = useRef<FileViewerState>({ currentDir, expandedDirs, dirContents, selectedFile, fileContent, highlightedHtml, sidebarWidth })
  stateRef.current = { currentDir, expandedDirs, dirContents, selectedFile, fileContent, highlightedHtml, sidebarWidth }

  // Save state to registry on unmount only
  useEffect(() => {
    return () => {
      const tileStillExists = useStore.getState().tiles.some((t) => t.id === tileId)
      if (tileStillExists) {
        stateRegistry.set(tileId, stateRef.current)
      } else {
        stateRegistry.delete(tileId)
      }
    }
  }, [tileId])

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; dirPath: string } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null)
    }
    // Capture phase so it fires even when stopPropagation is used
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [ctxMenu])

  // Init: load initial directory (skip if restoring from registry)
  useEffect(() => {
    if (currentDir) return // already have state from registry
    const init = async () => {
      const dir = tile?.initialPath || await window.electronAPI.fsGetHome()
      await navigateToDir(dir)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to a directory
  const navigateToDir = useCallback(async (dirPath: string) => {
    try {
      const entries = await window.electronAPI.fsReadDir(dirPath)
      setCurrentDir(dirPath)
      setDirContents((prev) => new Map(prev).set(dirPath, entries))
      setExpandedDirs(new Set([dirPath]))
      setSelectedFile(null)
      setFileContent(null)
      setHighlightedHtml('')
      setDirError(null)
    } catch (err: any) {
      setDirError(err?.message || 'Cannot access this directory')
    }
  }, [])

  // Toggle directory expand/collapse
  const toggleDir = useCallback(async (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
      }
      return next
    })

    if (!dirContents.has(dirPath)) {
      try {
        const entries = await window.electronAPI.fsReadDir(dirPath)
        setDirContents((prev) => new Map(prev).set(dirPath, entries))
      } catch {
        // Can't read this dir — collapse it back
        setExpandedDirs((prev) => {
          const next = new Set(prev)
          next.delete(dirPath)
          return next
        })
      }
    }
  }, [dirContents])

  // Open file
  const openFile = useCallback(async (filePath: string) => {
    setSelectedFile(filePath)
    setLoading(true)
    setHighlightedHtml('')

    const result = await window.electronAPI.fsReadFile(filePath)
    setFileContent(result)

    if (result.ok && result.content && !result.isBinary) {
      const lang = getLanguageFromFilename(filePath)
      const html = await highlightCode(result.content, lang, theme)
      setHighlightedHtml(html)
    }
    setLoading(false)
  }, [theme])

  // Re-highlight when theme changes
  useEffect(() => {
    if (fileContent?.ok && fileContent.content && !fileContent.isBinary && selectedFile) {
      const lang = getLanguageFromFilename(selectedFile)
      highlightCode(fileContent.content, lang, theme).then(setHighlightedHtml)
    }
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  // Path input handlers
  const startEditingPath = useCallback(() => {
    setPathInput(currentDir)
    setEditingPath(true)
    setTimeout(() => {
      pathInputRef.current?.focus()
      pathInputRef.current?.select()
    }, 0)
  }, [currentDir])

  const commitPath = useCallback(() => {
    setEditingPath(false)
    const trimmed = pathInput.trim()
    if (trimmed && trimmed !== currentDir) {
      navigateToDir(trimmed)
    }
  }, [pathInput, currentDir, navigateToDir])

  // Open folder picker (Finder dialog)
  const openFolderPicker = useCallback(async () => {
    const result = await window.electronAPI.fsPickFolder()
    if (result) {
      navigateToDir(result)
    }
  }, [navigateToDir])

  // Open terminal at directory
  const openTerminalAt = useCallback((dirPath: string) => {
    setCtxMenu(null)
    const t = tile
    const jitter = () => Math.round((Math.random() - 0.5) * 60)
    const newTile = t
      ? spawnTile('terminal', t.x + t.w + 30 + jitter(), t.y + jitter())
      : spawnTile('terminal')
    // Set the CWD for the new terminal tile
    useStore.setState((s) => ({
      tileCwds: { ...s.tileCwds, [newTile.id]: dirPath }
    }))
  }, [tile, spawnTile])

  const rootRef = useRef<HTMLDivElement>(null)

  // Right-click on directory
  const handleDirContextMenu = useCallback((e: React.MouseEvent, dirPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    // Use nativeEvent offset relative to the clicked element, then add its position in the root
    const target = e.currentTarget as HTMLElement
    const root = rootRef.current
    if (!root) return
    const rootRect = root.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    // Scale factor: canvas zoom causes getBoundingClientRect to be scaled
    const scaleX = root.offsetWidth / rootRect.width
    const scaleY = root.offsetHeight / rootRect.height
    const x = (targetRect.left - rootRect.left) * scaleX + (e.clientX - targetRect.left) * scaleX
    const y = (targetRect.top - rootRect.top) * scaleY + (e.clientY - targetRect.top) * scaleY
    setCtxMenu({ x, y, dirPath })
  }, [])

  // Sidebar resize
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    resizing.current = true
    const startX = e.clientX
    const startW = sidebarWidth

    const onMove = (e: PointerEvent) => {
      if (!resizing.current) return
      setSidebarWidth(Math.max(140, Math.min(500, startW + delta(startX, e.clientX))))
    }
    const onUp = () => {
      resizing.current = false
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [sidebarWidth])

  // Breadcrumb segments
  const breadcrumbs = currentDir.split('/').filter(Boolean)

  return (
    <div
      ref={rootRef}
      className="w-full h-full flex flex-col overflow-hidden text-xs relative"
      onMouseDown={(e) => { if (e.button !== 1) e.stopPropagation() }}
      onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation() }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Path bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border shrink-0">
        {editingPath ? (
          <input
            ref={pathInputRef}
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onBlur={commitPath}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitPath()
              if (e.key === 'Escape') setEditingPath(false)
            }}
            className="flex-1 bg-transparent outline-none text-xs text-text-primary font-mono px-1 py-0.5 border border-border rounded"
            spellCheck={false}
          />
        ) : (
          <div
            className="flex-1 flex items-center gap-1 overflow-x-auto cursor-pointer min-w-0"
            onClick={startEditingPath}
            title="Click to edit path"
          >
            <span className="text-text-muted hover:text-text-primary shrink-0">/</span>
            {breadcrumbs.map((seg, i) => {
              const path = '/' + breadcrumbs.slice(0, i + 1).join('/')
              const isLast = i === breadcrumbs.length - 1
              return (
                <React.Fragment key={path}>
                  <ChevronRight size={10} className="text-text-muted shrink-0" />
                  <span
                    className={`shrink-0 ${isLast ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
                    onClick={(e) => {
                      if (!isLast) {
                        e.stopPropagation()
                        navigateToDir(path)
                      }
                    }}
                  >
                    {seg}
                  </span>
                </React.Fragment>
              )
            })}
          </div>
        )}

        <button
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/8 text-text-muted hover:text-text-primary transition-colors shrink-0"
          onClick={openFolderPicker}
          title="Open folder..."
        >
          <FolderSearch size={14} />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* File tree sidebar */}
        <div
          className="shrink-0 overflow-y-auto overflow-x-hidden border-r border-border"
          style={{ width: sidebarWidth }}
        >
          <div className="py-1">
            {dirError && (
              <div className="flex items-center gap-2 px-3 py-2 text-red-400">
                <AlertCircle size={12} className="shrink-0" />
                <span className="break-all">{dirError}</span>
              </div>
            )}
            {currentDir && expandedDirs.has(currentDir) && (
              <TreeNodes
                entries={dirContents.get(currentDir) || []}
                expandedDirs={expandedDirs}
                dirContents={dirContents}
                selectedFile={selectedFile}
                onToggleDir={toggleDir}
                onOpenFile={openFile}
                onDirContextMenu={handleDirContextMenu}
                depth={0}
              />
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-border/50 active:bg-border transition-colors"
          onPointerDown={handleResizeStart}
        />

        {/* File content */}
        <div className="flex-1 min-w-0 overflow-auto">
          {!selectedFile && (
            <div className="flex items-center justify-center h-full text-text-muted">
              Select a file to view
            </div>
          )}

          {selectedFile && loading && (
            <div className="flex items-center justify-center h-full text-text-muted">
              Loading...
            </div>
          )}

          {selectedFile && !loading && fileContent && !fileContent.ok && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
              <AlertCircle size={24} />
              <span>{fileContent.error}</span>
            </div>
          )}

          {selectedFile && !loading && fileContent?.ok && fileContent.isBinary && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
              <File size={24} />
              <span>Binary file ({formatSize(fileContent.size || 0)})</span>
            </div>
          )}

          {selectedFile && !loading && fileContent?.ok && !fileContent.isBinary && highlightedHtml && (
            <div className="flex flex-col h-full">
              {/* File header */}
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
                <LangBadge filename={selectedFile} />
                <span className="text-text-primary font-medium truncate">
                  {selectedFile.split('/').pop()}
                </span>
                <span className="text-text-muted ml-auto shrink-0">
                  {formatSize(fileContent.size || 0)} · {lineCount(fileContent.content || '')} lines
                </span>
              </div>
              {/* Code */}
              <div className="flex-1 overflow-auto">
                <div
                  className="syntax-content text-[12px] leading-[20px] p-3
                    [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0
                    [&_code]:!bg-transparent
                    [&_.shiki]:!bg-transparent
                    [&_pre]:overflow-visible"
                  style={{ fontFamily: '"Google Sans Mono", Menlo, Monaco, monospace' }}
                  dangerouslySetInnerHTML={{ __html: addLineNumbers(highlightedHtml) }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Directory context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="absolute w-44 rounded-lg border border-border bg-tile shadow-xl py-1 z-[99999]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
            onClick={() => openTerminalAt(ctxMenu.dirPath)}
          >
            <Terminal size={12} /> Open Terminal Here
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
            onClick={() => { navigateToDir(ctxMenu.dirPath); setCtxMenu(null) }}
          >
            <FolderOpenIcon size={12} /> Open as Root
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tree node rendering ───────────────────────────────────────────────────────

interface TreeNodesProps {
  entries: FsEntry[]
  expandedDirs: Set<string>
  dirContents: Map<string, FsEntry[]>
  selectedFile: string | null
  onToggleDir: (path: string) => void
  onOpenFile: (path: string) => void
  onDirContextMenu: (e: React.MouseEvent, path: string) => void
  depth: number
}

function TreeNodes({ entries, expandedDirs, dirContents, selectedFile, onToggleDir, onOpenFile, onDirContextMenu, depth }: TreeNodesProps) {
  return (
    <>
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          expandedDirs={expandedDirs}
          dirContents={dirContents}
          selectedFile={selectedFile}
          onToggleDir={onToggleDir}
          onOpenFile={onOpenFile}
          onDirContextMenu={onDirContextMenu}
          depth={depth}
        />
      ))}
    </>
  )
}

interface TreeNodeProps {
  entry: FsEntry
  expandedDirs: Set<string>
  dirContents: Map<string, FsEntry[]>
  selectedFile: string | null
  onToggleDir: (path: string) => void
  onOpenFile: (path: string) => void
  onDirContextMenu: (e: React.MouseEvent, path: string) => void
  depth: number
}

function TreeNode({ entry, expandedDirs, dirContents, selectedFile, onToggleDir, onOpenFile, onDirContextMenu, depth }: TreeNodeProps) {
  const isExpanded = expandedDirs.has(entry.path)
  const isSelected = selectedFile === entry.path
  const indent = depth * 16 + 8

  if (entry.isDirectory) {
    const children = dirContents.get(entry.path) || []
    return (
      <>
        <div
          className="flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/6 transition-colors"
          style={{ paddingLeft: indent }}
          onClick={() => onToggleDir(entry.path)}
          onContextMenu={(e) => onDirContextMenu(e, entry.path)}
        >
          {isExpanded ? (
            <ChevronDown size={12} className="text-text-muted shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-text-muted shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpenIcon size={13} className="text-yellow-500 shrink-0" />
          ) : (
            <Folder size={13} className="text-yellow-500 shrink-0" />
          )}
          <span className="text-text-secondary truncate">{entry.name}</span>
        </div>
        {isExpanded && children.length > 0 && (
          <TreeNodes
            entries={children}
            expandedDirs={expandedDirs}
            dirContents={dirContents}
            selectedFile={selectedFile}
            onToggleDir={onToggleDir}
            onOpenFile={onOpenFile}
            onDirContextMenu={onDirContextMenu}
            depth={depth + 1}
          />
        )}
      </>
    )
  }

  return (
    <div
      className={`flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-500/15 text-text-primary'
          : 'hover:bg-black/5 dark:hover:bg-white/6 text-text-secondary'
      }`}
      style={{ paddingLeft: indent + 16 }}
      onClick={() => onOpenFile(entry.path)}
    >
      <FileIcon filename={entry.name} />
      <span className="truncate">{entry.name}</span>
    </div>
  )
}

// ── File icon by extension ────────────────────────────────────────────────────

const EXT_COLORS: Record<string, string> = {
  ts: 'text-blue-400', tsx: 'text-blue-400',
  js: 'text-yellow-400', jsx: 'text-yellow-400',
  json: 'text-yellow-500',
  py: 'text-green-400',
  rb: 'text-red-400',
  rs: 'text-orange-400',
  go: 'text-cyan-400',
  java: 'text-red-500',
  css: 'text-pink-400', scss: 'text-pink-400',
  html: 'text-orange-500', htm: 'text-orange-500',
  md: 'text-text-secondary', mdx: 'text-text-secondary',
  vue: 'text-green-500', svelte: 'text-orange-500',
  swift: 'text-orange-400', kt: 'text-purple-400',
  yaml: 'text-red-300', yml: 'text-red-300',
  sh: 'text-green-300', bash: 'text-green-300',
  sql: 'text-blue-300',
  toml: 'text-gray-400',
  xml: 'text-orange-300', svg: 'text-yellow-300'
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const color = EXT_COLORS[ext]
  if (color) return <FileText size={13} className={`${color} shrink-0`} />
  return <File size={13} className="text-text-muted shrink-0" />
}

// ── Language badge ───────────────────────────────────────────────────────────

const EXT_LABELS: Record<string, { label: string; color: string }> = {
  ts: { label: 'TS', color: 'bg-blue-500/20 text-blue-400' },
  tsx: { label: 'TSX', color: 'bg-blue-500/20 text-blue-400' },
  js: { label: 'JS', color: 'bg-yellow-500/20 text-yellow-400' },
  jsx: { label: 'JSX', color: 'bg-yellow-500/20 text-yellow-400' },
  json: { label: 'JSON', color: 'bg-yellow-600/20 text-yellow-500' },
  py: { label: 'Python', color: 'bg-green-500/20 text-green-400' },
  rb: { label: 'Ruby', color: 'bg-red-500/20 text-red-400' },
  rs: { label: 'Rust', color: 'bg-orange-500/20 text-orange-400' },
  go: { label: 'Go', color: 'bg-cyan-500/20 text-cyan-400' },
  java: { label: 'Java', color: 'bg-red-600/20 text-red-400' },
  css: { label: 'CSS', color: 'bg-pink-500/20 text-pink-400' },
  scss: { label: 'SCSS', color: 'bg-pink-500/20 text-pink-400' },
  html: { label: 'HTML', color: 'bg-orange-500/20 text-orange-400' },
  md: { label: 'MD', color: 'bg-gray-500/20 text-gray-400' },
  yaml: { label: 'YAML', color: 'bg-red-400/20 text-red-300' },
  yml: { label: 'YAML', color: 'bg-red-400/20 text-red-300' },
  sh: { label: 'Shell', color: 'bg-green-500/20 text-green-300' },
  bash: { label: 'Bash', color: 'bg-green-500/20 text-green-300' },
  sql: { label: 'SQL', color: 'bg-blue-400/20 text-blue-300' },
  vue: { label: 'Vue', color: 'bg-green-600/20 text-green-500' },
  svelte: { label: 'Svelte', color: 'bg-orange-500/20 text-orange-400' },
  swift: { label: 'Swift', color: 'bg-orange-500/20 text-orange-400' },
  kt: { label: 'Kotlin', color: 'bg-purple-500/20 text-purple-400' },
  toml: { label: 'TOML', color: 'bg-gray-500/20 text-gray-400' },
  xml: { label: 'XML', color: 'bg-orange-400/20 text-orange-300' },
  svg: { label: 'SVG', color: 'bg-yellow-400/20 text-yellow-300' },
}

function LangBadge({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const info = EXT_LABELS[ext]
  if (!info) return null
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${info.color} shrink-0`}>
      {info.label}
    </span>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function lineCount(content: string): number {
  if (!content) return 0
  return content.split('\n').length
}

/** Wrap shiki output lines with line numbers */
function addLineNumbers(html: string): string {
  // Shiki outputs <pre><code>...</code></pre>
  // We inject line number spans into each line
  return html.replace(
    /(<code[^>]*>)([\s\S]*?)(<\/code>)/,
    (_, openCode, content, closeCode) => {
      const lines = content.split('\n')
      // Remove trailing empty line
      if (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()

      const numbered = lines.map((line: string, i: number) => {
        const num = i + 1
        return `<span style="display:inline-block;width:3em;text-align:right;padding-right:1em;color:rgba(128,128,128,0.4);user-select:none;font-size:11px;">${num}</span>${line}`
      }).join('\n')

      return `${openCode}${numbered}${closeCode}`
    }
  )
}

function delta(start: number, current: number): number {
  return current - start
}
