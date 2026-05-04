/**
 * Thin localStorage cache helpers for offline fallback data.
 * All keys should be namespaced (e.g. "flightcheck-profiles-{userId}").
 * These functions never throw — failures are silently swallowed.
 */

export function setCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // QuotaExceededError or serialisation error — fail open
  }
}

export function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as T
    if (parsed === null || parsed === undefined) return null
    return parsed
  } catch {
    // Corrupt JSON — treat as cache miss
    return null
  }
}

export function clearCache(key: string): void {
  localStorage.removeItem(key)
}
