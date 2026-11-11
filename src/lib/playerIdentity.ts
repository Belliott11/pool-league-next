import { leagueYardstick, games } from "@/lib/insight"
import { shrink } from "@/lib/trust"
import type { PooleanState, ScoringEvent } from "@/lib/types"

// What kind of scorer each player is, from where and how their shots come. The existing shot panels show makes by place
// and defense faced; these add how often a player gets free, how much attention they draw, and whether the shots they
// choose are good ones.
export const ZONES = ["close", "mid", "arc", "deep"] as const
export type Zone = (typeof ZONES)[number]
export const ZONE_LABEL: Record<Zone, string> = { close: "Close", mid: "Mid", arc: "3PT line", deep: "3PT deep" }

// ponytail: the classic site's default band edges, not its calibrated ones (legacy-core cannot load outside the browser).
const CLOSE_RANGE = 30
const DEEP_THREE = 80

export interface ZoneValue {
  att: number
  perShot: number | null // pulled toward the league with small samples
  vsLeague: number | null
}
export interface IdentityRow {
  id: string
  shots: number
  open: number // share of shots with nobody on them
  openPassed: number | null // the same, on shots off a pass
  openSelf: number | null // the same, on shots they got themselves
  defenders: number // average defenders on a shot
  gotBeat: number // times they were the defender tagged Got Beat
  openOffBeat: number // their wide-open shots that came off a beaten defender
  quality: number // average league points on the shots they take
  qualityVsLeague: number
  zones: Record<Zone, ZoneValue>
}
export interface PlayerIdentity {
  league: { open: number; defenders: number; quality: number; zones: Record<Zone, number | null> }
  rows: IdentityRow[]
}

const made = (e: ScoringEvent) => (e.made !== false ? e.points : 0)
function zoneOf(e: ScoringEvent): Zone | null {
  if (!e.shotLocation || (e.points !== 2 && e.points !== 3)) return null
  const d = Math.hypot(e.shotLocation.x - 50, e.shotLocation.y)
  return e.points === 3 ? (d > DEEP_THREE ? "deep" : "arc") : d > CLOSE_RANGE ? "mid" : "close"
}
const isOpen = (e: ScoringEvent) => e.contestLevel === "none" || e.contestLevel === "beat"
const passed = (e: ScoringEvent) => !!e.passerId && e.passerId !== "none" && e.passerId !== e.scorerId
const share = (xs: ScoringEvent[], f: (e: ScoringEvent) => boolean) => (xs.length ? xs.filter(f).length / xs.length : null)
const defenders = (e: ScoringEvent) => e.defenderIds?.length ?? 0
const mean = (xs: ScoringEvent[], f: (e: ScoringEvent) => number) => (xs.length ? xs.reduce((n, e) => n + f(e), 0) / xs.length : 0)

export function playerIdentity(state: PooleanState): PlayerIdentity {
  const gs = games(state)
  const expect = leagueYardstick(state)
  const all = gs.flatMap((g) => g.scoringEvents)
  const inZone = (xs: ScoringEvent[], z: Zone) => xs.filter((e) => zoneOf(e) === z)
  const league = {
    open: share(all, isOpen) ?? 0,
    defenders: mean(all, defenders),
    quality: mean(all, expect),
    zones: Object.fromEntries(ZONES.map((z) => [z, inZone(all, z).length ? mean(inZone(all, z), made) : null])) as Record<Zone, number | null>,
  }
  const by = new Map<string, ScoringEvent[]>()
  for (const e of all) by.set(e.scorerId, [...(by.get(e.scorerId) ?? []), e])
  const rows = [...by].map(([id, xs]) => {
    const zones = Object.fromEntries(
      ZONES.map((z) => {
        const ys = inZone(xs, z)
        const l = league.zones[z]
        const perShot = ys.length && l !== null ? shrink(ys.reduce((n, e) => n + made(e), 0), ys.length, l) : null
        return [z, { att: ys.length, perShot, vsLeague: perShot !== null && l !== null ? perShot - l : null }]
      }),
    ) as Record<Zone, ZoneValue>
    return {
      id,
      shots: xs.length,
      open: share(xs, isOpen) ?? 0,
      openPassed: share(xs.filter(passed), isOpen),
      openSelf: share(xs.filter((e) => !passed(e)), isOpen),
      defenders: mean(xs, defenders),
      openOffBeat: xs.filter((e) => e.contestLevel === "beat").length,
      gotBeat: all.filter((e) => e.contestLevel === "beat" && (e.defenderIds ?? []).includes(id)).length,
      quality: mean(xs, expect),
      qualityVsLeague: mean(xs, expect) - league.quality,
      zones,
    }
  })
  return { league, rows: rows.sort((a, b) => b.shots - a.shots) }
}
