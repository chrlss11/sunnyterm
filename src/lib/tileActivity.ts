/**
 * Module-level activity tracker for tiles.
 * Used by Semantic Zoom to determine heatmap brightness and "running" status.
 */

const lastActivity = new Map<string, number>()

export function markActivity(tileId: string): void {
  lastActivity.set(tileId, Date.now())
}

export function getActivity(tileId: string): number {
  return lastActivity.get(tileId) ?? 0
}

/**
 * Returns a 0–1 value representing how recently the tile had activity.
 * 1.0 = very recent (< 1s), 0.1 = stale (> 2 min)
 */
export function getActivityLevel(tileId: string): number {
  const last = lastActivity.get(tileId) ?? 0
  const age = Date.now() - last
  if (age < 1000) return 1.0
  if (age < 5000) return 0.8
  if (age < 30000) return 0.5
  if (age < 120000) return 0.3
  return 0.1
}
