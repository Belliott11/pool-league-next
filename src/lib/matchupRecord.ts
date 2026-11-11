import { countsForBeatRate } from "@/lib/beatRate"
import { assignmentsAt } from "@/lib/matchupSets"
import type { PooleanState } from "@/lib/types"

// How each pairing went: for every shot, who was guarding the shooter. A shot's own tagged defenders win; a shot with none tagged falls
// back to whoever the game's matchups say was guarding the shooter at that moment. Shots off a beaten defender are counted apart, so
// the make rate reads "when the defender was in position".
export interface Pairing {
  defenderId: string
  scorerId: string
  shots: number
  beat: number // shots off a beaten defender
  made: number // makes among the shots that were not off a beaten defender
  held: number // those shots, with a defender in position
  fromMatchups: number // shots credited by the matchups list rather than a tag
}

export function matchupRecord(state: PooleanState): Pairing[] {
  const by = new Map<string, Pairing>()
  for (const g of state.games.filter(countsForBeatRate)) {
    for (const e of g.scoringEvents) {
      if (e.points !== 2 && e.points !== 3) continue
      const tagged = e.defenderIds ?? []
      let defenders = tagged
      if (tagged.length === 0 && (g.matchups ?? []).length > 0) {
        defenders = [...assignmentsAt(g, e.videoTime ?? null)].filter(([, offenders]) => offenders.includes(e.scorerId)).map(([d]) => d)
      }
      for (const d of defenders) {
        const key = `${d}|${e.scorerId}`
        const p = by.get(key) ?? by.set(key, { defenderId: d, scorerId: e.scorerId, shots: 0, beat: 0, made: 0, held: 0, fromMatchups: 0 }).get(key)!
        p.shots++
        if (tagged.length === 0) p.fromMatchups++
        if (e.contestLevel === "beat") p.beat++
        else {
          p.held++
          if (e.made !== false) p.made++
        }
      }
    }
  }
  return [...by.values()].sort((a, b) => b.shots - a.shots || a.defenderId.localeCompare(b.defenderId))
}
