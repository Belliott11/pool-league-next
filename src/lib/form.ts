import { pointsAdded, type Parts } from "@/lib/epa"
import type { PooleanState } from "@/lib/types"

// Current form: a DARKO-style rating (an NBA projection system: daily, adjusted, regressed, Kalman-filtered). How many points a player
// adds a game right now, by Points added (epa.ts), with how sure that is. Each part of Points added (shots, passes, turnovers,
// offensive rebounds, defense) is followed game by game with a Kalman filter:
//   - everyone starts at the league average (0) with the spread of real talent between players as the uncertainty;
//   - each game moves the estimate by how much a single game of that part says, which depends on how noisy that part is game to game
//     (measured from our own games: a part that swings wildly night to night moves the estimate less);
//   - between games the uncertainty grows a little (DRIFT of the talent spread), so recent games count more than old ones and form can
//     change over a season.
// The parts add up to the rating; their uncertainties add up to its range. The noise is measured fresh from the games each time; the
// spread too once there are enough games (see PRIOR_GAMES). `src/lib/form.test.ts` checks it predicts a player's next game better than the props'
// average leaned on the league by 3 games, each prediction made only from earlier nights, with live data.

export const PARTS: (keyof Parts)[] = ["shots", "passes", "turnovers", "boards", "defense"]
// How much of the talent spread can change between one game and the next. 0 for now: on the 3 filmed nights so far, any recency
// weighting predicted next games slightly worse (2026-11-27); recheck once FORM_MEASURE_AT games are filmed.
export const DRIFT = 0
// Until the league has this many filmed games, each part's talent spread is set from its noise as if a player's talent were known as
// well as PRIOR_GAMES of their games would show it (spread = noise / sqrt(PRIOR_GAMES)), since one or two nights cannot measure it: the
// measured spreads predicted next games worse than leaning on the league (strict check, 2026-11-27: 20.4 against 16.6). With 8, the
// rating beat the props' lean-by-3-games average on the same strict check, 16.3 against 16.8 (5 to 12 all about as good). From then on,
// each part's own spread is measured, which is what makes some stats (defense here) trusted faster than others.
export const PRIOR_GAMES = 8
export const FORM_MEASURE_AT = 20
export const RANGE_Z = 1.28 // the range shown covers about 80%

export interface FormPoint {
  gameId: string
  date: string
  mean: number // after this game
  sd: number
  actual: number // their Points added in this game
}

export interface FormRow {
  id: string
  games: number
  mean: number // points added a game, right now
  sd: number
  low: number
  high: number
  parts: Record<keyof Parts, number>
  history: FormPoint[] // after each game, oldest first
}

export interface Form {
  rows: FormRow[]
  noise: Record<keyof Parts, number> // game-to-game spread of each part (sd)
  spread: Record<keyof Parts, number> // spread of real talent between players (sd)
  games: number
  measured: boolean // the spreads come from the games (FORM_MEASURE_AT filmed), not PRIOR_GAMES
}

type Line = { gameId: string; date: string; parts: Parts; total: number }

// Every filmed game's Points added for each player in it, oldest first.
export function gameLines(state: PooleanState): Map<string, Line[]> {
  const sorted = state.games.filter((g) => g.scoringEvents.length > 0 && !g.liveInProgress && !g.test).sort((a, b) => (a.date || "").localeCompare(b.date || ""))
  const out = new Map<string, Line[]>()
  for (const g of sorted) {
    for (const r of pointsAdded(state, { only: g.id }).rows) {
      const list = out.get(r.id) ?? out.set(r.id, []).get(r.id)!
      list.push({ gameId: g.id, date: g.date, parts: { ...r.parts }, total: r.total })
    }
  }
  return out
}

// The noise of one game and the spread of talent for one part, by the method of moments: the average variance inside a player's games
// is the noise; the variance of players' averages, less the share of it that noise alone would make, is the talent spread.
function measure(lines: Map<string, Line[]>, part: keyof Parts): { noise: number; spread: number } {
  let within = 0
  let df = 0
  const means: { m: number; n: number }[] = []
  for (const list of lines.values()) {
    const xs = list.map((l) => l.parts[part])
    if (xs.length < 2) continue
    const m = xs.reduce((a, b) => a + b, 0) / xs.length
    within += xs.reduce((a, x) => a + (x - m) ** 2, 0)
    df += xs.length - 1
    means.push({ m, n: xs.length })
  }
  // Floors keep a part that has not varied yet (every value 0 on the first night, say) from dividing nothing by nothing.
  const noise2 = Math.max(df ? within / df : 1, 1e-4)
  if (means.length < 2) return { noise: Math.sqrt(noise2), spread: Math.sqrt(noise2) / 2 }
  const grand = means.reduce((a, x) => a + x.m, 0) / means.length
  const between = means.reduce((a, x) => a + (x.m - grand) ** 2, 0) / (means.length - 1)
  const avgInvN = means.reduce((a, x) => a + 1 / x.n, 0) / means.length
  // A floor keeps a part from being treated as pure luck when a few games make its spread come out at nothing.
  const spread2 = Math.max(between - noise2 * avgInvN, noise2 * 0.02, 1e-4)
  return { noise: Math.sqrt(noise2), spread: Math.sqrt(spread2) }
}

// The filter for one part over one player's games: the estimate and its variance after each game.
export function filter(xs: number[], noise: number, spread: number, drift = DRIFT): { mean: number; v: number }[] {
  let m = 0
  let v = spread * spread
  const out: { mean: number; v: number }[] = []
  for (const x of xs) {
    const k = v / (v + noise * noise)
    m += k * (x - m)
    v = (1 - k) * v
    out.push({ mean: m, v })
    v += drift * spread * spread
  }
  return out
}

export function currentForm(state: PooleanState, drift = DRIFT): Form {
  const lines = gameLines(state)
  const filmed = new Set([...lines.values()].flat().map((l) => l.gameId)).size
  const measured = filmed >= FORM_MEASURE_AT
  const noise = {} as Record<keyof Parts, number>
  const spread = {} as Record<keyof Parts, number>
  for (const p of PARTS) {
    const m = measure(lines, p)
    noise[p] = m.noise
    spread[p] = measured ? m.spread : m.noise / Math.sqrt(PRIOR_GAMES)
  }
  const rows: FormRow[] = []
  for (const [id, list] of lines) {
    const tracks = PARTS.map((p) => filter(list.map((l) => l.parts[p]), noise[p], spread[p], drift))
    const history = list.map((l, i) => {
      const mean = tracks.reduce((a, t) => a + t[i].mean, 0)
      const sd = Math.sqrt(tracks.reduce((a, t) => a + t[i].v, 0))
      return { gameId: l.gameId, date: l.date, mean, sd, actual: l.total }
    })
    const last = history[history.length - 1]
    const parts = Object.fromEntries(PARTS.map((p, j) => [p, tracks[j][tracks[j].length - 1].mean])) as Record<keyof Parts, number>
    rows.push({ id, games: list.length, mean: last.mean, sd: last.sd, low: last.mean - RANGE_Z * last.sd, high: last.mean + RANGE_Z * last.sd, parts, history })
  }
  rows.sort((a, b) => b.mean - a.mean)
  return { rows, noise, spread, games: filmed, measured }
}
