import { useEffect, useRef } from 'react'

interface UseWakeLockOptions {
  enabled: boolean
}

export function useWakeLock({ enabled }: UseWakeLockOptions): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  const acquire = async () => {
    if (!enabled) return
    if (!('wakeLock' in navigator)) return
    try {
      sentinelRef.current = await navigator.wakeLock.request('screen')
    } catch {
      // Wake lock is best-effort; silently swallow errors
    }
  }

  const release = async () => {
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release()
      } catch {
        // Silently swallow
      }
      sentinelRef.current = null
    }
  }

  useEffect(() => {
    if (!enabled) {
      release()
      return
    }

    acquire()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) {
        acquire()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      release()
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps
}
