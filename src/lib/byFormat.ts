import { oldGames } from "@/lib/hallOfFame"
import type { RealGame } from "@/lib/real"
import type { Game, PooleanState } from "@/lib/types"

// How the game plays at each team size. Formats score to different totals, so everything is a rate (a numerator and a denominator,
// so the counts can be shown), never a per-game total. Uneven teams are pooled as one format.
const RIM_UNITS = 30 // the close-range edge used elsewhere, in court units from the hoop

export const formatOf = (a: string[], b: string[]) => (a.length === b.length ? `${a.length}v${b.length}` : "Uneven")

export interface Rate {
  n: number
  d: number
}
export interface FormatRow {
  format: string
  filmed: number // filmed games
  results: number // every result, filmed or not (old site plus app games it does not have)
  turnovers: Rate // live-ball turnovers out of trips that ended in a shot or a turnover
  threes: Rate // threes out of shots
  threeMade: Rate
  close: Rate // close shots out of shots with a spot
  closeMade: Rate
  open: Rate // open (none, light, beat) out of shots with a contest level
  openMade: Rate
  contestedMade: Rate // medium and heavy
  assisted: Rate // assisted out of made shots
  oreb: Rate // offensive rebounds out of rebounded misses
  margin: Rate // winning margin out of total points: how lopsided games are
}

const counts = (g: Game) => !g.liveInProgress && !g.stoppedEarly && g.scoringEvents.length > 0

export function byFormat(state: PooleanState, old: RealGame[] = oldGames()): FormatRow[] {
  const rows = new Map<string, FormatRow>()
  const z = (): Rate => ({ n: 0, d: 0 })
  const row = (f: string) =>
    rows.get(f) ??
    rows
      .set(f, { format: f, filmed: 0, results: 0, turnovers: z(), threes: z(), threeMade: z(), close: z(), closeMade: z(), open: z(), openMade: z(), contestedMade: z(), assisted: z(), oreb: z(), margin: z() })
      .get(f)!
  const add = (r: Rate, hit: boolean) => {
    r.d++
    if (hit) r.n++
  }
  for (const r of old) row(formatOf(r.a, r.b)).results++
  const oldKeys = new Set(old.map((r) => `${r.date}|${[...r.a].sort().join(",")}|${[...r.b].sort().join(",")}`))
  for (const g of state.games) {
    const k1 = `${g.date}|${[...g.teamA].sort().join(",")}|${[...g.teamB].sort().join(",")}`
    const k2 = `${g.date}|${[...g.teamB].sort().join(",")}|${[...g.teamA].sort().join(",")}`
    if (!oldKeys.has(k1) && !oldKeys.has(k2)) row(formatOf(g.teamA, g.teamB)).results++
    if (!counts(g)) continue
    const x = row(formatOf(g.teamA, g.teamB))
    x.filmed++
    let a = 0
    let b = 0
    const stolen = new Set(g.scoringEvents.map((e) => e.turnoverEventId).filter(Boolean))
    for (const e of g.scoringEvents) {
      const made = e.made !== false
      if (made) (g.teamA.includes(e.scorerId) ? (a += e.points) : (b += e.points))
      if (e.points !== 2 && e.points !== 3) continue
      add(x.turnovers, false)
      add(x.threes, e.points === 3)
      if (e.points === 3) add(x.threeMade, made)
      if (e.shotLocation) {
        const close = e.points === 2 && Math.hypot(e.shotLocation.x - 50, e.shotLocation.y) <= RIM_UNITS
        add(x.close, close)
        if (close) add(x.closeMade, made)
      }
      const cl = e.contestLevel
      if (cl) {
        const open = cl === "none" || cl === "light" || cl === "beat"
        add(x.open, open)
        add(open ? x.openMade : x.contestedMade, made)
      }
      if (made) add(x.assisted, !!e.assistId)
      if (!made && e.rebounderId && !e.turnoverEventId) add(x.oreb, g.teamA.includes(e.rebounderId) === g.teamA.includes(e.scorerId))
    }
    for (const t of g.turnoverEvents) if (!stolen.has(t.id)) add(x.turnovers, true)
    x.margin.n += Math.abs(a - b)
    x.margin.d += a + b
  }
  return [...rows.values()].filter((r) => r.filmed > 0).sort((p, q) => (p.format === "Uneven" ? 1 : q.format === "Uneven" ? -1 : p.format.localeCompare(q.format)))
}
