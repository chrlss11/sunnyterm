import React, { useMemo, useState } from 'react'
import { useStore } from '../store'

// ─── Data parsing ─────────────────────────────────────────────────────────────

interface ParsedData {
  headers: string[]
  rows: string[][]
}

function parseData(raw: string): ParsedData | null {
  // Try JSON array
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      const headers = Object.keys(parsed[0])
      const rows = parsed.map((item: Record<string, unknown>) =>
        headers.map((h) => String(item[h] ?? ''))
      )
      return { headers, rows }
    }
  } catch { /* not JSON */ }

  const lines = raw.trim().split('\n').filter((l) => l.trim())
  if (lines.length < 2) return null

  // Try CSV/TSV
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const csvHeaders = lines[0].split(delimiter).map((h) => h.trim())
  const csvRows = lines.slice(1).map((l) => l.split(delimiter).map((c) => c.trim()))
  if (csvHeaders.length >= 2 && csvRows.every((r) => r.length === csvHeaders.length)) {
    return { headers: csvHeaders, rows: csvRows }
  }

  // Try key-value (lines like "label  value")
  const kvPairs = lines
    .map((l) => {
      const parts = l.trim().split(/\s{2,}|\t/)
      if (parts.length >= 2) return parts.slice(0, 2)
      return null
    })
    .filter(Boolean) as string[][]

  if (kvPairs.length >= 2) {
    return { headers: ['Label', 'Value'], rows: kvPairs }
  }

  return null
}

/** Extract numeric values from a column, returning NaN for non-numeric cells */
function numericColumn(rows: string[][], colIdx: number): number[] {
  return rows.map((r) => {
    const v = r[colIdx]?.replace(/[^0-9.\-eE+]/g, '')
    return v ? parseFloat(v) : NaN
  })
}

/** Find the best numeric column index (first column with mostly numeric values) */
function findNumericCol(data: ParsedData): number {
  for (let c = data.headers.length - 1; c >= 0; c--) {
    const nums = numericColumn(data.rows, c)
    const validCount = nums.filter((n) => !isNaN(n)).length
    if (validCount >= data.rows.length * 0.6) return c
  }
  return data.headers.length - 1
}

/** Find the best label column index (first non-numeric or first column) */
function findLabelCol(data: ParsedData, numCol: number): number {
  for (let c = 0; c < data.headers.length; c++) {
    if (c !== numCol) return c
  }
  return 0
}

// ─── Chart colors from theme ─────────────────────────────────────────────────

const CHART_COLORS = [
  'var(--primary)',
  '#f9e2af',
  '#a6e3a1',
  '#89b4fa',
  '#f38ba8',
  '#cba6f7',
  '#fab387',
  '#94e2d5',
]

// ─── View types ──────────────────────────────────────────────────────────────

type ChartViewType = 'bar' | 'line' | 'table'

// ─── SVG Bar Chart ───────────────────────────────────────────────────────────

function BarChart({ data, labelCol, numCol, width, height }: {
  data: ParsedData
  labelCol: number
  numCol: number
  width: number
  height: number
}) {
  const values = numericColumn(data.rows, numCol)
  const labels = data.rows.map((r) => r[labelCol] ?? '')
  const maxVal = Math.max(...values.filter((v) => !isNaN(v)), 1)
  const barH = Math.max(8, Math.min(28, (height - 40) / Math.max(values.length, 1) - 4))
  const labelW = Math.min(120, width * 0.3)
  const chartW = width - labelW - 60

  return (
    <svg width={width} height={height} className="block">
      {/* Header */}
      <text x={labelW} y={16} fontSize={10} fill="var(--text-muted)" fontFamily="inherit">
        {data.headers[numCol]}
      </text>
      {values.map((val, i) => {
        const y = 28 + i * (barH + 4)
        const barWidth = isNaN(val) ? 0 : (val / maxVal) * chartW
        const color = CHART_COLORS[i % CHART_COLORS.length]
        if (y + barH > height) return null
        return (
          <g key={i}>
            {/* Label */}
            <text
              x={labelW - 6}
              y={y + barH / 2 + 3}
              fontSize={10}
              fill="var(--text-secondary)"
              textAnchor="end"
              fontFamily="inherit"
            >
              {labels[i].length > 16 ? labels[i].slice(0, 15) + '\u2026' : labels[i]}
            </text>
            {/* Bar */}
            <rect
              x={labelW}
              y={y}
              width={Math.max(0, barWidth)}
              height={barH}
              rx={3}
              fill={color}
              opacity={0.85}
            />
            {/* Value label */}
            {!isNaN(val) && (
              <text
                x={labelW + barWidth + 6}
                y={y + barH / 2 + 3}
                fontSize={9}
                fill="var(--text-muted)"
                fontFamily="inherit"
              >
                {val % 1 === 0 ? val : val.toFixed(2)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── SVG Line Chart ──────────────────────────────────────────────────────────

function LineChart({ data, numCol, width, height }: {
  data: ParsedData
  numCol: number
  width: number
  height: number
}) {
  const values = numericColumn(data.rows, numCol)
  const validValues = values.filter((v) => !isNaN(v))
  if (validValues.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-text-muted">
        Not enough numeric data for line chart
      </div>
    )
  }

  const minVal = Math.min(...validValues)
  const maxVal = Math.max(...validValues)
  const range = maxVal - minVal || 1

  const padX = 40
  const padY = 24
  const padBottom = 20
  const chartW = width - padX * 2
  const chartH = height - padY - padBottom

  const points = values.map((val, i) => {
    const x = padX + (i / (values.length - 1)) * chartW
    const y = isNaN(val) ? NaN : padY + chartH - ((val - minVal) / range) * chartH
    return { x, y, val }
  }).filter((p) => !isNaN(p.y))

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg width={width} height={height} className="block">
      {/* Y axis labels */}
      <text x={padX - 4} y={padY + 4} fontSize={9} fill="var(--text-muted)" textAnchor="end" fontFamily="inherit">
        {maxVal % 1 === 0 ? maxVal : maxVal.toFixed(1)}
      </text>
      <text x={padX - 4} y={padY + chartH + 4} fontSize={9} fill="var(--text-muted)" textAnchor="end" fontFamily="inherit">
        {minVal % 1 === 0 ? minVal : minVal.toFixed(1)}
      </text>
      {/* Grid lines */}
      <line x1={padX} y1={padY} x2={padX + chartW} y2={padY} stroke="var(--border)" strokeWidth={0.5} />
      <line x1={padX} y1={padY + chartH} x2={padX + chartW} y2={padY + chartH} stroke="var(--border)" strokeWidth={0.5} />
      <line x1={padX} y1={padY + chartH / 2} x2={padX + chartW} y2={padY + chartH / 2} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="4 3" />
      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--primary)" />
      ))}
      {/* Header */}
      <text x={padX} y={12} fontSize={10} fill="var(--text-muted)" fontFamily="inherit">
        {data.headers[numCol]}
      </text>
    </svg>
  )
}

// ─── HTML Table ──────────────────────────────────────────────────────────────

function DataTable({ data }: { data: ParsedData }) {
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {data.headers.map((h, i) => (
              <th
                key={i}
                className="px-2 py-1.5 text-left text-text-secondary font-medium border-b border-border sticky top-0 bg-tile"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.03]'}
            >
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 text-text-primary border-b border-border/50 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Chart Tile ──────────────────────────────────────────────────────────────

interface Props {
  tileId: string
}

export function ChartTile({ tileId }: Props) {
  const tile = useStore((s) => s.tiles.find((t) => t.id === tileId))
  const [viewType, setViewType] = useState<ChartViewType>('bar')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [dims, setDims] = React.useState({ w: 600, h: 350 })

  // Measure container
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDims({
          w: Math.floor(entry.contentRect.width),
          h: Math.floor(entry.contentRect.height),
        })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const data = useMemo(() => {
    if (!tile?.chartData) return null
    return parseData(tile.chartData)
  }, [tile?.chartData])

  if (!tile) return null

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 15l4-4 4 4 4-4 4 4" />
        </svg>
        <p className="text-text-muted text-xs">Could not parse data</p>
        <p className="text-text-muted text-[10px] max-w-xs">Select tabular data (JSON, CSV, or key-value) in a terminal and use "Visualize Selection" from the context menu.</p>
      </div>
    )
  }

  const numCol = findNumericCol(data)
  const labelCol = findLabelCol(data, numCol)

  // Available height for chart (minus toggle bar)
  const chartH = Math.max(100, dims.h - 32)

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      {/* Toggle bar */}
      <div className="flex items-center gap-1 px-2 py-1 shrink-0 border-b border-border">
        {(['bar', 'line', 'table'] as ChartViewType[]).map((vt) => (
          <button
            key={vt}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              viewType === vt
                ? 'bg-white/10 text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            onClick={() => setViewType(vt)}
          >
            {vt === 'bar' ? 'Bar' : vt === 'line' ? 'Line' : 'Table'}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-text-muted">
          {data.rows.length} rows
        </span>
      </div>

      {/* Chart content */}
      <div className="flex-1 min-h-0 overflow-hidden p-1">
        {viewType === 'bar' && (
          <BarChart data={data} labelCol={labelCol} numCol={numCol} width={dims.w - 8} height={chartH} />
        )}
        {viewType === 'line' && (
          <LineChart data={data} numCol={numCol} width={dims.w - 8} height={chartH} />
        )}
        {viewType === 'table' && (
          <DataTable data={data} />
        )}
      </div>
    </div>
  )
}
