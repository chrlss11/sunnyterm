/** Persistent tab order across re-renders, keyed by sorted tile-id set */
export const tabOrderCache = new Map<string, string[]>()
