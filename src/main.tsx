import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './legacy-style.css'
import './legacy-shadcn.css'
import './legacy.css'
import App from './App.tsx'
import { AppBoundary } from './components/AppBoundary'

// Works offline once it has been opened with a connection (see public/sw.js). Production only, and
// only where service workers are allowed (https, or localhost). The files this page already loaded
// are handed to the worker so the very first visit is enough, and a new deploy reloads the page once.
if (import.meta.env.PROD && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    location.reload()
  })
  navigator.serviceWorker
    .register(import.meta.env.BASE_URL + 'sw.js')
    .then((reg) => {
      reg.update().catch(() => {})
      return navigator.serviceWorker.ready.then(() => reg)
    })
    .then((reg) => {
      // Only the site's own files and its fonts (never clips or league data), and only once the page has settled, so a first visit on a
      // slow connection is not downloading everything twice while it loads.
      const keep = (u: string) => {
        try {
          const url = new URL(u)
          return (url.origin === location.origin || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') && !/\.(mp4|mov|webm|m4v)$/i.test(url.pathname)
        } catch {
          return false
        }
      }
      const send = () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name).filter(keep)
        reg.active?.postMessage({ cacheUrls: [location.href.split('#')[0], ...urls] })
      }
      const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(send, { timeout: 10000 }) : setTimeout(send, 3000))
      if (document.readyState === 'complete') setTimeout(idle, 4000)
      else addEventListener('load', () => setTimeout(idle, 4000), { once: true })
    })
    .catch(() => {
      /* offline support is a bonus; the app works without it */
    })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoundary>
      <App />
    </AppBoundary>
  </StrictMode>,
)
