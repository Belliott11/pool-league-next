import { useEffect, useState } from "react"

// The league plays in Cherry Hill, NJ. The forecast comes from Open-Meteo, which needs no key.
const URL_BASE = "https://api.open-meteo.com/v1/forecast?latitude=39.9348&longitude=-75.0307&hourly=temperature_2m,precipitation_probability,weathercode&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=16"

export interface Evening {
  tempF: number
  rainPct: number
  label: string
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

// The evening of one date, 5 to 9 PM: the average temperature, the worst chance of rain, and the most common sky.
export function eveningOf(h: Hourly, date: string): Evening | null {
  const idx = h.time.map((t, i) => (t.startsWith(date) && +t.slice(11, 13) >= 17 && +t.slice(11, 13) <= 21 ? i : -1)).filter((i) => i >= 0)
  if (idx.length === 0) return null
  const tempF = Math.round(idx.reduce((s, i) => s + h.temperature_2m[i], 0) / idx.length)
  const rainPct = Math.max(...idx.map((i) => h.precipitation_probability[i] ?? 0))
  const codes = idx.map((i) => h.weathercode[i])
  const worst = Math.max(...codes)
  return { tempF, rainPct, label: describe(worst >= 51 ? worst : codes[Math.floor(codes.length / 2)]) }
}

// "Tonight", "Tomorrow" or "In 5 days"; null for a date in the past.
export function countdownLabel(date: string, today = new Date().toLocaleDateString("en-CA")): string | null {
  const days = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000)
  if (days < 0) return null
  return days === 0 ? "Tonight" : days === 1 ? "Tomorrow" : `In ${days} days`
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
export function useEvening(date: string | undefined): Evening | null {
  const [e, setE] = useState<Evening | null>(null)
  useEffect(() => {
    setE(null)
    if (!date || countdownLabel(date) === null) return
    let live = true
    void forecast().then((h) => live && h && setE(eveningOf(h, date)))
    return () => {
      live = false
    }
  }, [date])
  return e
}
