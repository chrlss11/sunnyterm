import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  Database,
  Table,
  Columns3,
  Eye,
  ChevronRight,
  ChevronDown,
  Save,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  FolderTree
} from 'lucide-react'
import type { PgQueryResult } from '../types'

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface ConnectionConfig {
  name: string
  host: string
  port: string
  database: string
  username: string
  password: string
  ssl: boolean
}

interface QueryHistoryEntry {
  sql: string
  timestamp: number
  ok: boolean
  rowCount?: number | null
  error?: string
}

interface TreeNode {
  type: 'database' | 'schema' | 'table-group' | 'table' | 'view-group' | 'view' | 'column'
  name: string
  schema?: string
  table?: string
  dataType?: string
  isNullable?: string
  children?: TreeNode[]
  expanded?: boolean
  loading?: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ConnStatus, string> = {
  disconnected: 'bg-white/20 text-text-muted',
  connecting: 'bg-yellow-500/40 text-yellow-300',
  connected: 'bg-green-500/40 text-green-300',
  error: 'bg-red-500/40 text-red-300'
}

const STATUS_LABELS: Record<ConnStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error'
}

const MAX_HISTORY = 10
const COL_MAX_CHARS = 40
const LS_KEY = 'sunnyterm-pg-connections'

const DEFAULT_CONN: ConnectionConfig = {
  name: '',
  host: 'localhost',
  port: '5432',
  database: 'postgres',
  username: 'postgres',
  password: '',
  ssl: false
}

function buildConnString(c: ConnectionConfig): string {
  const userPart = c.password
    ? `${encodeURIComponent(c.username)}:${encodeURIComponent(c.password)}`
    : encodeURIComponent(c.username)
  const sslParam = c.ssl ? '?sslmode=require' : ''
  return `postgresql://${userPart}@${c.host}:${c.port}/${c.database}${sslParam}`
}

function loadSavedConnections(): ConnectionConfig[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveConnections(conns: ConnectionConfig[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(conns))
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PostgresTile({ tileId }: { tileId: string }) {
  const [config, setConfig] = useState<ConnectionConfig>({ ...DEFAULT_CONN })
  const [savedConns, setSavedConns] = useState<ConnectionConfig[]>(loadSavedConnections)
  const [status, setStatus] = useState<ConnStatus>('disconnected')
  const [statusMsg, setStatusMsg] = useState('')
  const [showConnForm, setShowConnForm] = useState(true)
  const [sql, setSql] = useState('SELECT version();')
  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [result, setResult] = useState<PgQueryResult | null>(null)
  const [running, setRunning] = useState(false)
  const [tree, setTree] = useState<TreeNode[]>([])
  const [platform, setPlatform] = useState('darwin')
  const sqlRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.electronAPI.getPlatform().then(setPlatform)
  }, [])

  const runMod = platform === 'darwin' ? '⌘' : 'Ctrl'

  // ── Config helpers ─────────────────────────────────────────────────────────
  const updateConfig = (patch: Partial<ConnectionConfig>) =>
    setConfig((prev) => ({ ...prev, ...patch }))

  // ── Connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    const connStr = buildConnString(config)
    if (!connStr.trim()) return
    setStatus('connecting')
    setStatusMsg('')
    const res = await window.electronAPI.pgConnect(tileId, connStr)
    if (res.ok) {
      setStatus('connected')
      setStatusMsg('')
      setShowConnForm(false)
      sqlRef.current?.focus()
      loadTree()
    } else {
      setStatus('error')
      setStatusMsg(res.error ?? 'Connection failed')
    }
  }, [tileId, config])

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    await window.electronAPI.pgDisconnect(tileId)
    setStatus('disconnected')
    setResult(null)
    setTree([])
    setShowConnForm(true)
  }, [tileId])

  useEffect(() => {
    return () => { window.electronAPI.pgDisconnect(tileId) }
  }, [tileId])

  // ── Save / delete connection ───────────────────────────────────────────────
  const saveCurrentConn = () => {
    const name = config.name.trim() || `${config.host}:${config.port}/${config.database}`
    const entry = { ...config, name }
    const existing = savedConns.findIndex((c) => c.name === name)
    let next: ConnectionConfig[]
    if (existing >= 0) {
      next = [...savedConns]
      next[existing] = entry
    } else {
      next = [entry, ...savedConns]
    }
    setSavedConns(next)
    saveConnections(next)
    setConfig(entry)
  }

  const deleteConn = (name: string) => {
    const next = savedConns.filter((c) => c.name !== name)
    setSavedConns(next)
    saveConnections(next)
  }

  const pickConn = (c: ConnectionConfig) => {
    setConfig({ ...c })
  }

  // ── Run query ──────────────────────────────────────────────────────────────
  const runQuery = useCallback(async (overrideSql?: string) => {
    const q = (overrideSql ?? sql).trim()
    if (status !== 'connected' || !q || running) return
    setRunning(true)
    setResult(null)
    const res = await window.electronAPI.pgQuery(tileId, q)
    setResult(res)
    setRunning(false)
    setQueryHistory((prev) =>
      [{ sql: q, timestamp: Date.now(), ok: res.ok, rowCount: res.rowCount, error: res.error }, ...prev].slice(0, MAX_HISTORY)
    )
  }, [tileId, sql, status, running])

  const handleSqlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      runQuery()
    }
  }, [runQuery])

  // ── Tree loading ───────────────────────────────────────────────────────────
  const queryForTree = async (q: string): Promise<PgQueryResult> => {
    return window.electronAPI.pgQuery(tileId, q)
  }

  const loadTree = async () => {
    // Load databases
    const dbRes = await queryForTree(`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;`)
    const dbNodes: TreeNode[] = (dbRes.rows ?? []).map((r) => ({
      type: 'database' as const,
      name: String(r.datname),
      expanded: String(r.datname) === config.database,
      children: String(r.datname) === config.database ? undefined : [] // lazy
    }))

    // Load schemas for current db
    const schemaRes = await queryForTree(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema') ORDER BY schema_name;`
    )
    const currentDbNode = dbNodes.find((n) => n.name === config.database)
    if (currentDbNode && schemaRes.rows) {
      const schemaNodes: TreeNode[] = []
      for (const row of schemaRes.rows) {
        const schemaName = String(row.schema_name)
        const schemaNode: TreeNode = {
          type: 'schema',
          name: schemaName,
          expanded: schemaName === 'public',
          children: []
        }

        // Load tables
        const tablesRes = await queryForTree(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schemaName}' AND table_type = 'BASE TABLE' ORDER BY table_name;`
        )
        const tableGroupNode: TreeNode = {
          type: 'table-group',
          name: 'Tables',
          schema: schemaName,
          expanded: schemaName === 'public',
          children: (tablesRes.rows ?? []).map((t) => ({
            type: 'table' as const,
            name: String(t.table_name),
            schema: schemaName,
            expanded: false,
            children: [] // lazy columns
          }))
        }

        // Load views
        const viewsRes = await queryForTree(
          `SELECT table_name FROM information_schema.views WHERE table_schema = '${schemaName}' ORDER BY table_name;`
        )
        const viewGroupNode: TreeNode = {
          type: 'view-group',
          name: 'Views',
          schema: schemaName,
          expanded: false,
          children: (viewsRes.rows ?? []).map((v) => ({
            type: 'view' as const,
            name: String(v.table_name),
            schema: schemaName,
          }))
        }

        schemaNode.children = [tableGroupNode, viewGroupNode]
        schemaNodes.push(schemaNode)
      }
      currentDbNode.children = schemaNodes
    }

    setTree(dbNodes)
  }

  const loadColumns = async (schemaName: string, tableName: string) => {
    const res = await queryForTree(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = '${schemaName}' AND table_name = '${tableName}' ORDER BY ordinal_position;`
    )
    return (res.rows ?? []).map((r) => ({
      type: 'column' as const,
      name: String(r.column_name),
      dataType: String(r.data_type),
      isNullable: String(r.is_nullable),
    }))
  }

  // ── Tree toggle ────────────────────────────────────────────────────────────
  const toggleNode = async (path: number[]) => {
    setTree((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as TreeNode[]
      let node = next[path[0]]
      for (let i = 1; i < path.length; i++) {
        node = node.children![path[i]]
      }
      node.expanded = !node.expanded
      return next
    })
  }

  const expandTableColumns = async (path: number[], schemaName: string, tableName: string) => {
    // Set loading
    setTree((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as TreeNode[]
      let node = next[path[0]]
      for (let i = 1; i < path.length; i++) node = node.children![path[i]]
      node.loading = true
      node.expanded = true
      return next
    })

    const cols = await loadColumns(schemaName, tableName)

    setTree((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as TreeNode[]
      let node = next[path[0]]
      for (let i = 1; i < path.length; i++) node = node.children![path[i]]
      node.children = cols
      node.loading = false
      return next
    })
  }

  const handleTableClick = (schemaName: string, tableName: string) => {
    const q = `SELECT * FROM ${schemaName}.${tableName} LIMIT 100;`
    setSql(q)
    runQuery(q)
  }

  const handleDatabaseClick = async (dbName: string) => {
    if (dbName === config.database) return
    await disconnect()
    const newConfig = { ...config, database: dbName }
    setConfig(newConfig)
    // Reconnect to new db
    setStatus('connecting')
    setStatusMsg('')
    const connStr = buildConnString(newConfig)
    const res = await window.electronAPI.pgConnect(tileId, connStr)
    if (res.ok) {
      setStatus('connected')
      setStatusMsg('')
      setShowConnForm(false)
      // Reload tree for new db
      // We need to use the newConfig for the tree load
      const dbRes = await queryForTree(`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;`)
      const dbNodes: TreeNode[] = (dbRes.rows ?? []).map((r) => ({
        type: 'database' as const,
        name: String(r.datname),
        expanded: String(r.datname) === dbName,
        children: String(r.datname) === dbName ? undefined : []
      }))
      const schemaRes = await queryForTree(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema') ORDER BY schema_name;`
      )
      const currentDbNode = dbNodes.find((n) => n.name === dbName)
      if (currentDbNode && schemaRes.rows) {
        const schemaNodes: TreeNode[] = []
        for (const row of schemaRes.rows) {
          const schemaName = String(row.schema_name)
          const schemaNode: TreeNode = { type: 'schema', name: schemaName, expanded: schemaName === 'public', children: [] }
          const tablesRes = await queryForTree(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${schemaName}' AND table_type = 'BASE TABLE' ORDER BY table_name;`)
          const tableGroupNode: TreeNode = {
            type: 'table-group', name: 'Tables', schema: schemaName, expanded: schemaName === 'public',
            children: (tablesRes.rows ?? []).map((t) => ({ type: 'table' as const, name: String(t.table_name), schema: schemaName, expanded: false, children: [] }))
          }
          const viewsRes = await queryForTree(`SELECT table_name FROM information_schema.views WHERE table_schema = '${schemaName}' ORDER BY table_name;`)
          const viewGroupNode: TreeNode = {
            type: 'view-group', name: 'Views', schema: schemaName, expanded: false,
            children: (viewsRes.rows ?? []).map((v) => ({ type: 'view' as const, name: String(v.table_name), schema: schemaName }))
          }
          schemaNode.children = [tableGroupNode, viewGroupNode]
          schemaNodes.push(schemaNode)
        }
        currentDbNode.children = schemaNodes
      }
      setTree(dbNodes)
    } else {
      setStatus('error')
      setStatusMsg(res.error ?? 'Connection failed')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const inputCls = 'bg-black/[0.04] dark:bg-white/[0.06] border border-border rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-blue-500/60 transition-colors'

  return (
    <div className="flex flex-col h-full bg-surface text-white font-mono text-xs select-none">
      {/* Connection bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        {/* Status dot */}
        <span className="relative flex items-center shrink-0">
          <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-400' : status === 'connecting' ? 'bg-yellow-400 animate-pulse' : status === 'error' ? 'bg-red-400' : 'bg-white/30'}`} />
        </span>
        <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>

        {status === 'connected' && (
          <span className="text-text-muted text-[10px] truncate">
            {config.host}:{config.port}/{config.database}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {status === 'connected' && (
            <button
              className="px-2 py-0.5 rounded text-[10px] text-text-muted hover:text-white/60 transition-colors"
              onClick={() => setShowConnForm((s) => !s)}
            >
              {showConnForm ? 'Hide' : 'Connection'}
            </button>
          )}
          {status === 'connected' ? (
            <button
              className="px-3 py-1 rounded text-xs bg-red-600/40 hover:bg-red-500/60 text-red-300 transition-colors"
              onClick={disconnect}
            >
              Disconnect
            </button>
          ) : (
            <button
              className={`px-3 py-1 rounded text-xs transition-colors ${status === 'connecting' ? 'bg-yellow-600/30 text-yellow-300 cursor-not-allowed' : 'bg-green-600/40 hover:bg-green-500/60 text-green-300'}`}
              onClick={connect}
              disabled={status === 'connecting'}
            >
              {status === 'connecting' ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Connecting
                </span>
              ) : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* Connection error */}
      {statusMsg && (
        <div className="px-3 py-1.5 bg-red-900/20 border-b border-red-500/20 text-red-300 shrink-0">
          {statusMsg}
        </div>
      )}

      {/* Connection form */}
      {showConnForm && status !== 'connected' && (
        <div className="px-3 py-3 border-b border-border shrink-0 bg-white/[0.02]">
          {/* Saved connections dropdown */}
          {savedConns.length > 0 && (
            <div className="mb-3">
              <label className="block text-[10px] text-text-muted mb-1">Saved Connections</label>
              <div className="flex flex-wrap gap-1.5">
                {savedConns.map((c) => (
                  <div key={c.name} className="flex items-center gap-1 bg-white/[0.06] rounded px-2 py-1">
                    <button
                      className="text-[10px] text-text-secondary hover:text-white transition-colors"
                      onClick={() => pickConn(c)}
                    >
                      {c.name}
                    </button>
                    <button
                      className="text-text-muted hover:text-red-400 transition-colors"
                      onClick={() => deleteConn(c.name)}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-[1fr_80px_1fr_1fr] gap-2 mb-2">
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Host</label>
              <input className={inputCls + ' w-full'} value={config.host} onChange={(e) => updateConfig({ host: e.target.value })} placeholder="localhost" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Port</label>
              <input className={inputCls + ' w-full'} value={config.port} onChange={(e) => updateConfig({ port: e.target.value })} placeholder="5432" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Database</label>
              <input className={inputCls + ' w-full'} value={config.database} onChange={(e) => updateConfig({ database: e.target.value })} placeholder="postgres" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Connection Name</label>
              <input className={inputCls + ' w-full'} value={config.name} onChange={(e) => updateConfig({ name: e.target.value })} placeholder="My DB" />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Username</label>
              <input className={inputCls + ' w-full'} value={config.username} onChange={(e) => updateConfig({ username: e.target.value })} placeholder="postgres" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Password</label>
              <input className={inputCls + ' w-full'} type="password" value={config.password} onChange={(e) => updateConfig({ password: e.target.value })} placeholder="••••••" />
            </div>
            <div className="flex items-center gap-1.5 pb-0.5">
              <button onClick={() => updateConfig({ ssl: !config.ssl })} className="text-text-muted hover:text-white transition-colors">
                {config.ssl ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <span className="text-[10px] text-text-muted">SSL</span>
            </div>
            <button
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-white/[0.06] hover:bg-white/[0.1] text-text-secondary transition-colors"
              onClick={saveCurrentConn}
              title="Save connection"
            >
              <Save className="w-3 h-3" />
              Save
            </button>
          </div>
        </div>
      )}

      {/* Main content: tree + editor/results */}
      <div className="flex flex-1 min-h-0">
        {/* Schema tree sidebar */}
        {status === 'connected' && (
          <div className="w-[200px] shrink-0 border-r border-border overflow-y-auto bg-white/[0.01]">
            <div className="px-2 py-1.5 border-b border-border flex items-center gap-1.5">
              <FolderTree className="w-3 h-3 text-text-muted" />
              <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Browser</span>
            </div>
            <div className="py-1">
              {tree.map((node, i) => (
                <SchemaTreeNode
                  key={node.name}
                  node={node}
                  path={[i]}
                  depth={0}
                  onToggle={toggleNode}
                  onExpandColumns={expandTableColumns}
                  onTableClick={handleTableClick}
                  onDatabaseClick={handleDatabaseClick}
                  currentDb={config.database}
                />
              ))}
              {tree.length === 0 && (
                <div className="px-3 py-4 text-text-muted text-center">
                  <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                  Loading...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right side: editor + results */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* SQL editor */}
          <div className="flex flex-col border-b border-border shrink-0" style={{ height: 120 }}>
            <div className="flex items-center gap-2 px-3 py-1 border-b border-border">
              <span className="text-text-muted text-[10px]">SQL</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${showHistory ? 'bg-black/5 dark:bg-white/10 text-text-secondary' : 'text-text-muted hover:text-white/60'}`}
                  onClick={() => setShowHistory((s) => !s)}
                >
                  History
                </button>
                <button
                  className={`px-3 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    status !== 'connected' || running
                      ? 'bg-black/5 dark:bg-white/10 text-text-muted cursor-not-allowed'
                      : 'bg-blue-600/60 hover:bg-blue-500/70 text-white'
                  }`}
                  onClick={() => runQuery()}
                  disabled={status !== 'connected' || running}
                  title={`Run query (${runMod}+Enter)`}
                >
                  {running ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Running
                    </span>
                  ) : '▶ Run'}
                </button>
              </div>
            </div>
            <textarea
              ref={sqlRef}
              className="flex-1 min-h-0 bg-transparent text-text-primary text-xs p-2 outline-none resize-none"
              placeholder={status === 'connected' ? `SELECT * FROM table; (${runMod}+Enter to run)` : 'Connect to a database first'}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={handleSqlKeyDown}
              disabled={status !== 'connected'}
              spellCheck={false}
            />
          </div>

          {/* History panel */}
          {showHistory && queryHistory.length > 0 && (
            <div className="shrink-0 border-b border-border bg-white/[0.03] max-h-32 overflow-y-auto">
              {queryHistory.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 px-3 py-1.5 hover:bg-white/[0.05] cursor-pointer"
                  onClick={() => { setSql(entry.sql); setShowHistory(false) }}
                >
                  <span className={`shrink-0 ${entry.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.ok ? '✓' : '✗'}
                  </span>
                  <span className="flex-1 truncate text-text-muted">{entry.sql}</span>
                  {entry.ok && entry.rowCount != null && (
                    <span className="shrink-0 text-text-muted">{entry.rowCount} rows</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="flex-1 min-h-0 overflow-auto">
            {running && (
              <div className="flex items-center justify-center h-full gap-2 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                Running query…
              </div>
            )}
            {!running && !result && (
              <div className="flex items-center justify-center h-full text-text-muted">
                {status === 'connected' ? 'Run a query to see results' : 'Connect to a database'}
              </div>
            )}
            {!running && result && (
              <>
                {!result.ok && (
                  <div className="p-3">
                    <div className="text-red-400 bg-red-900/20 border border-red-500/20 rounded p-2 whitespace-pre-wrap">
                      {result.error}
                      {result.elapsed != null && (
                        <span className="block mt-1 text-text-muted text-[10px]">{result.elapsed}ms</span>
                      )}
                    </div>
                  </div>
                )}

                {result.ok && (
                  <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border text-text-muted text-[10px] shrink-0">
                    <span className="text-green-400">✓</span>
                    {result.rowCount != null && <span>{result.rowCount} row{result.rowCount !== 1 ? 's' : ''}</span>}
                    {result.elapsed != null && <span>{result.elapsed}ms</span>}
                  </div>
                )}

                {result.ok && result.fields && result.rows && result.rows.length > 0 && (
                  <ResultTable fields={result.fields} rows={result.rows} />
                )}

                {result.ok && (result.rows == null || result.rows.length === 0) && (
                  <div className="flex items-center justify-center py-8 text-text-muted">
                    Query returned no rows
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Schema Tree Node ────────────────────────────────────────────────────────

function SchemaTreeNode({
  node,
  path,
  depth,
  onToggle,
  onExpandColumns,
  onTableClick,
  onDatabaseClick,
  currentDb
}: {
  node: TreeNode
  path: number[]
  depth: number
  onToggle: (path: number[]) => void
  onExpandColumns: (path: number[], schema: string, table: string) => void
  onTableClick: (schema: string, table: string) => void
  onDatabaseClick: (db: string) => void
  currentDb: string
}) {
  const hasChildren = node.children && node.children.length > 0
  const isExpandable = node.type === 'database' || node.type === 'schema' || node.type === 'table-group' || node.type === 'view-group' || node.type === 'table'
  const paddingLeft = 8 + depth * 14

  const handleClick = () => {
    if (node.type === 'table' && node.schema) {
      // If not expanded yet and children are empty, load columns
      if (!node.expanded && node.children && node.children.length === 0) {
        onExpandColumns(path, node.schema, node.name)
      } else {
        onToggle(path)
      }
    } else if (node.type === 'database') {
      if (node.name !== currentDb) {
        onDatabaseClick(node.name)
      } else {
        onToggle(path)
      }
    } else if (isExpandable) {
      onToggle(path)
    }
  }

  const handleDoubleClick = () => {
    if (node.type === 'table' && node.schema) {
      onTableClick(node.schema, node.name)
    } else if (node.type === 'view' && node.schema) {
      onTableClick(node.schema, node.name)
    }
  }

  const icon = () => {
    switch (node.type) {
      case 'database':
        return <Database className={`w-3 h-3 shrink-0 ${node.name === currentDb ? 'text-blue-400' : 'text-text-muted'}`} />
      case 'schema':
        return <Columns3 className="w-3 h-3 shrink-0 text-purple-400/70" />
      case 'table-group':
        return <Table className="w-3 h-3 shrink-0 text-orange-400/70" />
      case 'table':
        return <Table className="w-3 h-3 shrink-0 text-orange-300/60" />
      case 'view-group':
        return <Eye className="w-3 h-3 shrink-0 text-cyan-400/70" />
      case 'view':
        return <Eye className="w-3 h-3 shrink-0 text-cyan-300/60" />
      case 'column':
        return <span className="w-3 h-3 shrink-0 text-[9px] text-text-muted flex items-center justify-center font-bold">c</span>
      default:
        return null
    }
  }

  return (
    <>
      <div
        className="flex items-center gap-1 py-[3px] cursor-pointer hover:bg-white/[0.05] transition-colors group"
        style={{ paddingLeft }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={node.type === 'table' || node.type === 'view' ? 'Double-click to query' : undefined}
      >
        {isExpandable ? (
          node.loading ? (
            <Loader2 className="w-3 h-3 shrink-0 text-text-muted animate-spin" />
          ) : node.expanded ? (
            <ChevronDown className="w-3 h-3 shrink-0 text-text-muted" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0 text-text-muted" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {icon()}
        <span className={`truncate text-[11px] ${
          node.type === 'column'
            ? 'text-text-muted'
            : node.type === 'database' && node.name === currentDb
              ? 'text-blue-300'
              : 'text-text-secondary'
        }`}>
          {node.name}
          {node.type === 'column' && node.dataType && (
            <span className="text-text-muted ml-1 text-[9px]">{node.dataType}</span>
          )}
        </span>
        {node.type === 'table-group' && node.children && (
          <span className="text-[9px] text-text-muted ml-auto mr-2 opacity-0 group-hover:opacity-100">
            {node.children.length}
          </span>
        )}
        {node.type === 'view-group' && node.children && (
          <span className="text-[9px] text-text-muted ml-auto mr-2 opacity-0 group-hover:opacity-100">
            {node.children.length}
          </span>
        )}
      </div>

      {node.expanded && node.children && node.children.map((child, i) => (
        <SchemaTreeNode
          key={child.name + child.type}
          node={child}
          path={[...path, i]}
          depth={depth + 1}
          onToggle={onToggle}
          onExpandColumns={onExpandColumns}
          onTableClick={onTableClick}
          onDatabaseClick={onDatabaseClick}
          currentDb={currentDb}
        />
      ))}
    </>
  )
}

// ─── Improved Result Table ───────────────────────────────────────────────────

function ResultTable({ fields, rows }: { fields: string[]; rows: Record<string, unknown>[] }) {
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [copiedCell, setCopiedCell] = useState<string | null>(null)

  const cellValue = (v: unknown): string => {
    if (v === null || v === undefined) return 'NULL'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  const truncate = (s: string) =>
    s.length > COL_MAX_CHARS ? s.slice(0, COL_MAX_CHARS) + '…' : s

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortedRows = React.useMemo(() => {
    if (!sortField) return rows
    return [...rows].sort((a, b) => {
      const av = cellValue(a[sortField])
      const bv = cellValue(b[sortField])
      const numA = Number(av)
      const numB = Number(bv)
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDir === 'asc' ? numA - numB : numB - numA
      }
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortField, sortDir])

  const copyToClipboard = (value: string, key: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedCell(key)
      setTimeout(() => setCopiedCell(null), 1200)
    })
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-surface z-10">
          <tr>
            <th className="px-2 py-1.5 text-right text-text-muted font-normal border-b border-border select-none w-10">#</th>
            {fields.map((f) => (
              <th
                key={f}
                className="px-2 py-1.5 text-left text-orange-300/80 font-medium border-b border-border whitespace-nowrap cursor-pointer hover:text-orange-200 transition-colors select-none"
                onClick={() => handleSort(f)}
              >
                <span className="flex items-center gap-1">
                  {f}
                  {sortField === f && (
                    sortDir === 'asc'
                      ? <ArrowUp className="w-2.5 h-2.5" />
                      : <ArrowDown className="w-2.5 h-2.5" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <tr
              key={i}
              className={`${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'} hover:bg-white/[0.05] transition-colors`}
            >
              <td className="px-2 py-1 text-right text-text-muted border-r border-border">{i + 1}</td>
              {fields.map((f) => {
                const raw = cellValue(row[f])
                const isNull = row[f] === null || row[f] === undefined
                const cellKey = `${i}-${f}`
                return (
                  <td
                    key={f}
                    className={`px-2 py-1 border-b border-border whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis cursor-pointer group/cell relative ${
                      isNull ? 'text-text-muted italic' : 'text-text-secondary'
                    }`}
                    title={raw}
                    onClick={() => copyToClipboard(raw, cellKey)}
                  >
                    <span className="flex items-center gap-1">
                      {truncate(raw)}
                      {copiedCell === cellKey ? (
                        <Check className="w-2.5 h-2.5 text-green-400 shrink-0" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 text-text-muted opacity-0 group-hover/cell:opacity-50 shrink-0 transition-opacity" />
                      )}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
