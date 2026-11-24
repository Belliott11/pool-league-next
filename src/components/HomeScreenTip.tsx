import { Share, SquarePlus, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const SEEN = "pooleanIntelVisits" // how many visits this phone has made (counted once per visit)
const HIDE = "pooleanIntelHomeTip" // "done" for good, or the time until which "Not now" hides it
const MONTH = 30 * 24 * 3600 * 1000

const get = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const set = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* private browsing: the tip may show again, which is harmless */
  }
}

// An iPhone or iPad (iPads report themselves as a Mac with a touch screen) where the site is open in the browser, not from the home screen.
function inIosBrowser(): boolean {
  if (typeof navigator === "undefined") return false
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches
  return ios && !standalone
}

// How to put the site on the home screen, for iPhones: it then opens like an app with no browser bars, and iOS keeps its saved stats (a
// website opened in Safari loses them after a week unused). Shown from the second visit, until dismissed.
export function HomeScreenTip() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!inIosBrowser()) return
    let visits = Number(get(SEEN) ?? "0")
    try {
      if (!sessionStorage.getItem(SEEN)) {
        sessionStorage.setItem(SEEN, "1")
        visits += 1
        set(SEEN, String(visits))
      }
    } catch {
      /* no session storage: count nothing */
    }
    const hide = get(HIDE)
    const hidden = hide === "done" || (hide !== null && Number(hide) > Date.now())
    // One tip at a time: the colors tip (ColorMenu) comes first, then this one on a later visit.
    const colorsTipDone = get("pooleanIntelColorHint") !== null
    setShow(visits >= 2 && !hidden && colorsTipDone)
  }, [])
  if (!show) return null
  const close = (forGood: boolean) => {
    set(HIDE, forGood ? "done" : String(Date.now() + MONTH))
    setShow(false)
  }
  return (
    <aside className="relative flex flex-col gap-2 rounded-xl border bg-card p-4 pr-10 text-sm" aria-label="Add to Home Screen">
      <button type="button" onClick={() => close(false)} className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Not now">
        <X aria-hidden className="size-4" />
      </button>
      <p className="font-semibold">Put Poolean Intel on your home screen</p>
      <ol className="flex flex-col gap-1.5">
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">1</span>
          Tap <Share aria-label="Share" className="size-4 text-accent" /> Share in the browser bar.
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">2</span>
          Choose <SquarePlus aria-hidden className="size-4 text-accent" /> Add to Home Screen.
        </li>
      </ol>
      <p className="text-muted-foreground">It opens like an app, and the stats stay on your phone for when there's no signal.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => close(true)}>
          Got it
        </Button>
        <Button size="sm" variant="ghost" onClick={() => close(false)}>
          Not now
        </Button>
      </div>
    </aside>
  )
}
