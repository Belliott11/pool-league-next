import { useEffect, useRef, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { callFor, scoreLine, type Snap } from "@/lib/announcer"
import { findLiveGame, liveTargetOf, liveTotals } from "@/lib/live"
import { playerName } from "@/lib/players"
import type { Game, PooleanState } from "@/lib/types"

// Announcer mode on both live screens: the phone calls each basket out loud with its own voice (speechSynthesis), for a phone or speaker
// by the pool. Off until tapped on each visit, since phones only allow speech that a tap started. While on, the screen stays awake
// (Wake Lock, where the phone has it). What it says is src/lib/announcer.ts.
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window

// Never throws: a phone whose speech fails must not take the live screen down with it.
function say(text: string) {
  if (!supported()) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    const voices = speechSynthesis.getVoices()
    const voice = voices.find((v) => v.lang.startsWith("en") && v.localService) ?? voices.find((v) => v.lang.startsWith("en"))
    if (voice) u.voice = voice
    u.rate = 1.05
    speechSynthesis.speak(u)
  } catch {
    /* no voice on this phone */
  }
}

const snap = (g: Game): Snap => {
  const [a, b] = liveTotals(g)
  return { id: g.id, baskets: [...(g.liveScores ?? []), ...(g.scorekeeperScores ?? [])], a, b, target: liveTargetOf(g), live: !!g.liveInProgress }
}

type WakeLock = { release: () => Promise<void> }

export function Announcer({ state }: { state: PooleanState }) {
  const [on, setOn] = useState(false)
  // The live game, or the one that just ended (so its final is called after it stops being live).
  const live = findLiveGame(state)
  const lastId = useRef<string | undefined>(live?.id)
  if (live) lastId.current = live.id
  const game = live ?? (lastId.current ? state.games.find((g) => g.id === lastId.current) : undefined)
  const prev = useRef<Snap | null>(null)

  useEffect(() => {
    const next = game ? snap(game) : null
    if (on && next) {
      const line = callFor(prev.current, next, (pid) => playerName(state, pid))
      if (line) say(line)
    }
    prev.current = next
  }, [game, on, state])

  // Keep the screen awake while announcing.
  useEffect(() => {
    if (!on) return
    let lock: WakeLock | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } }
    const grab = () => void nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {})
    const back = () => document.visibilityState === "visible" && grab()
    grab()
    document.addEventListener("visibilitychange", back)
    return () => {
      document.removeEventListener("visibilitychange", back)
      void lock?.release().catch(() => {})
    }
  }, [on])

  useEffect(
    () => () => {
      try {
        if (supported()) speechSynthesis.cancel()
      } catch {
        /* nothing to stop */
      }
    },
    [],
  )

  if (!supported() || !game || (!game.liveInProgress && !on)) return null
  const toggle = () => {
    if (on) {
      try {
        speechSynthesis.cancel()
      } catch {
        /* nothing to stop */
      }
      setOn(false)
      return
    }
    setOn(true)
    const s = snap(game)
    say(`Announcer on. ${s.live ? scoreLine(s.a, s.b) : ""}`) // inside the tap, which phones need before they will speak
  }
  return (
    <Button size="sm" variant={on ? "default" : "outline"} onClick={toggle} aria-pressed={on} className="self-start">
      {on ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
      {on ? "Announcer on" : "Announcer"}
    </Button>
  )
}
