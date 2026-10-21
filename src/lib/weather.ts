import { useEffect, useState } from "react"

// The league plays in Cherry Hill, NJ. The forecast comes from Open-Meteo, which needs no key.
const URL_BASE = "https://api.open-meteo.com/v1/forecast?latitude=39.9348&longitude=-75.0307&hourly=temperature_2m,precipitation_probability,weathercode&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=16"

export interface Evening {
  tempF: number
  rainPct: number
  label: string
  from: number // first hour of the window, 0 to 23
  to: number // last hour
}
interface Hourly {
  time: string[]
  temperature_2m: number[]
  precipitation_probability: number[]
  weathercode: number[]
}

export function describe(code: number): string {
  if (code === 0) return "Clear"
  if (code <= 2) return "Partly cloudy"
  if (code === 3) return "Cloudy"
  if (code === 45 || code === 48) return "Fog"
  if (code >= 51 && code <= 57) return "Drizzle"
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rain"
  if (code >= 71 && code <= 77) return "Snow"
  if (code >= 95) return "Thunderstorms"
  return "Cloudy"
}

// The playing hours of one date (5 to 9 PM unless told otherwise): the average temperature, the worst chance of rain, and the sky.
export function eveningOf(h: Hourly, date: string, from = 17, to = 21): Evening | null {
  const idx = h.time.map((t, i) => (t.startsWith(date) && +t.slice(11, 13) >= from && +t.slice(11, 13) <= to ? i : -1)).filter((i) => i >= 0)
  if (idx.length === 0) return null
  const tempF = Math.round(idx.reduce((s, i) => s + h.temperature_2m[i], 0) / idx.length)
  const rainPct = Math.max(...idx.map((i) => h.precipitation_probability[i] ?? 0))
  const codes = idx.map((i) => h.weathercode[i])
  const worst = Math.max(...codes)
  return { tempF, rainPct, from, to, label: describe(worst >= 51 ? worst : codes[Math.floor(codes.length / 2)]) }
}

// "Tonight", "Tomorrow" or "In 5 days"; null for a date in the past.
export function countdownLabel(date: string, today = new Date().toLocaleDateString("en-CA")): string | null {
  const days = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000)
  if (days < 0) return null
  return days === 0 ? "Tonight" : days === 1 ? "Tomorrow" : `In ${days} days`
}

// With a start time: "Starts in 2:02:41" inside the last 24 hours (live), "In 3 days" before that, and
// "Started" once it has begun. Without one it is the day count.
export function countdownTo(date: string, time: string | undefined, now = new Date()): { text: string; live: boolean } | null {
  if (!time) {
    const d = countdownLabel(date, now.toLocaleDateString("en-CA"))
    return d ? { text: d, live: false } : null
  }
  const ms = new Date(`${date}T${time}:00`).getTime() - now.getTime()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return ms > -6 * 3600 * 1000 ? { text: "Started", live: false } : null
  if (ms < 24 * 3600 * 1000) {
    const s = Math.floor(ms / 1000)
    const p = (n: number) => String(n).padStart(2, "0")
    return { text: `Starts in ${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`, live: true }
  }
  const days = Math.floor(ms / 86400000)
  return { text: `In ${days} day${days === 1 ? "" : "s"}`, live: false }
}

let cache: { at: number; hourly: Hourly } | null = null

async function forecast(): Promise<Hourly | null> {
  if (cache && Date.now() - cache.at < 30 * 60 * 1000) return cache.hourly
  try {
    const r = await fetch(URL_BASE)
    if (!r.ok) return null
    const hourly = (await r.json()).hourly as Hourly
    cache = { at: Date.now(), hourly }
    return hourly
  } catch {
    return null
  }
}

// The evening forecast for a date within the next 15 days, or null (too far off, past, or no connection).
export function useEvening(date: string | undefined, time?: string): Evening | null {
  const start = time ? +time.slice(0, 2) : null
  const [e, setE] = useState<Evening | null>(null)
  useEffect(() => {
    setE(null)
    if (!date || countdownLabel(date) === null) return
    let live = true
    void forecast().then((h) => live && h && setE(start === null ? eveningOf(h, date) : eveningOf(h, date, start, Math.min(23, start + 3))))
    return () => {
      live = false
    }
  }, [date, start])
  return e
}
