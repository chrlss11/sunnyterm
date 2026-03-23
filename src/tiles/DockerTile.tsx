import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../store'
import type { K8sDeployment, K8sPod } from '../types'

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

type ContainerTab = 'docker' | 'kubernetes'

// ─── Constants ───────────────────────────────────────────────────────────────

const DOCKER_REFRESH_MS = 10_000
const K8S_REFRESH_MS = 15_000

const STATUS_BORDER: Record<string, string> = {
  running: '#22c55e',
  exited: '#ef4444',
  restarting: '#eab308',
  paused: '#f97316',
  created: '#6b7280',
  dead: '#ef4444',
}

const POD_STATUS_COLOR: Record<string, string> = {
  running: '#22c55e',
  succeeded: '#22c55e',
  pending: '#eab308',
  failed: '#ef4444',
  unknown: '#6b7280',
  crashloopbackoff: '#ef4444',
  error: '#ef4444',
  imagepullbackoff: '#ef4444',
  containercreating: '#eab308',
  terminating: '#f97316',
}

function getStatusColor(state: string): string {
  return STATUS_BORDER[state.toLowerCase()] ?? '#6b7280'
}

function getPodStatusColor(status: string): string {
  return POD_STATUS_COLOR[status.toLowerCase()] ?? '#6b7280'
}

function truncateImage(image: string, maxLen = 30): string {
  if (image.length <= maxLen) return image
  return image.slice(0, maxLen - 3) + '...'
}

function formatAge(timestamp: string): string {
  if (!timestamp) return '-'
  const diff = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function labelsToSelector(labels: Record<string, string>): string {
  return Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(',')
}

// ─── DockerTab ──────────────────────────────────────────────────────────────

function DockerTab({ spawnTile }: { spawnTile: (kind: 'terminal') => { id: string } }) {
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [logsModal, setLogsModal] = useState<{ name: string; logs: string } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  useEffect(() => {
    fetchContainers()
    intervalRef.current = setInterval(fetchContainers, DOCKER_REFRESH_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchContainers])

  const handleContainerClick = useCallback((containerName: string) => {
    const name = containerName.replace(/^\//, '')
    const newTile = spawnTile('terminal')
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
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: borderColor }}
                  />
                  <span className="text-xs font-medium text-text-primary truncate">
                    {name}
                  </span>
                </div>
                <div className="text-[10px] text-text-muted font-mono truncate mb-1">
                  {truncateImage(c.Image)}
                </div>
                <div className="text-[10px] text-text-muted truncate mb-1">
                  {c.Status}
                </div>
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

// ─── KubernetesTab ──────────────────────────────────────────────────────────

function KubernetesTab({ spawnTile }: { spawnTile: (kind: 'terminal') => { id: string } }) {
  const [contexts, setContexts] = useState<string[]>([])
  const [currentContext, setCurrentContext] = useState<string>('')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [selectedNamespace, setSelectedNamespace] = useState('default')
  const [deployments, setDeployments] = useState<K8sDeployment[]>([])
  const [pods, setPods] = useState<K8sPod[]>([])
  const [expandedDeployment, setExpandedDeployment] = useState<string | null>(null)
  const [deploymentPods, setDeploymentPods] = useState<K8sPod[]>([])
  const [logsModal, setLogsModal] = useState<{ name: string; logs: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logsEndRef = useRef<HTMLPreElement>(null)

  // Fetch contexts and current context
  const fetchContexts = useCallback(async () => {
    try {
      const [ctxResult, curResult] = await Promise.all([
        window.electronAPI.k8sContexts(),
        window.electronAPI.k8sCurrentContext(),
      ])
      if (ctxResult.ok && ctxResult.contexts) {
        setContexts(ctxResult.contexts)
      }
      if (curResult.ok && curResult.context) {
        setCurrentContext(curResult.context)
      }
      if (!ctxResult.ok) {
        setError(ctxResult.error ?? 'kubectl not available')
        setLoading(false)
        return false
      }
      return true
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
      return false
    }
  }, [])

  // Fetch namespaces
  const fetchNamespaces = useCallback(async () => {
    try {
      const result = await window.electronAPI.k8sNamespaces()
      if (result.ok && result.namespaces) {
        setNamespaces(result.namespaces)
        // If selected namespace is not in the list, reset to default
        if (!result.namespaces.includes(selectedNamespace)) {
          setSelectedNamespace(result.namespaces.includes('default') ? 'default' : result.namespaces[0] || 'default')
        }
      }
    } catch {
      // silently fail, namespaces dropdown will be empty
    }
  }, [selectedNamespace])

  // Fetch deployments and pods for selected namespace
  const fetchResources = useCallback(async () => {
    try {
      const [depResult, podResult] = await Promise.all([
        window.electronAPI.k8sDeployments(selectedNamespace),
        window.electronAPI.k8sPods(selectedNamespace),
      ])
      if (depResult.ok && depResult.deployments) {
        setDeployments(depResult.deployments)
      }
      if (podResult.ok && podResult.pods) {
        setPods(podResult.pods)
      }
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [selectedNamespace])

  // Initial load
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ok = await fetchContexts()
      if (!cancelled && ok) {
        await fetchNamespaces()
        await fetchResources()
      }
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh on namespace change
  useEffect(() => {
    if (!loading) {
      fetchResources()
    }
  }, [selectedNamespace]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchResources()
    }, K8S_REFRESH_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchResources])

  // Fetch pods for expanded deployment
  useEffect(() => {
    if (!expandedDeployment) {
      setDeploymentPods([])
      return
    }
    const dep = deployments.find(d => d.name === expandedDeployment)
    if (!dep || !dep.labels || Object.keys(dep.labels).length === 0) {
      setDeploymentPods([])
      return
    }
    const selector = labelsToSelector(dep.labels)
    window.electronAPI.k8sPods(selectedNamespace, selector).then(result => {
      if (result.ok && result.pods) {
        setDeploymentPods(result.pods)
      }
    })
  }, [expandedDeployment, deployments, selectedNamespace])

  // Scroll logs to bottom
  useEffect(() => {
    if (logsModal && logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight
    }
  }, [logsModal])

  const handlePodClick = useCallback((podName: string) => {
    const newTile = spawnTile('terminal')
    setTimeout(() => {
      window.electronAPI.ptyWrite(newTile.id, `kubectl exec -it ${podName} -n ${selectedNamespace} -- bash\n`)
    }, 600)
  }, [spawnTile, selectedNamespace])

  const handlePodLogs = useCallback(async (e: React.MouseEvent, podName: string) => {
    e.stopPropagation()
    try {
      const result = await window.electronAPI.k8sLogs(selectedNamespace, podName)
      if (result.ok && result.logs != null) {
        setLogsModal({ name: podName, logs: result.logs })
      } else {
        setLogsModal({ name: podName, logs: result.error ?? 'Failed to fetch logs' })
      }
    } catch (err) {
      setLogsModal({ name: podName, logs: (err as Error).message })
    }
  }, [selectedNamespace])

  const handleDeploymentLogs = useCallback(async (e: React.MouseEvent, deploymentName: string) => {
    e.stopPropagation()
    try {
      const result = await window.electronAPI.k8sDeploymentLogs(selectedNamespace, deploymentName)
      if (result.ok && result.logs != null) {
        setLogsModal({ name: `deployment/${deploymentName}`, logs: result.logs })
      } else {
        setLogsModal({ name: `deployment/${deploymentName}`, logs: result.error ?? 'Failed to fetch logs' })
      }
    } catch (err) {
      setLogsModal({ name: `deployment/${deploymentName}`, logs: (err as Error).message })
    }
  }, [selectedNamespace])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        Loading Kubernetes resources...
      </div>
    )
  }

  if (error && contexts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted opacity-40">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <p className="text-text-muted text-xs">kubectl not available</p>
        <p className="text-text-muted/50 text-[10px] max-w-xs">{error}</p>
        <button
          className="mt-1 px-3 py-1 text-xs bg-white/10 hover:bg-white/20 text-text-secondary rounded transition-colors"
          onClick={() => { setLoading(true); fetchContexts().then(ok => { if (ok) { fetchNamespaces(); fetchResources(); } }) }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar: context + namespace selectors */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-b border-border flex-wrap">
        {/* Context */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">Context:</span>
          <select
            className="text-[10px] bg-white/5 border border-border rounded px-1.5 py-0.5 text-text-primary outline-none"
            value={currentContext}
            onChange={(e) => setCurrentContext(e.target.value)}
            style={{ maxWidth: 160 }}
          >
            {contexts.map(ctx => (
              <option key={ctx} value={ctx}>{ctx}</option>
            ))}
          </select>
        </div>

        {/* Namespace */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">Namespace:</span>
          <select
            className="text-[10px] bg-white/5 border border-border rounded px-1.5 py-0.5 text-text-primary outline-none"
            value={selectedNamespace}
            onChange={(e) => setSelectedNamespace(e.target.value)}
            style={{ maxWidth: 160 }}
          >
            {namespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </div>

        {/* Refresh button */}
        <button
          className="ml-auto text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-secondary transition-colors"
          onClick={fetchResources}
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2" style={{ scrollbarWidth: 'thin' }}>
        {/* Deployments section */}
        {deployments.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 px-1">
              Deployments ({deployments.length})
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {deployments.map((dep) => {
                const isHealthy = dep.ready === dep.replicas && dep.replicas > 0
                const borderColor = isHealthy ? '#22c55e' : dep.ready > 0 ? '#eab308' : '#ef4444'
                const isExpanded = expandedDeployment === dep.name

                return (
                  <div key={dep.name}>
                    <div
                      className="rounded-lg p-2.5 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: 'var(--surface)',
                        border: `1.5px solid ${borderColor}40`,
                        borderLeftWidth: 3,
                        borderLeftColor: borderColor,
                      }}
                      onClick={() => setExpandedDeployment(isExpanded ? null : dep.name)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-text-primary truncate">{dep.name}</span>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${borderColor}20`,
                            color: borderColor,
                          }}
                        >
                          {dep.ready}/{dep.replicas}
                        </span>
                      </div>
                      <div className="text-[10px] text-text-muted font-mono truncate mb-1">
                        {truncateImage(dep.image, 40)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-text-muted hover:text-text-secondary transition-colors"
                          onClick={(e) => handleDeploymentLogs(e, dep.name)}
                        >
                          View All Logs
                        </button>
                        <span className="text-[9px] text-text-muted/50">
                          {isExpanded ? 'Click to collapse' : 'Click to expand pods'}
                        </span>
                      </div>
                    </div>

                    {/* Expanded: show deployment's pods */}
                    {isExpanded && deploymentPods.length > 0 && (
                      <div className="mt-1 ml-3 flex flex-col gap-1">
                        {deploymentPods.map(pod => (
                          <PodCard
                            key={pod.name}
                            pod={pod}
                            onClick={() => handlePodClick(pod.name)}
                            onLogsClick={(e) => handlePodLogs(e, pod.name)}
                          />
                        ))}
                      </div>
                    )}
                    {isExpanded && deploymentPods.length === 0 && (
                      <div className="mt-1 ml-3 text-[10px] text-text-muted/50 py-1">
                        No pods found for this deployment
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pods section */}
        {pods.length > 0 && (
          <div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 px-1">
              All Pods ({pods.length})
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {pods.map((pod) => (
                <PodCard
                  key={pod.name}
                  pod={pod}
                  onClick={() => handlePodClick(pod.name)}
                  onLogsClick={(e) => handlePodLogs(e, pod.name)}
                />
              ))}
            </div>
          </div>
        )}

        {deployments.length === 0 && pods.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
            <p className="text-text-muted text-xs">No resources found in namespace "{selectedNamespace}"</p>
          </div>
        )}
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
              ref={logsEndRef}
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

// ─── PodCard ────────────────────────────────────────────────────────────────

function PodCard({ pod, onClick, onLogsClick }: {
  pod: K8sPod
  onClick: () => void
  onLogsClick: (e: React.MouseEvent) => void
}) {
  const statusColor = getPodStatusColor(pod.status)
  const isRunning = pod.status.toLowerCase() === 'running'

  return (
    <div
      className="rounded-lg p-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: 'var(--surface)',
        border: `1.5px solid ${statusColor}40`,
        borderLeftWidth: 3,
        borderLeftColor: statusColor,
      }}
      onClick={isRunning ? onClick : undefined}
      title={isRunning ? `Click to exec into ${pod.name}` : `${pod.name} is ${pod.status}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: statusColor }}
        />
        <span className="text-[11px] font-medium text-text-primary truncate flex-1">
          {pod.name}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-text-muted">
        <span
          className="px-1 py-0.5 rounded text-[9px] font-medium"
          style={{
            backgroundColor: `${statusColor}20`,
            color: statusColor,
          }}
        >
          {pod.status}
        </span>
        <span>Ready: {pod.ready}</span>
        {pod.restarts > 0 && (
          <span className="text-amber-400">Restarts: {pod.restarts}</span>
        )}
        <span>{formatAge(pod.age)}</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <button
          className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-text-muted hover:text-text-secondary transition-colors"
          onClick={onLogsClick}
        >
          Logs
        </button>
        {pod.nodeName && (
          <span className="text-[9px] text-text-muted/40 ml-auto truncate" title={pod.nodeName}>
            {pod.nodeName}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── DockerTile (Container Tile) ────────────────────────────────────────────

export function DockerTile({ tileId }: Props) {
  const [activeTab, setActiveTab] = useState<ContainerTab>('docker')
  const { spawnTile } = useStore()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-border" style={{ background: 'var(--titlebar)' }}>
        <button
          className={`px-4 py-1.5 text-xs font-medium transition-colors relative ${
            activeTab === 'docker'
              ? 'text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          onClick={() => setActiveTab('docker')}
        >
          Docker
          {activeTab === 'docker' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-400 rounded-t" />
          )}
        </button>
        <button
          className={`px-4 py-1.5 text-xs font-medium transition-colors relative ${
            activeTab === 'kubernetes'
              ? 'text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          onClick={() => setActiveTab('kubernetes')}
        >
          Kubernetes
          {activeTab === 'kubernetes' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-400 rounded-t" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'docker' ? (
          <DockerTab spawnTile={spawnTile} />
        ) : (
          <KubernetesTab spawnTile={spawnTile} />
        )}
      </div>
    </div>
  )
}
