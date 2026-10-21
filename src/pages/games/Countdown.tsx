import { useEffect, useState } from "react"
import { countdownTo } from "@/lib/weather"

// "Starts in 2:02:41", ticking each second inside the last day.
export function Countdown({ date, time, className }: { date: string; time?: string; className?: string }) {
  const [now, setNow] = useState(() => new Date())
  const c = countdownTo(date, time, now)
  const live = c?.live
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [live])
  if (!c) return null
  return <span className={className}>{c.text}</span>
}
