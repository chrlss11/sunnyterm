import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../store'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DockerContainer {
  ID: string
  Names: string
  Image: string
  Status: string
  State: string
  Ports: string
  CreatedAt?: string
}

interface Props {
  tileId: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 10_000

const STATUS_BORDER: Record<string, string> = {
  running: '#22c55e',    // green
  exited: '#ef4444',     // red
  restarting: '#eab308', // yellow
  paused: '#f97316',     // orange
  created: '#6b7280',    // gray
  dead: '#ef4444',       // red
}

function getStatusColor(state: string): string {
  return STATUS_BORDER[state.toLowerCase()] ?? '#6b7280'
}

function truncateImage(image: string, maxLen = 30): string {
  if (image.length <= maxLen) return image
  return image.slice(0, maxLen - 3) + '...'
}

// ─── DockerTile ─────────────────────────────────────────────────────────────

export function DockerTile({ tileId }: Props) {
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [logsModal, setLogsModal] = useState<{ name: string; logs: string } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { spawnTile } = useStore()

  const fetchContainers = useCallback(async () => {
    try {
      const result = await window.electronAPI.dockerList()
      if (result.ok && result.containers) {
        setContainers(result.containers)
        setError(null)
      } else {
        setContainers([])
        setError(result.error ?? 'Docker not available')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchContainers()
    intervalRef.current = setInterval(fetchContainers, REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchContainers])

  const handleContainerClick = useCallback((containerName: string) => {
    const name = containerName.replace(/^\//, '')
    const newTile = spawnTile('terminal')
    // Write docker exec command after a short delay so the PTY is ready
    setTimeout(() => {
      window.electronAPI.ptyWrite(newTile.id, `docker exec -it ${name} bash\n`)
    }, 600)
  }, [spawnTile])

  const handleContainerRightClick = useCallback(async (e: React.MouseEvent, containerId: string, containerName: string) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const result = await window.electronAPI.dockerLogs(containerId)
      if (result.ok && result.logs != null) {
        setLogsModal({ name: containerName, logs: result.logs })
      } else {
        setLogsModal({ name: containerName, logs: result.error ?? 'Failed to fetch logs' })
      }
    } catch (err) {
      setLogsModal({ name: containerName, logs: (err as Error).message })
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        Loading Docker containers...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted opacity-40">
          <rect x="1" y="8" width="4" height="3" rx="0.5" />
          <rect x="6" y="8" width="4" height="3" rx="0.5" />
          <rect x="11" y="8" width="4" height="3" rx="0.5" />
          <rect x="6" y="4" width="4" height="3" rx="0.5" />
          <rect x="11" y="4" width="4" height="3" rx="0.5" />
          <path d="M20 12.5c1.5-1 2.5-2 3-4-2-.5-4 0-5 1-1.5-.5-3-1-5-1H2c0 4 2 7 5.5 8.5C9 18 11 18.5 13 18.5c3 0 5.5-1.5 7-6z" />
        </svg>
        <p className="text-text-muted text-xs">Docker not available</p>
        <p className="text-text-muted/50 text-[10px] max-w-xs">{error}</p>
        <button
          className="mt-1 px-3 py-1 text-xs bg-white/10 hover:bg-white/20 text-text-secondary rounded transition-colors"
          onClick={fetchContainers}
        >
          Retry
        </button>
      </div>
    )
  }

  if (containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted opacity-40">
          <rect x="1" y="8" width="4" height="3" rx="0.5" />
          <rect x="6" y="8" width="4" height="3" rx="0.5" />
          <rect x="11" y="8" width="4" height="3" rx="0.5" />
          <rect x="6" y="4" width="4" height="3" rx="0.5" />
          <rect x="11" y="4" width="4" height="3" rx="0.5" />
          <path d="M20 12.5c1.5-1 2.5-2 3-4-2-.5-4 0-5 1-1.5-.5-3-1-5-1H2c0 4 2 7 5.5 8.5C9 18 11 18.5 13 18.5c3 0 5.5-1.5 7-6z" />
        </svg>
        <p className="text-text-muted text-xs">No containers found</p>
        <button
          className="mt-1 px-3 py-1 text-xs bg-white/10 hover:bg-white/20 text-text-secondary rounded transition-colors"
          onClick={fetchContainers}
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0 border-b border-border">
        <span className="text-[10px] text-text-muted">
          {containers.length} container{containers.length !== 1 ? 's' : ''}
        </span>
        <button
          className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-secondary transition-colors"
          onClick={fetchContainers}
        >
          Refresh
        </button>
      </div>

      {/* Container grid */}
      <div className="flex-1 overflow-auto p-2" style={{ scrollbarWidth: 'thin' }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {containers.map((c) => {
            const state = (c.State || '').toLowerCase()
            const borderColor = getStatusColor(state)
            const name = (c.Names || '').replace(/^\//, '')
            const isRunning = state === 'running'

            return (
              <div
                key={c.ID}
                className="rounded-lg p-2.5 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'var(--surface)',
                  border: `1.5px solid ${borderColor}40`,
                  borderLeftWidth: 3,
                  borderLeftColor: borderColor,
                }}
                onClick={() => isRunning && handleContainerClick(name)}
                onContextMenu={(e) => handleContainerRightClick(e, c.ID, name)}
                title={isRunning ? `Click to exec into ${name}` : `${name} is ${state}`}
              >
                {/* Container name */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: borderColor }}
                  />
                  <span className="text-xs font-medium text-text-primary truncate">
                    {name}
                  </span>
                </div>

                {/* Image */}
                <div className="text-[10px] text-text-muted font-mono truncate mb-1">
                  {truncateImage(c.Image)}
                </div>

                {/* Status */}
                <div className="text-[10px] text-text-muted truncate mb-1">
                  {c.Status}
                </div>

                {/* Ports */}
                {c.Ports && (
                  <div className="text-[10px] text-text-muted/60 font-mono truncate">
                    {c.Ports}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Logs modal */}
      {logsModal && (
        <div
          className="absolute inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setLogsModal(null)}
        >
          <div
            className="w-[90%] h-[85%] bg-tile border border-border rounded-lg flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
              <span className="text-xs font-medium text-text-primary">
                Logs: {logsModal.name}
              </span>
              <button
                className="text-text-muted hover:text-text-primary text-sm"
                onClick={() => setLogsModal(null)}
              >
                x
              </button>
            </div>
            <pre
              className="flex-1 overflow-auto p-3 text-[11px] font-mono text-text-secondary whitespace-pre-wrap"
              style={{ scrollbarWidth: 'thin' }}
            >
              {logsModal.logs}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
