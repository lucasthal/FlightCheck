import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App'

// Kill zombie service workers left behind by early TestFlight builds that
// shipped with the PWA service worker enabled on native. A registered SW
// survives app updates and serves its stale cache forever (its sw.js update
// check gets the SPA index.html fallback, never a 404, so it self-heals
// never). Unregister + purge CacheStorage, then reload once so this launch
// already renders the bundled assets.
if (Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  void (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      const keys = await caches.keys()
      if (regs.length === 0 && keys.length === 0) return
      await Promise.all(regs.map(r => r.unregister()))
      await Promise.all(keys.map(k => caches.delete(k)))
      if (!sessionStorage.getItem('sw-purged')) {
        sessionStorage.setItem('sw-purged', '1')
        window.location.reload()
      }
    } catch {
      // No SW support in this WebView — nothing to clean.
    }
  })()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
