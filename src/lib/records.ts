import { playerLine, scoreOf, type PlayerLine } from "@/lib/nightRecap"
import type { PooleanState } from "@/lib/types"

// League single-game records, and what a night did to them. Rebounds, assists and the rest need a box score;
// points also count games that were only scored live.
export type RecordKey = "pts" | "reb" | "ast" | "stl" | "blk" | "tpm" | "twoWay"
export const RECORD_KEYS: RecordKey[] = ["pts", "reb", "ast", "stl", "blk", "tpm", "twoWay"]
export const RECORD_LABEL: Record<RecordKey, string> = { pts: "Points", reb: "Rebounds", ast: "Assists", stl: "Steals", blk: "Blocks", tpm: "Threes made", twoWay: "Two-way score" }

export interface RecordRow {
  key: RecordKey
  value: number
  playerId: string
  date: string
  gameId: string
}

interface Entry {
  gameId: string
  date: string
  playerId: string
  line: PlayerLine
}

function valueOf(line: PlayerLine, key: RecordKey): number | null {
  if (key === "pts") return line.pts
  if (!line.box) return null
  return key === "twoWay" ? line.twoWay : line[key]
}

// Every player-game from finished games, oldest first.
function entries(state: PooleanState, before?: string): Entry[] {
  const out: Entry[] = []
  const games = state.games.filter((g) => !g.liveInProgress && g.date && (before === undefined || g.date < before))
  games.sort((a, b) => a.date.localeCompare(b.date))
  for (const g of games) {
    const [a, b] = scoreOf(g)
    if (a === 0 && b === 0) continue
    for (const id of [...g.teamA, ...g.teamB]) out.push({ gameId: g.id, date: g.date, playerId: id, line: playerLine(g, id) })
  }
  return out
}

function bookFrom(list: Entry[]): Partial<Record<RecordKey, RecordRow>> {
  const book: Partial<Record<RecordKey, RecordRow>> = {}
  for (const e of list) {
    for (const key of RECORD_KEYS) {
      const v = valueOf(e.line, key)
      if (v === null || v <= 0) continue
      const cur = book[key]
      // The first to set a mark keeps it when it is later tied.
      if (!cur || v > cur.value) book[key] = { key, value: v, playerId: e.playerId, date: e.date, gameId: e.gameId }
    }
  }
  return book
}

// The record book, optionally as it stood before a date.
export function recordBook(state: PooleanState, before?: string): Partial<Record<RecordKey, RecordRow>> {
  return bookFrom(entries(state, before))
}

export interface Callout {
  kind: "record" | "tied" | "careerHigh"
  key: RecordKey
  playerId: string
  value: number
  previous: number
  holderId?: string
}

const CAREER_KEYS: RecordKey[] = ["pts", "reb", "ast"]
const MIN_GAMES_FOR_CAREER_HIGH = 3

// What a night did to the record book: new records, ties, and personal bests. Nothing is called out for the
// league's very first games, when everything would be a record.
export function nightCallouts(state: PooleanState, date: string): Callout[] {
  const prior = entries(state, date)
  if (prior.length === 0) return []
  const book = bookFrom(prior)
  const tonight = entries(state).filter((e) => e.date === date)
  const out: Callout[] = []

  for (const key of RECORD_KEYS) {
    const rec = book[key]
    if (!rec) continue
    let best: Entry | null = null
    let bestV = 0
    for (const e of tonight) {
      const v = valueOf(e.line, key)
      if (v !== null && v > bestV) {
        best = e
        bestV = v
      }
    }
    if (!best) continue
    if (bestV > rec.value) out.push({ kind: "record", key, playerId: best.playerId, value: bestV, previous: rec.value, holderId: rec.playerId })
    else if (bestV === rec.value) out.push({ kind: "tied", key, playerId: best.playerId, value: bestV, previous: rec.value, holderId: rec.playerId })
  }

  // Personal bests, for players who have played enough for it to mean something.
  const isRecord = new Set(out.filter((c) => c.kind === "record").map((c) => `${c.playerId}|${c.key}`))
  const byPlayer = new Map<string, Entry[]>()
  prior.forEach((e) => byPlayer.set(e.playerId, [...(byPlayer.get(e.playerId) ?? []), e]))
  for (const key of CAREER_KEYS) {
    const done = new Set<string>()
    for (const e of tonight) {
      const v = valueOf(e.line, key)
      const before = byPlayer.get(e.playerId) ?? []
      if (v === null || v <= 0 || before.length < MIN_GAMES_FOR_CAREER_HIGH || done.has(e.playerId) || isRecord.has(`${e.playerId}|${key}`)) continue
      const prev = Math.max(0, ...before.map((p) => valueOf(p.line, key) ?? 0))
      const nightBest = Math.max(...tonight.filter((t) => t.playerId === e.playerId).map((t) => valueOf(t.line, key) ?? 0))
      if (nightBest > prev && nightBest >= 5) {
        out.push({ kind: "careerHigh", key, playerId: e.playerId, value: nightBest, previous: prev })
        done.add(e.playerId)
      }
    }
  }
  return out
}

export interface Chaser {
  key: RecordKey
  playerId: string
  best: number // their best single game in this stat
  gap: number // how far that is from the record
  holderId: string
  value: number // the record
}

// Who is closest to each league record: the best single game by anyone who does not hold it, and the gap. Ranked
// by how small the gap is next to the record, so one point away from a 5 outranks 2 away from a 40.
export function chasers(state: PooleanState, limit = 4): Chaser[] {
  const list = entries(state)
  const book = bookFrom(list)
  const out: Chaser[] = []
  for (const key of RECORD_KEYS) {
    const rec = book[key]
    if (!rec || key === "twoWay") continue
    const bestBy = new Map<string, number>()
    for (const e of list) {
      const v = valueOf(e.line, key)
      if (v !== null && e.playerId !== rec.playerId && v > (bestBy.get(e.playerId) ?? 0)) bestBy.set(e.playerId, v)
    }
    const top = [...bestBy.entries()].sort((a, b) => b[1] - a[1])[0]
    if (!top || top[1] >= rec.value) continue
    const gap = rec.value - top[1]
    if (gap <= Math.max(2, rec.value * 0.25)) out.push({ key, playerId: top[0], best: top[1], gap, holderId: rec.playerId, value: rec.value })
  }
  return out.sort((a, b) => a.gap / a.value - b.gap / b.value).slice(0, limit)
}
