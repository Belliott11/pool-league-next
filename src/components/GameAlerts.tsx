import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { alertSupport, alertsOn, turnAlertsOff, turnAlertsOn } from "@/lib/alerts"

// "Game alerts" on the Games home: a notification when a game goes live and when it ends (src/lib/alerts.ts).
export function GameAlerts() {
  const support = alertSupport()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    if (support === "yes") void alertsOn().then(setOn)
  }, [support])
  if (support === "no") return null
  const toggle = async () => {
    setBusy(true)
    setNote(null)
    if (on) {
      await turnAlertsOff()
      setOn(false)
    } else {
      const r = await turnAlertsOn()
      if (r.ok) setOn(true)
      else setNote(r.why)
    }
    setBusy(false)
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm">
      <Bell aria-hidden className="size-5 shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">Game alerts</div>
        <div className="text-muted-foreground">
          {support === "home-screen-first"
            ? "On an iPhone, add Poolean Intel to your Home Screen (Share, then Add to Home Screen), open it from there, and turn alerts on here."
            : on
              ? "On. You'll get a notification when a game goes live and when it ends."
              : "A notification when a game goes live and when it ends, so you can watch and vote."}
        </div>
        {note && (
          <div role="status" className="mt-1 text-xs">
            {note}
          </div>
        )}
      </div>
      {support === "yes" && on !== null && (
        <Button size="sm" variant={on ? "outline" : "default"} disabled={busy} onClick={() => void toggle()}>
          {on ? <BellOff aria-hidden /> : <Bell aria-hidden />}
          {on ? "Turn off" : "Turn on"}
        </Button>
      )}
    </div>
  )
}
