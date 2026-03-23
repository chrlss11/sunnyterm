import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useTrailStore } from '../lib/canvasTrails'
import { useStore } from '../store'
import { Circle, Eye, EyeOff, Save, FolderOpen, Play, Square, Trash2, X } from 'lucide-react'

const RECORD_DEBOUNCE = 300

export function TrailControls() {
  const isRecording = useTrailStore((s) => s.isRecording)
  const showTrail = useTrailStore((s) => s.showTrail)
  const currentTrail = useTrailStore((s) => s.currentTrail)
  const savedTrails = useTrailStore((s) => s.savedTrails)
  const isReplaying = useTrailStore((s) => s.isReplaying)
  const replayIndex = useTrailStore((s) => s.replayIndex)

  const {
    startRecording,
    stopRecording,
    addPoint,
    toggleShowTrail,
    saveTrail,
    loadTrail,
    deleteTrail,
    clearCurrentTrail,
    startReplay,
    stopReplay,
    advanceReplay,
  } = useTrailStore()

  const [showSaveInput, setShowSaveInput] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [showLoadMenu, setShowLoadMenu] = useState(false)
  const saveInputRef = useRef<HTMLInputElement>(null)

  // ── Recording subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) return
    let timeout: ReturnType<typeof setTimeout>

    const unsub = useStore.subscribe(
      (state) => ({
        panX: state.panX,
        panY: state.panY,
        zoom: state.zoom,
        focusedId: state.focusedId,
      }),
      (current, prev) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => {
          useTrailStore.getState().addPoint({
            x: current.panX,
            y: current.panY,
            zoom: current.zoom,
            tileId: current.focusedId,
            timestamp: Date.now(),
          })
        }, RECORD_DEBOUNCE)
      }
    )

    return () => {
      unsub()
      clearTimeout(timeout)
    }
  }, [isRecording])

  // ── Replay animation ────────────────────────────────────────────────────────
  const replayRaf = useRef<number>(0)
  const replayStart = useRef(0)

  useEffect(() => {
    if (!isReplaying) {
      cancelAnimationFrame(replayRaf.current)
      return
    }

    const trail = useTrailStore.getState().currentTrail
    if (trail.length < 2) {
      stopReplay()
      return
    }

    // Duration per segment: scale relative time, min 60ms, max 400ms per step
    const totalDuration = trail[trail.length - 1].timestamp - trail[0].timestamp
    const segmentDuration = Math.max(60, Math.min(400, totalDuration / trail.length))

    let currentIdx = useTrailStore.getState().replayIndex
    let segStart = performance.now()

    const tick = (now: number) => {
      const state = useTrailStore.getState()
      if (!state.isReplaying) return

      const idx = state.replayIndex
      if (idx >= trail.length - 1) {
        stopReplay()
        return
      }

      const elapsed = now - segStart
      const t = Math.min(1, elapsed / segmentDuration)

      const from = trail[idx]
      const to = trail[idx + 1]

      // Interpolate
      const panX = from.x + (to.x - from.x) * t
      const panY = from.y + (to.y - from.y) * t
      const zoom = from.zoom + (to.zoom - from.zoom) * t

      useStore.getState().setPan(panX, panY)
      useStore.getState().setZoom(zoom)

      if (t >= 1) {
        advanceReplay()
        segStart = now
      }

      replayRaf.current = requestAnimationFrame(tick)
    }

    segStart = performance.now()
    replayRaf.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(replayRaf.current)
  }, [isReplaying, stopReplay, advanceReplay])

  // Focus save input when shown
  useEffect(() => {
    if (showSaveInput && saveInputRef.current) {
      saveInputRef.current.focus()
    }
  }, [showSaveInput])

  const handleSave = () => {
    const name = saveName.trim()
    if (!name) return
    saveTrail(name)
    setSaveName('')
    setShowSaveInput(false)
  }

  const btn =
    'flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/10 transition-colors text-text-secondary hover:text-text-primary'

  return (
    <div
      className="absolute bottom-4 left-4 flex flex-col gap-1.5 z-50"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Load menu dropdown */}
      {showLoadMenu && savedTrails.length > 0 && (
        <div className="mb-1 w-52 rounded-lg border border-border bg-tile shadow-xl py-1 text-xs">
          <div className="px-3 py-1 text-[10px] text-text-muted font-medium uppercase tracking-wider">
            Saved Trails
          </div>
          {savedTrails.map((trail) => (
            <div
              key={trail.id}
              className="flex items-center justify-between px-3 py-1.5 hover:bg-white/10 cursor-pointer text-text-secondary hover:text-text-primary"
            >
              <span
                className="truncate flex-1"
                onClick={() => {
                  loadTrail(trail.id)
                  setShowLoadMenu(false)
                }}
              >
                {trail.name}
              </span>
              <button
                className="ml-2 p-0.5 hover:text-red-400 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteTrail(trail.id)
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save name input */}
      {showSaveInput && (
        <div className="mb-1 flex items-center gap-1">
          <input
            ref={saveInputRef}
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setShowSaveInput(false)
            }}
            placeholder="Trail name..."
            className="w-36 px-2 py-1 text-xs rounded-md border border-border bg-tile text-text-primary placeholder:text-text-muted outline-none focus:border-[color:var(--primary)]"
          />
          <button
            className="px-2 py-1 text-xs rounded-md bg-[color:var(--primary)] text-white hover:opacity-80 transition-opacity"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      )}

      {/* Control buttons */}
      <div className="flex items-center gap-0.5 rounded-xl border border-border bg-tile/90 backdrop-blur-md px-1.5 py-1 shadow-lg">
        {/* Record toggle */}
        <button
          className={btn}
          title={isRecording ? 'Stop recording' : 'Start recording'}
          onClick={() => (isRecording ? stopRecording() : startRecording())}
        >
          {isRecording ? (
            <span className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-3.5 w-3.5 rounded-full bg-red-500 opacity-40 animate-ping" />
              <Circle size={12} fill="#ef4444" stroke="#ef4444" />
            </span>
          ) : (
            <Circle size={12} />
          )}
        </button>

        {/* Show / hide trail */}
        <button className={btn} title={showTrail ? 'Hide trail' : 'Show trail'} onClick={toggleShowTrail}>
          {showTrail ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>

        {/* Save */}
        <button
          className={btn}
          title="Save trail"
          disabled={currentTrail.length < 2}
          onClick={() => setShowSaveInput((v) => !v)}
        >
          <Save size={13} />
        </button>

        {/* Load */}
        <button
          className={btn}
          title="Load trail"
          disabled={savedTrails.length === 0}
          onClick={() => setShowLoadMenu((v) => !v)}
        >
          <FolderOpen size={13} />
        </button>

        {/* Replay / stop */}
        {isReplaying ? (
          <button className={btn} title="Stop replay" onClick={stopReplay}>
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button
            className={btn}
            title="Replay trail"
            disabled={currentTrail.length < 2}
            onClick={startReplay}
          >
            <Play size={13} />
          </button>
        )}

        {/* Clear */}
        <button
          className={btn}
          title="Clear trail"
          disabled={currentTrail.length === 0}
          onClick={clearCurrentTrail}
        >
          <Trash2 size={13} />
        </button>

        {/* Point count indicator */}
        {currentTrail.length > 0 && (
          <span className="text-[9px] text-text-muted ml-1 tabular-nums">
            {currentTrail.length}pt
          </span>
        )}
      </div>
    </div>
  )
}
