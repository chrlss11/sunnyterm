import type { Tile, SnapResult } from '../types'

/**
 * Magnetic edge snapping — mirrors sunnyterm/src/ui/snap.rs
 *
 * Checks these alignment pairs (independently on X and Y axes):
 *   left↔left, left↔right, right↔left, right↔right,
 *   center↔center
 *
 * If any axis is within the threshold, it snaps to that edge.
 */
export function computeSnap(
  rawX: number,
  rawY: number,
  w: number,
  h: number,
  others: Tile[],
  threshold: number
): SnapResult {
  let snapX: number | null = null
  let snapY: number | null = null
  let bestDX = threshold + 1
  let bestDY = threshold + 1

  const right = rawX + w
  const centerX = rawX + w / 2
  const bottom = rawY + h
  const centerY = rawY + h / 2

  for (const o of others) {
    const oRight = o.x + o.w
    const oCenterX = o.x + o.w / 2
    const oBottom = o.y + o.h
    const oCenterY = o.y + o.h / 2

    // X-axis candidates
    const xCandidates: [number, number][] = [
      [rawX, o.x],          // left ↔ left
      [rawX, oRight],       // left ↔ right
      [right, o.x],         // right ↔ left
      [right, oRight],      // right ↔ right
      [centerX, oCenterX]   // center ↔ center
    ]
    for (const [mine, theirs] of xCandidates) {
      const d = Math.abs(mine - theirs)
      if (d < threshold && d < bestDX) {
        bestDX = d
        snapX = rawX + (theirs - mine) // adjust so `mine` lands on `theirs`
      }
    }

    // Y-axis candidates
    const yCandidates: [number, number][] = [
      [rawY, o.y],
      [rawY, oBottom],
      [bottom, o.y],
      [bottom, oBottom],
      [centerY, oCenterY]
    ]
    for (const [mine, theirs] of yCandidates) {
      const d = Math.abs(mine - theirs)
      if (d < threshold && d < bestDY) {
        bestDY = d
        snapY = rawY + (theirs - mine)
      }
    }
  }

  return { x: snapX ?? rawX, y: snapY ?? rawY }
}
