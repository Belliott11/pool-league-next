import { captainOrder } from "@/lib/seasonTeams"
import type { SeasonTeamSet } from "@/lib/types"

// Draft lottery night: a draw decides the season-team draft's first-round order (the snake follows it), revealed on everyone's phone one
// pick at a time from last to first. Weighted (the default), the weakest captain by power ranking holds the most balls: with n teams the
// weakest has n, the next n - 1, down to 1 for the strongest, which keeps the old "weakest captain picks first" idea as the likeliest
// result. Even gives every team one ball. Picks are drawn one after another without putting balls back. The order is drawn when the
// editor runs it and kept in the league data (`set.lottery`); the teams are only reordered once the last pick is revealed, so the draft
// room cannot start on a half-shown order.

export type Lottery = NonNullable<SeasonTeamSet["lottery"]>
export type LotteryMode = Lottery["mode"]

export function ballsFor(set: SeasonTeamSet, mode: LotteryMode, nameOf?: (id: string) => string): Record<string, number> {
  const weakFirst = captainOrder(set.teams, nameOf)
  const n = weakFirst.length
  return Object.fromEntries(weakFirst.map((t, i) => [t.id, mode === "even" ? 1 : n - i]))
}

// Draws the whole order: each pick takes a ball at random from the teams still in, with chance proportional to their balls.
export function drawOrder(balls: Record<string, number>, rand: () => number = secureRandom): string[] {
  const left = Object.entries(balls).filter(([, b]) => b > 0)
  const order: string[] = []
  while (left.length) {
    const total = left.reduce((s, [, b]) => s + b, 0)
    let x = rand() * total
    let i = 0
    while (i < left.length - 1 && x >= left[i][1]) x -= left[i++][1]
    order.push(left[i][0])
    left.splice(i, 1)
  }
  return order
}

export function secureRandom(): number {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] / 2 ** 32
}

// Each team's exact chance at each pick (team id -> chance per pick, first pick first), by going through every order (6 teams at most).
export function pickOdds(balls: Record<string, number>): Record<string, number[]> {
  const ids = Object.keys(balls)
  const out: Record<string, number[]> = Object.fromEntries(ids.map((id) => [id, ids.map(() => 0)]))
  const walk = (left: string[], p: number, slot: number) => {
    if (!left.length) return
    const total = left.reduce((s, id) => s + balls[id], 0)
    for (const id of left) {
      const q = p * (balls[id] / total)
      out[id][slot] += q
      walk(
        left.filter((x) => x !== id),
        q,
        slot + 1,
      )
    }
  }
  walk(ids, 1, 0)
  return out
}

export const lotteryOf = (set: SeasonTeamSet): Lottery | null => set.lottery ?? null
export const lotteryLive = (set: SeasonTeamSet): boolean => {
  const l = lotteryOf(set)
  return !!l && l.revealed < l.order.length
}

export function runLottery(set: SeasonTeamSet, mode: LotteryMode, nameOf?: (id: string) => string, rand: () => number = secureRandom): SeasonTeamSet {
  const balls = ballsFor(set, mode, nameOf)
  const lottery: Lottery = { mode, balls, order: drawOrder(balls, rand), revealed: 0, at: new Date().toISOString() }
  return { ...set, lottery }
}

// Shows the next pick (from the last pick up). The last reveal puts the teams in the drawn order, which the snake draft then follows.
export function revealNext(set: SeasonTeamSet): SeasonTeamSet {
  const l = lotteryOf(set)
  if (!l || l.revealed >= l.order.length) return set
  const revealed = l.revealed + 1
  const next: SeasonTeamSet = { ...set, lottery: { ...l, revealed } }
  if (revealed < l.order.length) return next
  const rank = new Map(l.order.map((id, i) => [id, i]))
  return { ...next, teams: [...set.teams].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99)) }
}

// Throws the draw away (only before any pick is made).
export function cancelLottery(set: SeasonTeamSet): SeasonTeamSet {
  const rest = { ...set }
  delete rest.lottery
  return rest
}

// The picks shown so far, as { pick number (1 is first), team id }, last pick first.
export function shownPicks(l: Lottery): { pick: number; id: string }[] {
  const n = l.order.length
  return Array.from({ length: l.revealed }, (_, i) => ({ pick: n - i, id: l.order[n - 1 - i] }))
}
