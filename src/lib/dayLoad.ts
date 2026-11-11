import { oldGames } from "@/lib/hallOfFame"
import type { RealGame } from "@/lib/real"
import type { Game, PooleanState } from "@/lib/types"
import { gameKey, results, type Result } from "@/lib/winImpact"

// How many games each player had already played that day, derived from the order of results with no new tagging. It counts every
// old-site result (which has rosters for games that were never filmed) and every app game the old site does not have, in play
// order within the night: the old site's own order, then app-only games.
export interface Load {
  before: number // games earlier that day
  streak: number // consecutive games up to and including this one (1 when they sat the one before)
}
export interface Slot {
  result: Result
  loads: Map<string, Load>
}

export const BANDS = [
  { key: "0-2", label: "0 to 2 earlier", lo: 0, hi: 2 },
  { key: "3-5", label: "3 to 5 earlier", lo: 3, hi: 5 },
  { key: "6+", label: "6 or more", lo: 6, hi: Infinity },
] as const
export const LOW_SAMPLE = 10 // games in a group before its record is worth reading

export function slots(state: PooleanState, old: RealGame[] = oldGames()): Slot[] {
  const ordered = results(state, old)
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.night.localeCompare(b.r.night) || a.i - b.i)
    .map((x) => x.r)
  const out: Slot[] = []
  let night = ""
  let count = new Map<string, number>()
  let streak = new Map<string, number>()
  let prev = new Set<string>()
  for (const r of ordered) {
    if (r.night !== night) {
      night = r.night
      count = new Map()
      streak = new Map()
      prev = new Set()
    }
    const here = [...r.a, ...r.b]
    const loads = new Map<string, Load>()
    for (const p of here) {
      const s = prev.has(p) ? (streak.get(p) ?? 0) + 1 : 1
      loads.set(p, { before: count.get(p) ?? 0, streak: s })
    }
    for (const p of here) {
      count.set(p, (count.get(p) ?? 0) + 1)
      streak.set(p, loads.get(p)!.streak)
    }
    for (const p of [...streak.keys()]) if (!here.includes(p)) streak.set(p, 0)
    prev = new Set(here)
    out.push({ result: r, loads })
  }
  return out
}

// The loads for one app game: the slot with its teams on its night, taking the n-th one when the same teams played again.
export function loadsFor(state: PooleanState, game: Game, old: RealGame[] = oldGames()): Map<string, Load> | null {
  const key = gameKey(game.date, game.teamA, game.teamB)
  const same = state.games.filter((g) => gameKey(g.date, g.teamA, g.teamB) === key)
  const nth = Math.max(0, same.findIndex((g) => g.id === game.id))
  const hits = slots(state, old).filter((s) => gameKey(s.result.night, s.result.a, s.result.b) === key)
  return (hits[Math.min(nth, hits.length - 1)] ?? null)?.loads ?? null
}

export const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] ?? "th"}`
export const loadText = (l: Load) => `${ordinal(l.before + 1)} game today${l.streak >= 2 ? `, ${l.streak} in a row` : ""}`

export interface Band {
  w: number
  l: number
}
export interface FatigueRow {
  id: string // a player, or "" for the whole league
  bands: Record<(typeof BANDS)[number]["key"], Band>
}

const bandOf = (before: number) => BANDS.find((b) => before >= b.lo && before <= b.hi)!.key

// Each player's record by how many games they had already played that day, plus the whole league as one row.
export function fatigue(state: PooleanState, old: RealGame[] = oldGames()): FatigueRow[] {
  const by = new Map<string, FatigueRow>()
  const row = (id: string) => by.get(id) ?? by.set(id, { id, bands: { "0-2": { w: 0, l: 0 }, "3-5": { w: 0, l: 0 }, "6+": { w: 0, l: 0 } } }).get(id)!
  for (const s of slots(state, old)) {
    for (const [side, won] of [[s.result.a, s.result.aWon], [s.result.b, !s.result.aWon]] as const) {
      for (const p of side) {
        const k = bandOf(s.loads.get(p)!.before)
        for (const r of [row(p), row("")]) won ? r.bands[k].w++ : r.bands[k].l++
      }
    }
  }
  return [...by.values()].sort((a, b) => (a.id === "" ? -1 : b.id === "" ? 1 : total(b) - total(a)))
}
export const total = (r: FatigueRow) => Object.values(r.bands).reduce((n, b) => n + b.w + b.l, 0)
