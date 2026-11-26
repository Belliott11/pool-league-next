import weatherFile from "@/data/night-weather.json"
import { countsForBeatRate } from "@/lib/beatRate"
import type { Game, PooleanState } from "@/lib/types"

// Does the weather change the game? Each filmed game gets the weather of its hour (the live start time when there is one, else the
// night's 5 to 9 PM average) from src/data/night-weather.json (saved nightly by scripts/night-weather.mjs). Games are split at the
// median temperature into warmer and cooler, and at half cloud cover into sunnier and cloudier, and shooting is compared across each
// split: field goal percentage (2s and 3s), points per shot and how many shots are 3s. A difference is called real only when it is more
// than twice its standard error; shots within a night are not independent, so even that is generous, and nothing is shown to visitors
// before MIN_NIGHTS filmed nights. Players: their own shooting warmer against cooler, at 10+ shots each side, leaning toward no
// difference by LEAN shots.
export const MIN_NIGHTS = 6
export const MIN_SIDE_SHOTS = 10
export const LEAN = 20

export interface Hour {
  t: number
  feels: number
  rh: number
  cloud: number
  wind: number
  code: number
}
type WeatherFile = Record<string, { source: string; hours: Record<string, Hour> }>
const WEATHER = weatherFile as WeatherFile

export interface GameWeather {
  t: number
  cloud: number
  rh: number
  wind: number
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)

// The weather a game was played in, or null when that night has not been saved.
export function weatherOf(g: Game, file: WeatherFile = WEATHER): GameWeather | null {
  const night = file[g.date]
  if (!night) return null
  let hours: Hour[] = []
  if (g.startedAt) {
    const hr = +new Date(g.startedAt).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false })
    const h = night.hours[String(hr)]
    if (h) hours = [h]
  }
  if (!hours.length) hours = [17, 18, 19, 20, 21].map((h) => night.hours[String(h)]).filter((h): h is Hour => !!h)
  if (!hours.length) return null
  return { t: avg(hours.map((h) => h.t)), cloud: avg(hours.map((h) => h.cloud)), rh: avg(hours.map((h) => h.rh)), wind: avg(hours.map((h) => h.wind)) }
}

export interface Side {
  games: number
  nights: number
  shots: number
  makes: number
  points: number
  threes: number
  fg: number
  pps: number
  threeShare: number
}

export interface Split {
  label: [string, string] // e.g. ["Warmer", "Cooler"]
  cut: string // e.g. "81°F and up"
  a: Side
  b: Side
  fgDiff: number // a minus b, percentage points
  fgSe: number
  real: boolean
}

export interface NightRow {
  date: string
  t: number
  cloud: number
  shots: number
  fg: number
  pps: number
}

export interface PlayerSplit {
  id: string
  warmShots: number
  coolShots: number
  warmFg: number
  coolFg: number
  lean: number // percentage points, warmer minus cooler, leaned toward zero
}

export interface WeatherGame {
  nights: NightRow[]
  ready: boolean
  temp: Split | null
  sky: Split | null
  players: PlayerSplit[]
}

const shotsOf = (g: Game) => g.scoringEvents.filter((e) => e.points === 2 || e.points === 3)

function side(games: Game[], pid?: string): Side {
  let shots = 0
  let makes = 0
  let points = 0
  let threes = 0
  for (const g of games)
    for (const e of shotsOf(g)) {
      if (pid && e.scorerId !== pid) continue
      shots++
      if (e.points === 3) threes++
      if (e.made !== false) {
        makes++
        points += e.points
      }
    }
  return { games: games.length, nights: new Set(games.map((g) => g.date)).size, shots, makes, points, threes, fg: shots ? makes / shots : 0, pps: shots ? points / shots : 0, threeShare: shots ? threes / shots : 0 }
}

function split(label: [string, string], cut: string, a: Game[], b: Game[]): Split | null {
  if (!a.length || !b.length) return null
  const sa = side(a)
  const sb = side(b)
  if (!sa.shots || !sb.shots) return null
  const fgDiff = (sa.fg - sb.fg) * 100
  const fgSe = Math.sqrt((sa.fg * (1 - sa.fg)) / sa.shots + (sb.fg * (1 - sb.fg)) / sb.shots) * 100
  return { label, cut, a: sa, b: sb, fgDiff, fgSe, real: sa.nights >= 2 && sb.nights >= 2 && Math.abs(fgDiff) > 2 * fgSe }
}

export function weatherGame(state: PooleanState, file: WeatherFile = WEATHER): WeatherGame {
  const rows = state.games
    .filter((g) => countsForBeatRate(g) && !g.test)
    .map((g) => ({ g, w: weatherOf(g, file) }))
    .filter((x): x is { g: Game; w: GameWeather } => !!x.w)
  const byNight = new Map<string, { g: Game; w: GameWeather }[]>()
  for (const r of rows) byNight.set(r.g.date, [...(byNight.get(r.g.date) ?? []), r])
  const nights: NightRow[] = [...byNight].map(([date, rs]) => {
    const s = side(rs.map((r) => r.g))
    return { date, t: avg(rs.map((r) => r.w.t)), cloud: avg(rs.map((r) => r.w.cloud)), shots: s.shots, fg: s.fg, pps: s.pps }
  }).sort((x, y) => x.date.localeCompare(y.date))
  if (!rows.length) return { nights, ready: false, temp: null, sky: null, players: [] }

  const temps = rows.map((r) => r.w.t).sort((a, b) => a - b)
  const median = temps[Math.floor((temps.length - 1) / 2)]
  const warm = rows.filter((r) => r.w.t > median).map((r) => r.g)
  const cool = rows.filter((r) => r.w.t <= median).map((r) => r.g)
  const sunny = rows.filter((r) => r.w.cloud < 50).map((r) => r.g)
  const cloudy = rows.filter((r) => r.w.cloud >= 50).map((r) => r.g)
  const temp = split(["Warmer", "Cooler"], `above ${Math.round(median)}°F`, warm, cool)
  const sky = split(["Sunnier", "Cloudier"], "under half cloud cover", sunny, cloudy)

  const ids = new Set(rows.flatMap((r) => shotsOf(r.g).map((e) => e.scorerId)))
  const players: PlayerSplit[] = []
  for (const id of ids) {
    const w = side(warm, id)
    const c = side(cool, id)
    if (w.shots < MIN_SIDE_SHOTS || c.shots < MIN_SIDE_SHOTS) continue
    const n = (2 * w.shots * c.shots) / (w.shots + c.shots)
    players.push({ id, warmShots: w.shots, coolShots: c.shots, warmFg: w.fg, coolFg: c.fg, lean: (w.fg - c.fg) * 100 * (n / (n + LEAN)) })
  }
  players.sort((a, b) => Math.abs(b.lean) - Math.abs(a.lean))
  return { nights, ready: nights.length >= MIN_NIGHTS, temp, sky, players }
}
