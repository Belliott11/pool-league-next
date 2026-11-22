import { lazy, type ComponentType } from "react"

// A page whose code loads when it is first opened. After a deploy, a tab that was already open still asks for the old file names, which
// are gone, and the page would come up blank. So a failed load reloads the site once, which picks up the new version. If it fails
// again within a minute (the site is really down), the error is let through instead of reloading forever.
const KEY = "pooleanReloadedForUpdate"

export function reloadForNewVersion(err: unknown): Promise<never> {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last > 60_000) sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* storage blocked: reload anyway, the minute guard just does not apply */
  }
  if (Date.now() - last <= 60_000) return Promise.reject(err)
  location.reload()
  return new Promise<never>(() => {}) // the page is going away
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the same bound React.lazy itself uses
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => load().catch(reloadForNewVersion))
}
