import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './legacy-style.css'
import './legacy-shadcn.css'
import './legacy.css'
import App from './App.tsx'

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
      const urls = performance.getEntriesByType('resource').map((e) => e.name)
      reg.active?.postMessage({ cacheUrls: [location.href.split('#')[0], ...urls] })
    })
    .catch(() => {
      /* offline support is a bonus; the app works without it */
    })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
