// Trade offers between season-team captains: a captain offers some of their players for some of another team's, the other captain
// accepts or declines, and the editor approves an accepted trade before anyone moves (the site then moves the players with dated moves,
// seasonTeams.ts movePlayer). This file must not import anything: the season-draft edge function runs a byte-for-byte copy
// (supabase/functions/season-draft/seasonTrades.ts, checked by seasonTrades.test.ts), so a captain's phone and the server follow the
// same rules.

export type TradeStatus = "open" | "accepted" | "declined" | "withdrawn" | "approved" | "turned down"

export interface TradeOffer {
  id: string
  from: string // team id of the captain who offered
  to: string // team id of the captain asked
  give: string[] // players going from `from` to `to`
  get: string[] // players going from `to` to `from`
  at: string
  status: TradeStatus
  decidedAt?: string
}

interface TradeTeam {
  id: string
  captain: string | null
  members: string[]
}

interface TradeSet {
  teams: TradeTeam[]
  offers?: TradeOffer[]
}

export const MAX_SIDE = 3 // players on each side of one trade
export const MAX_OPEN = 4 // open offers a team can have out at once

const team = (set: TradeSet, id: string) => set.teams.find((t) => t.id === id) ?? null

// Why a trade cannot happen as things stand, or null when it can.
export function tradeProblem(set: TradeSet, from: string, to: string, give: string[], get: string[]): string | null {
  const a = team(set, from)
  const b = team(set, to)
  if (!a || !b || a.id === b.id) return "Pick another team to trade with."
  if (!give.length || !get.length) return "A trade needs at least one player each way."
  if (give.length > MAX_SIDE || get.length > MAX_SIDE) return `At most ${MAX_SIDE} players each way.`
  if (new Set(give).size !== give.length || new Set(get).size !== get.length) return "A player is listed twice."
  if (give.some((p) => !a.members.includes(p)) || get.some((p) => !b.members.includes(p))) return "Someone in this trade is not on that team any more."
  if (give.includes(a.captain ?? "") || get.includes(b.captain ?? "")) return "Captains stay with their teams."
  return null
}

export function makeOffer<S extends TradeSet>(set: S, from: string, to: string, give: string[], get: string[], id: string, at: string): S | string {
  const problem = tradeProblem(set, from, to, give, get)
  if (problem) return problem
  if ((set.offers ?? []).filter((o) => o.from === from && o.status === "open").length >= MAX_OPEN) return `A team can have ${MAX_OPEN} open offers at once.`
  const offer: TradeOffer = { id, from, to, give: [...give], get: [...get], at, status: "open" }
  return { ...set, offers: [...(set.offers ?? []), offer] }
}

function setStatus<S extends TradeSet>(set: S, id: string, status: TradeStatus, at: string): S {
  return { ...set, offers: (set.offers ?? []).map((o) => (o.id === id ? { ...o, status, decidedAt: at } : o)) }
}

// The asked captain's answer. An accepted trade still needs the editor, and is checked again when it is approved.
export function respondToOffer<S extends TradeSet>(set: S, id: string, teamId: string, accept: boolean, at: string): S | string {
  const o = (set.offers ?? []).find((x) => x.id === id)
  if (!o || o.status !== "open") return "That offer is no longer open."
  if (o.to !== teamId) return "Only the captain it was offered to can answer it."
  if (accept) {
    const problem = tradeProblem(set, o.from, o.to, o.give, o.get)
    if (problem) return problem
  }
  return setStatus(set, id, accept ? "accepted" : "declined", at)
}

export function withdrawOffer<S extends TradeSet>(set: S, id: string, teamId: string, at: string): S | string {
  const o = (set.offers ?? []).find((x) => x.id === id)
  if (!o || o.status !== "open") return "That offer is no longer open."
  if (o.from !== teamId) return "Only the captain who made it can take it back."
  return setStatus(set, id, "withdrawn", at)
}

// The editor's call on an accepted trade: "approved" (the caller moves the players) or "turned down".
export function decideOffer<S extends TradeSet>(set: S, id: string, approve: boolean, at: string): S | string {
  const o = (set.offers ?? []).find((x) => x.id === id)
  if (!o || o.status !== "accepted") return "Only an accepted trade can be approved or turned down."
  if (approve) {
    const problem = tradeProblem(set, o.from, o.to, o.give, o.get)
    if (problem) return problem
  }
  return setStatus(set, id, approve ? "approved" : "turned down", at)
}
