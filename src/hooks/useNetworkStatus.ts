import { useEffect, useState } from 'react'

/**
 * Returns the current network reachability derived from the browser's
 * navigator.onLine flag, updated in real time via the window online/offline
 * events. No polling — purely event-driven.
 */
export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline }
}
