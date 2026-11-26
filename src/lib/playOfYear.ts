import type { SupabaseClient } from "@supabase/supabase-js"
import { deviceKey } from "@/lib/deviceKey"
import type { PlayOfYear, PooleanState } from "@/lib/types"

// Play of the Year: the season's best shareable plays in a bracket (8 or 16, seeded by bestClips' order), voted on from any phone, one
// vote per phone per match (the poty_votes table, written only through cast_poty_vote, supabase/poty.sql). Two ways to run it:
// live (the default), everyone in the same room voting on one matchup at a time, which the editor opens and closes (openMatch, closed);
// or over days, rounds opening one after another for `days` days each from startAt. A match goes to the play with more votes once it
// closes; a tie goes to the higher seed. Votes for a play that is not in the match (it lost earlier) are ignored, and the server takes a
// vote only for the open matchup (live) or the open round (over days).
export const ROUND_DAYS = 3

export interface PotyVote {
  bracket: string
  match: string
  pick: string
  owner: string
}

export interface Match {
  id: string // r<round>m<index>
  round: number
  a: string | null // share id, null until the earlier match is decided
  b: string | null
  votesA: number
  votesB: number
  winner: string | null // set once the round has closed
  open: boolean
}

export interface Bracket {
  rounds: Match[][]
  champion: string | null
  current: number | null // the round open now
  opensAt: (round: number) => Date
  closesAt: (round: number) => Date
}

// Standard seeding: 1 v 16, 8 v 9, ... so the top seeds meet last.
export function seedOrder(n: number): number[] {
  let order = [1]
  while (order.length < n) {
    const m = order.length * 2 + 1
    order = order.flatMap((s) => [s, m - s])
  }
  return order
}

export const currentBracket = (state: PooleanState): PlayOfYear | null => state.playOfYear?.at(-1) ?? null

export function bracket(p: PlayOfYear, votes: PotyVote[], now: Date = new Date()): Bracket {
  const n = p.seeds.length
  const roundsN = Math.round(Math.log2(n))
  const start = new Date(p.startAt).getTime()
  const span = p.days * 86_400_000
  const opensAt = (r: number) => new Date(start + r * span)
  const closesAt = (r: number) => new Date(start + (r + 1) * span)
  const seedOf = new Map(p.seeds.map((s, i) => [s, i]))
  const order = seedOrder(n)
  const rounds: Match[][] = []
  let entrants: (string | null)[] = order.map((s) => p.seeds[s - 1] ?? null)
  let current: number | null = null
  const shut = new Set(p.closed ?? [])
  for (let r = 0; r < roundsN; r++) {
    const ms: Match[] = []
    const roundClosed = now.getTime() >= closesAt(r).getTime()
    const roundOpen = now.getTime() >= opensAt(r).getTime() && !roundClosed
    if (!p.live && roundOpen) current = r
    for (let i = 0; i < entrants.length / 2; i++) {
      const id = `r${r}m${i}`
      const closed = p.live ? shut.has(id) : roundClosed
      const open = p.live ? p.openMatch === id : roundOpen
      if (p.live && open) current = r
      const a = entrants[2 * i]
      const b = entrants[2 * i + 1]
      const mine = votes.filter((v) => v.bracket === p.id && v.match === id)
      const votesA = a ? mine.filter((v) => v.pick === a).length : 0
      const votesB = b ? mine.filter((v) => v.pick === b).length : 0
      let winner: string | null = null
      if (closed && a && b) winner = votesA > votesB ? a : votesB > votesA ? b : seedOf.get(a)! < seedOf.get(b)! ? a : b
      else if (closed) winner = a ?? b
      ms.push({ id, round: r, a, b, votesA, votesB, winner, open: open && !!a && !!b })
    }
    rounds.push(ms)
    entrants = ms.map((m) => m.winner)
  }
  const final = rounds.at(-1)?.[0]
  return { rounds, champion: final?.winner ?? null, current, opensAt, closesAt }
}

export const roundName = (round: number, rounds: number) => {
  const left = rounds - round
  return left === 1 ? "Final" : left === 2 ? "Semifinals" : left === 3 ? "Quarterfinals" : `Round of ${2 ** left}`
}

// Every finished bracket's winner, for the Hall of Fame.
export function potyWinners(state: PooleanState, votes: PotyVote[], now: Date = new Date()): { label: string; id: string }[] {
  return (state.playOfYear ?? []).flatMap((p) => {
    const c = bracket(p, votes, now).champion
    return c ? [{ label: p.label, id: c }] : []
  })
}

// Database side (supabase/poty.sql).

export async function loadPoty(client: SupabaseClient, bracketId?: string): Promise<PotyVote[]> {
  let q = client.from("poty_votes").select("bracket,match,pick,owner_hash")
  if (bracketId) q = q.eq("bracket", bracketId)
  const { data, error } = await q
  if (error || !data) return []
  return data.map((r) => ({ bracket: String(r.bracket), match: String(r.match), pick: String(r.pick), owner: String(r.owner_hash) }))
}

export async function castPoty(client: SupabaseClient, bracketId: string, match: string, pick: string): Promise<boolean> {
  const { data, error } = await client.rpc("cast_poty_vote", { p_bracket: bracketId, p_match: match, p_pick: pick, p_key: deviceKey() })
  return !error && data === true
}

// This phone's owner hash, to find its own votes among everyone's.
export async function myOwner(): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(deviceKey()))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("")
}

// A new bracket from the season's best shareable plays (never rough, never a still), 16 when there are enough, else 8.
export function newBracket(seeds: string[], label: string, now: Date = new Date(), live = true): PlayOfYear | null {
  const n = seeds.length >= 16 ? 16 : seeds.length >= 8 ? 8 : 0
  if (!n) return null
  const p: PlayOfYear = { id: `poty${now.getTime().toString(36)}`, label, seeds: seeds.slice(0, n), startAt: now.toISOString(), days: ROUND_DAYS }
  return live ? { ...p, live: true, openMatch: null, closed: [] } : p
}

// Live brackets: the next matchup to open (both plays known, not closed yet), in bracket order.
export function nextMatch(b: Bracket): Match | null {
  for (const ms of b.rounds) for (const m of ms) if (!m.winner && m.a && m.b && !m.open) return m
  return null
}
const stamp = () => new Date().toISOString()
export const openMatch = (p: PlayOfYear, id: string): PlayOfYear => ({ ...p, openMatch: id, lastAt: stamp() })
export const closeMatch = (p: PlayOfYear): PlayOfYear => (p.openMatch ? { ...p, openMatch: null, closed: [...(p.closed ?? []), p.openMatch], lastAt: stamp() } : p)
// Takes back the last close (a mistaken tap), reopening that matchup.
export const undoClose = (p: PlayOfYear): PlayOfYear => (p.closed?.length && !p.openMatch ? { ...p, openMatch: p.closed.at(-1)!, closed: p.closed.slice(0, -1), lastAt: stamp() } : p)
// A live vote in progress: a matchup open, or one closed in the last two hours with more to go. Phones refresh faster then.
export const liveVoting = (p: PlayOfYear | null | undefined, now = Date.now()): boolean =>
  !!p?.live && (!!p.openMatch || ((p.closed?.length ?? 0) < p.seeds.length - 1 && !!p.lastAt && now - Date.parse(p.lastAt) < 2 * 3_600_000))
// Replaces the newest bracket.
export const putBracket = (s: PooleanState, p: PlayOfYear): PooleanState => ({ ...s, playOfYear: [...(s.playOfYear ?? []).slice(0, -1), p] })
