import type { SupabaseClient } from "@supabase/supabase-js"
import { awardRace } from "@/lib/awardRace"
import { deviceKey } from "@/lib/deviceKey"
import { isCurrentSeasonGame } from "@/lib/stats"
import { MIN_GAMES as MIN_RANKED } from "@/lib/ratings"
import type { AwardBallot, PooleanState } from "@/lib/types"

// Season awards voted by the players, set beside what the numbers say (awardRace.ts). The editor starts a ballot at the end of a season;
// every player votes once per award from their own phone ("Who are you?" picks who they are), never for themselves; then the editor
// closes voting and reveals the awards one at a time, MVP last, at a party. Votes are secret until an award is revealed: the
// award_votes table cannot be read by visitors, and the database hands out only vote counts, this phone's own votes, and the picks for
// awards already revealed (supabase/awards.sql).

export interface AwardDef {
  key: string
  label: string
  question: string
}

// In reveal order: MVP last.
export const AWARDS: AwardDef[] = [
  { key: "mip", label: "Most Improved", question: "Who got better the most this season?" },
  { key: "clutch", label: "Clutch Player", question: "Who do you want with the ball at game point?" },
  { key: "dpoy", label: "Defensive Player", question: "Who was the hardest to score on?" },
  { key: "mvp", label: "MVP", question: "Who was the most valuable player this season?" },
]
export const awardDef = (k: string) => AWARDS.find((a) => a.key === k) ?? null

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

export interface Tally {
  winners: string[] // the most votes; more than one on a tie
  votes: { id: string; n: number }[] // most first
  total: number
}

export function tally(picks: string[]): Tally {
  const m = new Map<string, number>()
  for (const p of picks) m.set(p, (m.get(p) ?? 0) + 1)
  const votes = [...m].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id))
  const top = votes[0]?.n ?? 0
  return { winners: top ? votes.filter((v) => v.n === top).map((v) => v.id) : [], votes, total: picks.length }
}

// What the numbers say for each award: the award race's leader (awardRace.ts uses the same keys).
export function numbersPick(state: PooleanState): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const r of awardRace(state)) if (r.leaders[0]) out[r.key] = r.leaders[0].ids
  return out
}

// Did the players agree with the numbers? A plain line for a revealed award.
export function verdict(t: Tally, numbers: string[] | undefined, name: (id: string) => string): string | null {
  if (!t.winners.length || !numbers?.length) return null
  const n = numbers[0]
  if (t.winners.includes(n)) return t.winners.length === 1 ? `The players and the numbers agree.` : `The numbers had ${name(n)} too.`
  return `The numbers had ${name(n)}.`
}

// ---- database (supabase/awards.sql) ----

export interface Counts {
  voters: number // phones that have voted on at least one award
  byAward: Record<string, number>
  picks: Record<string, string[]> // revealed awards only
}

export async function loadCounts(client: SupabaseClient, ballot: string): Promise<Counts> {
  const { data, error } = await client.rpc("award_vote_counts", { p_ballot: ballot })
  const out: Counts = { voters: 0, byAward: {}, picks: {} }
  if (error || !data) return out
  const d = data as { voters?: number; by_award?: Record<string, number>; picks?: Record<string, string[]> }
  return { voters: d.voters ?? 0, byAward: d.by_award ?? {}, picks: d.picks ?? {} }
}

export async function loadMine(client: SupabaseClient, ballot: string): Promise<Record<string, string>> {
  const { data, error } = await client.rpc("my_award_votes", { p_ballot: ballot, p_key: deviceKey() })
  if (error || !data) return {}
  return data as Record<string, string>
}

// "ok", or why it was refused: "taken" (another phone already voted as this player), "closed", or "no".
export async function castAward(client: SupabaseClient, ballot: string, award: string, voter: string, pick: string): Promise<string> {
  const { data, error } = await client.rpc("cast_award_vote", { p_ballot: ballot, p_award: award, p_voter: voter, p_pick: pick, p_key: deviceKey() })
  if (error) return "no"
  return String(data ?? "no")
}
