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
  crowns: number // party nights they were ranked first
  powerRank: number | null // place in last summer's power rankings: average nightly percentile (powerPct), among regulars, ties shared
  powerPct: number | null
  powerTied: boolean // another regular has the same place
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
      powerPct: c?.powerPct ?? null,
      powerRank: null,
      powerTied: false,
      awards,
      ppg: mine.length ? pts / mine.length : null,
      filmed: mine.length,
      form: form.get(p.id) ?? null,
      trend: trend.get(p.id) ?? null,
      partner,
    })
  }
  // Last summer's power rankings: the average nightly percentile, among the players with MIN_PARTIES parties (one great night is not a
  // season). Ties share a place.
  // The exact average of each night's percentile, from the nightly rankings: the season card rounds it to a whole number, which made Ben
  // (73.25) and Reilly (72.98) look tied (2026-11-28).
  const nightly = new Map<string, number[]>()
  for (const night of season?.rankings ?? []) for (const x of night.players) (nightly.get(x.slug) ?? nightly.set(x.slug, []).get(x.slug)!).push(x.pct)
  for (const r of out) {
    const v = nightly.get(r.id)
    if (v?.length) r.powerPct = v.reduce((a, x) => a + x, 0) / v.length
  }
  const ranked = out.filter((r) => r.powerPct !== null && r.parties >= MIN_PARTIES)
  for (const r of ranked) {
    r.powerRank = ranked.filter((x) => x.powerPct! > r.powerPct! + 0.005).length + 1
    r.powerTied = ranked.filter((x) => Math.abs(x.powerPct! - r.powerPct!) < 0.005).length > 1
  }
  return out.sort((a, b) => b.parties - a.parties || (b.record ? b.record[0] : 0) - (a.record ? a.record[0] : 0))
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`

// The one or two facts that make a player's story, strongest first: awards, last summer's power ranking, a strong or rough record, the trend at the end,
// the group's jump picks, a goal set for the summer.
export function storyline(r: PreviewRow, name: (id: string) => string, extra: { jumpVotes?: number; goal?: string } = {}): string {
  const facts: string[] = []
  if (r.awards.length) facts.push(`Voted ${r.awards.slice(0, 2).join(" and ")} last summer`)
  // The season's power ranking first; nights ranked first only as a count out of their parties, so it never reads as the season's #1.
  const firsts = r.crowns ? `, ranked first on ${r.crowns} of ${r.parties} ${r.parties === 1 ? "night" : "nights"}` : ""
  const place = (n: number) => (r.powerTied ? `tied for ${n === 1 ? "#1" : ordinal(n)}` : n === 1 ? "#1" : ordinal(n))
  if (r.powerRank !== null && r.powerRank <= 3) facts.push(`${place(r.powerRank)} in last summer's power rankings${firsts}`)
  else if (r.crowns >= 2) facts.push(`ranked first on ${r.crowns} of ${r.parties} party nights`)
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
