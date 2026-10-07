import { GOOFY, INJURY_STATUSES, injuryHeadlines } from "@/lib/injuries"
import { LABELS, LABEL_EVENTS, LINE_CAP, lineKey, lineSink } from "@/lib/labels"
import { predictRealMatchup } from "@/lib/matchup"
import { gameDays, summarizeNight } from "@/lib/nightRecap"
import { playerName } from "@/lib/players"
import { nightCallouts } from "@/lib/records"
import { previewStoriesFor } from "@/lib/nightPreview"
import { nightStories, previewStories, seasonStories } from "@/lib/storylines"
import type { PooleanState } from "@/lib/types"

// One wording the headline writer can use, for the review list. `text` is a real example from the league's own
// data (or a label line with sample names); `key` is what an approval or removal is stored against.
export interface CatalogLine {
  key: string
  text: string
  source: string
  // The type of line this wording belongs to (all the wordings for one situation), and how many approvals finish it.
  group: string
  cap: number
}

const sampleVars = (n: string, o: string): Record<string, string> => ({ n, o, fg: "2-for-9", k: "4", w: "3", l: "3", g: "2", pts: "12", avg: "7.5", r: "2-4", label: "label" })
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)

// Every wording the app can pick from. Recap, going-in, season and injury wordings are collected by running the
// writers over the real nights, so they appear once the situation has happened in the data; the label lines and
// injury notes are always listed.
export function buildCatalog(state: PooleanState): CatalogLine[] {
  const seen = new Map<string, CatalogLine>()
  let source = ""
  lineSink.current = (options) => {
    const group = lineKey(options[0])
    for (const text of options) {
      const key = lineKey(text)
      if (!seen.has(key)) seen.set(key, { key, text, source, group, cap: LINE_CAP.recap })
    }
  }
  try {
    const nm = (id: string) => playerName(state, id)
    const predict = (a: string[], b: string[]) => predictRealMatchup(a, b)
    source = "Night recap"
    for (const date of gameDays(state)) {
      const full = summarizeNight(state, date)
      const callouts = nightCallouts(state, date)
      nightStories(state, { ...full, mvp: null }, callouts.filter((c) => c.key === "pts"), nm, predict)
      nightStories(state, full, callouts, nm, predict)
    }
    source = "Going in"
    previewStories(state, nm)
    source = "Season"
    seasonStories(state, nm)
    source = "Injury report"
    injuryHeadlines(state, nm)
    source = "Night preview"
    for (const r of state.rsvps ?? []) previewStoriesFor(state, r.playerIds, nm)
  } finally {
    lineSink.current = null
  }

  const out = [...seen.values()]
  const add = (text: string, src: string, cap: number, group = src) => {
    const key = lineKey(text)
    if (!seen.has(key)) {
      const line = { key, text, source: src, group, cap }
      seen.set(key, line)
      out.push(line)
    }
  }
  for (const s of INJURY_STATUSES) for (const t of GOOFY[s.key]) add(t, `Injury note: ${s.label.toLowerCase()}`, LINE_CAP.note)
  const n = state.players[0]?.name ?? "{n}"
  const o = state.players[1]?.name ?? n
  const vars = sampleVars(n, o)
  for (const l of LABELS) {
    for (const ev of LABEL_EVENTS) for (const t of l.lines[ev.key] ?? []) add(fill(t, vars), `Label ${l.name}: ${ev.label.toLowerCase()}`, LINE_CAP.label, `Label ${l.name}`)
    for (const [k, title] of [["injury", "injury note"], ["away", "away note"], ["back", "back note"]] as const) for (const t of l[k] ?? []) add(t, `Label ${l.name}: ${title}`, LINE_CAP.label, `Label ${l.name}`)
  }
  return out
}
