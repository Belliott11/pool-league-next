import type { SupabaseClient } from "@supabase/supabase-js"
import { awardRace } from "@/lib/awardRace"
import { AWARD_TEXT } from "@/lib/awardText"
import { deviceKey } from "@/lib/deviceKey"
import { isCurrentSeasonGame } from "@/lib/stats"
import { MIN_GAMES as MIN_RANKED } from "@/lib/ratings"
import type { AwardBallot, PooleanState } from "@/lib/types"

// Season awards voted by the players, set beside what the numbers say (awardRace.ts). The editor starts a ballot at the end of a season;
// every player ranks the candidates for each award from their own phone ("Who are you?" picks who they are), never themselves, as many
// as they like; the winner is found by instant runoff (`runoff`); then the editor
// closes voting and reveals the awards one at a time, MVP last, at a party. Votes are secret until an award is revealed: the
// award_votes table cannot be read by visitors, and the database hands out only vote counts, this phone's own votes, and the picks for
// awards already revealed (supabase/awards.sql).

export type AwardKind = "single" | "teams" | "duo"

export interface AwardDef {
  key: string
  label: string
  kind: AwardKind // one winner, the two All-Poolean teams from one ranking, or a pair of players
  description: string // what the award rewards (awardText.ts)
}

// Every award last season had in Poolean (pastAwards.ts), in reveal order: the duos first, MVP last. The teams are one vote: a ballot
// ranks players, places 1 to 3 make the first team and 4 to 6 the second (`places`). A duo ballot ranks pairs ("a|b", sorted ids).
export const AWARDS: AwardDef[] = (
  [
    ["worst-duo", "Rough-patch Duo", "duo"],
    ["best-duo", "Best Duo", "duo"],
    ["teammate", "Best Teammate", "single"],
    ["mip-yoy", "Most Improved (year over year)", "single"],
    ["mip-season", "Most Improved (this season)", "single"],
    ["clutch", "Clutch Player", "single"],
    ["dpoy", "Defensive Player", "single"],
    ["teams", "First and Second Team", "teams"],
    ["best-player", "Best Player", "single"],
    ["mvp", "MVP", "single"],
  ] as const
).map(([key, label, kind]) => ({ key, label, kind, description: AWARD_TEXT[key] }))
export const awardDef = (k: string) => AWARDS.find((a) => a.key === k) ?? null

// A pair's id: both players, sorted, so the same two always make the same pair however they were tapped.
export const pairId = (a: string, b: string) => [a, b].sort().join("|")
export const pairOf = (id: string) => id.split("|")

// Anyone with MIN_RANKED games this season can be voted for (the same bar as the award race and the standings).
export function candidatesFor(state: PooleanState): string[] {
  const played = new Map<string, number>()
  for (const g of state.games) {
    if (g.liveInProgress || g.test || !isCurrentSeasonGame(state, g)) continue
    for (const id of [...g.teamA, ...g.teamB]) played.set(id, (played.get(id) ?? 0) + 1)
  }
  return state.players.filter((p) => (played.get(p.id) ?? 0) >= MIN_RANKED).map((p) => p.id)
}

export function newBallot(state: PooleanState, label: string, now: Date = new Date()): AwardBallot | null {
  const candidates = candidatesFor(state)
  if (candidates.length < 3) return null
  return { id: `aw${now.getTime().toString(36)}`, label, awards: AWARDS.map((a) => a.key), candidates, open: true, revealed: 0, startedAt: now.toISOString(), lastAt: now.toISOString() }
}

export const currentBallot = (state: PooleanState): AwardBallot | null => state.awardBallots?.at(-1) ?? null
export const putBallot = (s: PooleanState, b: AwardBallot): PooleanState => ({ ...s, awardBallots: [...(s.awardBallots ?? []).slice(0, -1), b] })
export const addBallot = (s: PooleanState, b: AwardBallot): PooleanState => ({ ...s, awardBallots: [...(s.awardBallots ?? []), b] })

export const closeVoting = (b: AwardBallot, now = new Date()): AwardBallot => ({ ...b, open: false, lastAt: now.toISOString() })
export const reopenVoting = (b: AwardBallot, now = new Date()): AwardBallot => (b.revealed > 0 ? b : { ...b, open: true, lastAt: now.toISOString() })
// Revealing closes voting first, so nobody can vote once a winner is known.
export const revealNext = (b: AwardBallot, now = new Date()): AwardBallot => ({ ...b, open: false, revealed: Math.min(b.awards.length, b.revealed + 1), lastAt: now.toISOString() })
export const undoReveal = (b: AwardBallot, now = new Date()): AwardBallot => ({ ...b, revealed: Math.max(0, b.revealed - 1), lastAt: now.toISOString() })
export const finished = (b: AwardBallot) => b.revealed >= b.awards.length

// Phones refresh quickly while a reveal is going: voting closed, awards left to reveal, and something happened in the last two hours.
export const revealing = (b: AwardBallot | null | undefined, now = Date.now()): boolean =>
  !!b && !b.open && !finished(b) && !!b.lastAt && now - Date.parse(b.lastAt) < 2 * 3_600_000

// The home page shows the card while voting is open or a reveal is going, and for three weeks after the last award.
export const showCard = (b: AwardBallot | null | undefined, now = Date.now()): boolean =>
  !!b && (b.open || !finished(b) || now - Date.parse(b.lastAt ?? b.startedAt) < 21 * 86_400_000)

export interface Round {
  counts: { id: string; n: number }[] // each player still in, by ballots ranking them highest among those still in; most first
  out: string[] // knocked out after this round
  active: number // ballots still ranking someone still in
}

export interface Tally {
  winners: string[] // more than one only on a tie that cannot be broken
  rounds: Round[]
  total: number // ballots cast
}

// Instant runoff: every ballot counts for its highest-ranked player still in. A player with more than half of the ballots still
// counting wins. Otherwise the player (or players, on a tie) with the fewest is knocked out and their ballots move to their next
// choice; a ballot with nobody left on it stops counting. When everyone left is tied, they share the award.
export function runoff(ballots: string[][]): Tally {
  const total = ballots.length
  const rounds: Round[] = []
  const left = new Set(ballots.flat())
  while (left.size) {
    const m = new Map<string, number>([...left].map((id) => [id, 0]))
    let active = 0
    for (const b of ballots) {
      const top = b.find((id) => left.has(id))
      if (!top) continue
      m.set(top, m.get(top)! + 1)
      active++
    }
    const counts = [...m].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id))
    const most = counts[0].n
    if (most * 2 > active) {
      rounds.push({ counts, out: [], active })
      return { winners: [counts[0].id], rounds, total }
    }
    const fewest = counts[counts.length - 1].n
    if (fewest === most) {
      rounds.push({ counts, out: [], active })
      return { winners: active ? counts.map((c) => c.id) : [], rounds, total }
    }
    const out = counts.filter((c) => c.n === fewest).map((c) => c.id)
    rounds.push({ counts, out, active })
    for (const id of out) left.delete(id)
  }
  return { winners: [], rounds, total }
}

// The order the teams vote puts players in: the instant-runoff winner takes place 1, then is taken off every ballot and the count runs
// again for place 2, and so on (a tie takes the next places together). Places 1 to 3 are the first team, 4 to 6 the second.
export function places(ballots: string[][], n = 6): string[][] {
  const out: string[][] = []
  let left = ballots.map((b) => [...b])
  while (out.flat().length < n) {
    const t = runoff(left)
    if (!t.winners.length) break
    out.push(t.winners)
    left = left.map((b) => b.filter((id) => !t.winners.includes(id))).filter((b) => b.length)
  }
  return out
}
export function teamsOf(ballots: string[][]): { first: string[]; second: string[] } {
  const order = places(ballots).flat()
  return { first: order.slice(0, 3), second: order.slice(3, 6) }
}

// A ranking after a tap on a player: added at the end, or taken out (the rest move up).
export function toggleRank(ranking: string[], id: string): string[] {
  return ranking.includes(id) ? ranking.filter((x) => x !== id) : [...ranking, id]
}

// The rounds in words, for a revealed award: "Ian was knocked out and their ballots moved on." Only when it took more than one round.
// A pair reads "Ben and Phillip".
export function roundsInWords(t: Tally, nameOf: (id: string) => string): string[] {
  const name = (id: string) => pairOf(id).map(nameOf).join(" and ")
  if (t.rounds.length < 2) return []
  const list = (ids: string[]) => (ids.length === 1 ? name(ids[0]) : `${ids.slice(0, -1).map(name).join(", ")} and ${name(ids.at(-1)!)}`)
  return t.rounds.map((r, i) => {
    const line = r.counts.map((c) => `${name(c.id)} ${c.n}`).join(", ")
    const end = r.out.length ? ` ${list(r.out)} ${r.out.length === 1 ? "was" : "were"} knocked out, and those ballots moved to the next choice.` : t.winners.length === 1 ? ` ${name(t.winners[0])} has a majority.` : " Tied."
    return `Round ${i + 1}: ${line}.${end}`
  })
}

// What the numbers say for each award: the award race's leader (awardRace.ts uses the same keys).
// The award race calls Most Improved "mip"; a duo's leader is the pair's id, to compare with a duo ballot's winner.
export function numbersPick(state: PooleanState): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const r of awardRace(state)) {
    const lead = r.leaders[0]
    if (!lead) continue
    const key = r.key === "mip" ? "mip-season" : r.key
    out[key] = key.endsWith("duo") ? [pairId(lead.ids[0], lead.ids[1])] : lead.ids
  }
  return out
}

// Did the players agree with the numbers? A plain line for a revealed award.
export function verdict(t: Tally, numbers: string[] | undefined, nameOf: (id: string) => string): string | null {
  const name = (id: string) => pairOf(id).map(nameOf).join(" and ")
  if (!t.winners.length || !numbers?.length) return null
  const n = numbers[0]
  if (t.winners.includes(n)) return t.winners.length === 1 ? `The players and the numbers agree.` : `The numbers had ${name(n)} too.`
  return `The numbers had ${name(n)}.`
}

// ---- database (supabase/awards.sql) ----

export interface Counts {
  voters: number // phones that have voted on at least one award
  byAward: Record<string, number>
  picks: Record<string, string[][]> // every ranking, revealed awards only
}

export async function loadCounts(client: SupabaseClient, ballot: string): Promise<Counts> {
  const { data, error } = await client.rpc("award_vote_counts", { p_ballot: ballot })
  const out: Counts = { voters: 0, byAward: {}, picks: {} }
  if (error || !data) return out
  const d = data as { voters?: number; by_award?: Record<string, number>; picks?: Record<string, string[][]> }
  return { voters: d.voters ?? 0, byAward: d.by_award ?? {}, picks: d.picks ?? {} }
}

export async function loadMine(client: SupabaseClient, ballot: string): Promise<Record<string, string[]>> {
  const { data, error } = await client.rpc("my_award_votes", { p_ballot: ballot, p_key: deviceKey() })
  if (error || !data) return {}
  return data as Record<string, string[]>
}

// "ok", or why it was refused: "taken" (another phone already voted as this player), "closed", or "no".
export async function castAward(client: SupabaseClient, ballot: string, award: string, voter: string, ranking: string[]): Promise<string> {
  const { data, error } = await client.rpc("cast_award_vote", { p_ballot: ballot, p_award: award, p_voter: voter, p_ranking: ranking, p_key: deviceKey() })
  if (error) return "no"
  return String(data ?? "no")
}
