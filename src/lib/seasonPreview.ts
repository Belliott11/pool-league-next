import { currentForm } from "@/lib/form"
import { pairRecord } from "@/lib/headToHead"
import { improving } from "@/lib/improving"
import { playerLine } from "@/lib/nightRecap"
import { seasonGames } from "@/lib/offseason"
import { pastSeasonAwards } from "@/lib/pastAwards"
import { currentRealSeason } from "@/lib/real"
import { teammateFit } from "@/lib/teammates"
import type { PooleanState } from "@/lib/types"

// The season preview (page #/games/preview): every regular's story going into the new season, from what the site already knows. Last
// season's record, parties and power-ranking nights at the top (the old site's season card), the awards they were voted, their scoring and
// form rating from filmed games, who they play best with, and how their form was trending at the end. The page adds the phone-owned parts
// (preseason "make a jump" picks, summer goals). No chances or odds: those stay with the editor.

export interface PreviewRow {
  id: string
  parties: number // nights at last season's parties
  record: [number, number] | null
  crowns: number // nights at #1 in the party power rankings
  bestRank: number | null
  awards: string[] // last season's voted awards they won
  ppg: number | null // points a game in filmed games
  filmed: number
  form: number | null // form rating going in (Points added a game)
  trend: number | null // form now against before their last few games
  partner: { id: string; why: string } | null
}

export const MIN_PARTIES = 3 // nights last season to be a regular in the preview

export function seasonPreview(state: PooleanState): PreviewRow[] {
  const season = currentRealSeason()
  const cards = season?.cards ?? {}
  const past = pastSeasonAwards()[0]
  const games = seasonGames(state)
  const filmed = games.filter((g) => g.scoringEvents.length > 0)
  const form = new Map(currentForm(state).rows.map((r) => [r.id, r.mean]))
  const trend = new Map(improving(state).map((r) => [r.id, r.change]))
  const ids = new Set(state.players.map((p) => p.id))
  const out: PreviewRow[] = []
  for (const p of state.players) {
    const c = cards[p.id]
    const played = games.filter((g) => g.teamA.includes(p.id) || g.teamB.includes(p.id)).length
    const parties = c?.parties ?? 0
    if (parties < MIN_PARTIES && played < MIN_PARTIES) continue
    const mine = filmed.filter((g) => g.teamA.includes(p.id) || g.teamB.includes(p.id))
    const pts = mine.reduce((n, g) => n + playerLine(g, p.id).pts, 0)
    const awards = (past?.awards ?? []).filter((a) => a.key !== "worst-duo" && a.winners.includes(p.id)).map((a) => a.label)
    // Best partner: the teammate who lifts them most in filmed games when that is clear, else the best record together (5+ games).
    const fit = teammateFit(state, p.id).find((f) => f.lift !== null && f.lift >= 0.5)
    let partner: PreviewRow["partner"] = fit ? { id: fit.id, why: `+${fit.lift!.toFixed(1)} points added a game when on the same team` } : null
    if (!partner) {
      const best = state.players
        .filter((q) => q.id !== p.id && ids.has(q.id))
        .map((q) => ({ id: q.id, r: pairRecord(p.id, q.id).together }))
        .filter((x) => x.r[0] + x.r[1] >= 5)
        .sort((a, b) => (b.r[0] + 1) / (b.r[0] + b.r[1] + 2) - (a.r[0] + 1) / (a.r[0] + a.r[1] + 2))[0]
      if (best && best.r[0] > best.r[1]) partner = { id: best.id, why: `${best.r[0]}-${best.r[1]} together` }
    }
    out.push({
      id: p.id,
      parties,
      record: c && c.w !== undefined ? [c.w, c.l ?? 0] : null,
      crowns: (c as { crowns?: number } | undefined)?.crowns ?? 0,
      bestRank: (c as { bestRank?: number } | undefined)?.bestRank ?? null,
      awards,
      ppg: mine.length ? pts / mine.length : null,
      filmed: mine.length,
      form: form.get(p.id) ?? null,
      trend: trend.get(p.id) ?? null,
      partner,
    })
  }
  return out.sort((a, b) => b.parties - a.parties || (b.record ? b.record[0] : 0) - (a.record ? a.record[0] : 0))
}

// The one or two facts that make a player's story, strongest first: awards, nights at #1, a strong or rough record, the trend at the end,
// the group's jump picks, a goal set for the summer.
export function storyline(r: PreviewRow, name: (id: string) => string, extra: { jumpVotes?: number; goal?: string } = {}): string {
  const facts: string[] = []
  if (r.awards.length) facts.push(`Voted ${r.awards.slice(0, 2).join(" and ")} last summer`)
  if (r.crowns >= 2) facts.push(`#1 in the power rankings at ${r.crowns} parties`)
  else if (r.bestRank === 1) facts.push("topped the power rankings once")
  if (r.record) {
    const [w, l] = r.record
    const share = w / Math.max(1, w + l)
    if (w + l >= 10 && share >= 0.58) facts.push(`won ${Math.round(share * 100)}% of their games`)
    else if (w + l >= 10 && share <= 0.4) facts.push(`a ${w}-${l} summer to turn around`)
  }
  if (r.trend !== null && r.trend >= 0.3) facts.push("finished the summer on the way up")
  if (extra.jumpVotes) facts.push(`${extra.jumpVotes} ${extra.jumpVotes === 1 ? "person picks" : "people pick"} them to make a jump`)
  if (extra.goal) facts.push(`set a goal: ${extra.goal}`)
  if (!facts.length && r.partner) facts.push(`best with ${name(r.partner.id)} (${r.partner.why})`)
  if (!facts.length) facts.push(`${r.parties} parties last summer`)
  const s = facts.slice(0, 2).join(", and ")
  return s.charAt(0).toUpperCase() + s.slice(1) + "."
}
