import { useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { haptic } from "@/lib/haptics"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { parseCall } from "@/lib/voiceScore"

// Voice scoring (voiceScore.ts) on both live screens: tap, say "Zach three", and the basket goes in after a short countdown that can be
// cancelled. Uses the phone's own speech recognition; hidden on browsers without it. Wet hands at a pool make the swipes the slow part.

type Recognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
const Engine = (): (new () => Recognition) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const WAIT = 2500 // ms before a heard basket goes in

export function VoiceScore({ state, ids, add }: { state: PooleanState; ids: string[]; add: (pid: string, pts: number) => void }) {
  const [listening, setListening] = useState(false)
  const [pending, setPending] = useState<{ pid: string; points: number; passer: string | null } | null>(null)
  const [note, setNote] = useState("")
  const rec = useRef<Recognition | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => (clearTimeout(timer.current), rec.current?.abort()), [])
  const Rec = typeof window === "undefined" ? null : Engine()
  if (!Rec) return null
  const players = ids.map((id) => ({ id, name: playerName(state, id) }))

  const commit = (p: { pid: string; points: number }) => {
    clearTimeout(timer.current)
    setPending(null)
    add(p.pid, p.points)
  }
  const cancel = () => {
    clearTimeout(timer.current)
    setPending(null)
    setNote("Cancelled. Nothing was added.")
    haptic("tick")
  }
  const listen = () => {
    if (listening) {
      rec.current?.stop()
      return
    }
    clearTimeout(timer.current)
    setPending(null)
    setNote("")
    const r = new Rec()
    r.lang = "en-US"
    r.interimResults = false
    r.continuous = false
    r.maxAlternatives = 4
    r.onresult = (e) => {
      const alts = Array.from(e.results[0] ?? []).map((a) => a.transcript)
      const calls = alts.map((t) => parseCall(t, players))
      const good = calls.find((c) => c.ok)
      if (good && good.ok) {
        haptic("light")
        const p = { pid: good.pid, points: good.points, passer: good.passer }
        setPending(p)
        timer.current = setTimeout(() => commit(p), WAIT)
      } else {
        haptic("warn")
        const first = calls[0]
        setNote(first && !first.ok ? `${first.why}${first.heard ? ` Heard "${first.heard}".` : ""}` : "Did not catch that.")
      }
    }
    r.onerror = (e) => setNote(e.error === "not-allowed" || e.error === "service-not-allowed" ? "The microphone is off for this site. Allow it in the browser's settings." : e.error === "no-speech" ? "Did not hear anything." : "Could not listen just now. Try again.")
    r.onend = () => setListening(false)
    rec.current = r
    try {
      r.start()
      setListening(true)
      haptic("tick")
    } catch {
      setNote("Could not listen just now. Try again.")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant={listening ? "default" : "outline"} className="h-12" aria-pressed={listening} onClick={listen}>
        {listening ? <MicOff aria-hidden /> : <Mic aria-hidden />}
        {listening ? "Listening. Say who scored and how many" : "Say the basket"}
      </Button>
      {pending && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-primary p-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{playerName(state, pending.pid)}, {pending.points}</span>
            {pending.passer && <span className="text-muted-foreground"> (pass from {playerName(state, pending.passer)} not saved: live scoring keeps baskets only)</span>}
            <span className="block h-1 overflow-hidden rounded bg-muted">
              <span className="block h-full bg-primary motion-safe:animate-[shrink_2.5s_linear_forwards]" style={{ width: "100%" }} />
            </span>
          </span>
          <Button size="sm" onClick={() => commit(pending)}>
            Add
          </Button>
          <Button size="sm" variant="outline" onClick={cancel}>
            Cancel
          </Button>
        </div>
      )}
      {note && !pending && (
        <p role="status" className="text-center text-xs text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  )
}
