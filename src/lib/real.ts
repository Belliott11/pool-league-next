// The real Poolean site's own exported history (poolean-external-data.js on the classic site,
// converted to JSON verbatim). Read-only reference data, not part of the editable app state.
import data from "@/data/poolean-seasons.json"
import type { PooleanState } from "./types"

export interface PairRecord {
  w: number
  l?: number
  gp: number
}

export interface RealGame {
  n: number
  date: string
  a: string[]
  b: string[]
  w: "A" | "B"
  created?: string
}

export interface RealSeason {
  rankings: { date: string; players: { slug: string; rank: number; fieldSize: number; pct: number }[] }[]
  together: Record<string, PairRecord>
  against: Record<string, PairRecord>
  cards: Record<string, { powerPct: number; parties: number }>
  games: RealGame[]
  names: Record<string, string>
}

const seasons = data.seasons as unknown as Record<string, RealSeason>

// app.js's realSeasonsInOrder().
export function realSeasonsInOrder(): RealSeason[] {
  return (data.list as string[]).map((y) => seasons[String(y)]).filter(Boolean)
}

// The season the classic site's header picker defaults to: the latest one.
export function currentRealSeason(): RealSeason | null {
  const list = data.list as string[]
  return seasons[list[list.length - 1]] ?? null
}

// app.js's poolNameOf(): the local roster name, else the real site's name, else the slug.
export function poolNameOf(state: PooleanState, slug: string): string {
  const p = state.players.find((x) => x.id === slug)
  if (p) return p.name
  return currentRealSeason()?.names[slug] || slug
}
