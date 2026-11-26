// Saves each game night's weather in Cherry Hill, hour by hour from 3 PM to 11 PM, in src/data/night-weather.json, for "Does the
// weather change the game?" (src/lib/heat.ts). Run nightly by .github/workflows/night-weather.yml, which commits the file.
//   node scripts/night-weather.mjs
// Open-Meteo's archive (no key) has every past day after about five days; newer nights come from its forecast service's recent past
// and are fetched again, from the archive, once that has them. Nights already saved from the archive are left alone.
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const OUT = path.join(root, "src/data/night-weather.json")
const PLACE = "latitude=39.9348&longitude=-75.0307"
const VARS = "temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,wind_speed_10m,weather_code"
const UNITS = "temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York"
const FROM_HOUR = 15
const TO_HOUR = 23

const cfg = JSON.parse(fs.readFileSync(path.join(root, "public/cloud-config.json"), "utf8"))
const res = await fetch(`${cfg.url}/rest/v1/league_state?select=data&id=eq.1`, { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` } })
if (!res.ok) throw new Error(`league data: ${res.status}`)
const [{ data }] = await res.json()

const saved = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {}
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
const daysAgo = (d) => Math.round((Date.parse(today) - Date.parse(d)) / 86400000)
const dates = [...new Set(data.games.filter((g) => !g.test && !g.liveInProgress && g.date).map((g) => g.date))].filter((d) => d <= today).sort()
const todo = dates.filter((d) => saved[d]?.source !== "archive")

async function hourly(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return (await r.json()).hourly
}

let changed = 0
for (const d of todo) {
  const recent = daysAgo(d) <= 5
  const url = recent
    ? `https://api.open-meteo.com/v1/forecast?${PLACE}&hourly=${VARS}&${UNITS}&past_days=7&forecast_days=1`
    : `https://archive-api.open-meteo.com/v1/archive?${PLACE}&start_date=${d}&end_date=${d}&hourly=${VARS}&${UNITS}`
  const h = await hourly(url)
  const hours = {}
  h.time.forEach((t, i) => {
    if (!t.startsWith(d)) return
    const hr = +t.slice(11, 13)
    if (hr < FROM_HOUR || hr > TO_HOUR || h.temperature_2m[i] == null) return
    hours[hr] = { t: h.temperature_2m[i], feels: h.apparent_temperature[i], rh: h.relative_humidity_2m[i], cloud: h.cloud_cover[i], wind: h.wind_speed_10m[i], code: h.weather_code[i] }
  })
  if (!Object.keys(hours).length) continue
  saved[d] = { source: recent ? "forecast" : "archive", hours }
  changed++
}

if (changed) {
  const sorted = Object.fromEntries(Object.keys(saved).sort().map((k) => [k, saved[k]]))
  fs.writeFileSync(OUT, JSON.stringify(sorted, null, 1) + "\n")
}
console.log(`Weather: ${dates.length} game nights, ${changed} fetched, ${Object.keys(saved).length} saved.`)
