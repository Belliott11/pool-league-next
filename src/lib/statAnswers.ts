import { formatDateDisplay } from "@/lib/format"
import { careers, longestStreaks } from "@/lib/hallOfFame"
import { playerLine, scoreOf } from "@/lib/nightRecap"
import { playerName } from "@/lib/players"
import { holders, recordBook, type RecordKey } from "@/lib/records"
import type { Game, PooleanState } from "@/lib/types"

// Stat questions typed into search ("most points in a game", "Ben's best game", "who has the most 3s", "longest win streak"), answered
// from numbers the site already works out: the record book (single games), career lines (wins and games from every result, old site
// included; points and box-score stats from this site's games), streaks and each player's own games. Plain word matching, no guessing:
// a question it does not recognise gets no answer, and search carries on as before.

export type Target = { kind: "game"; id: string } | { kind: "player"; id: string } | { kind: "page"; sub: string }

export interface Answer {
  key: string
  label: string // the answer itself
  detail: string // what it answers, and where it goes
  target: Target
}

type Stat = Exclude<RecordKey, "twoWay"> | "twoWay"
const STAT_WORDS: [RegExp, Stat][] = [
  [/\b(points?|pts|scor\w*|buckets?)\b/, "pts"],
  [/\b(rebounds?|boards?|reb)\b/, "reb"],
  [/\b(assists?|ast|dimes?|passes)\b/, "ast"],
  [/\b(steals?|stl)\b/, "stl"],
  [/\b(blocks?|blk|swats?)\b/, "blk"],
  [/\b(threes?|3s|3's|3-?pointers?|3pt|triples?)\b/, "tpm"],
  [/\b(two[- ]?way)\b/, "twoWay"],
]
const STAT_NAME: Record<Stat, [string, string]> = {
  pts: ["point", "points"],
  reb: ["rebound", "rebounds"],
  ast: ["assist", "assists"],
  stl: ["steal", "steals"],
  blk: ["block", "blocks"],
  tpm: ["3", "3s"],
  twoWay: ["two-way", "two-way"],
}
const unit = (s: Stat, n: number) => `${s === "twoWay" ? n.toFixed(1) : n} ${STAT_NAME[s][n === 1 ? 0 : 1]}`

const statOf = (q: string): Stat | null => STAT_WORDS.find(([re]) => re.test(q))?.[1] ?? null
const SINGLE = /\b(in a game|one game|single|a game|record|night)\b/
const CAREER = /\b(career|total|all[- ]time|ever|overall|season)\b/

const finished = (state: PooleanState): Game[] =>
  state.games.filter((g) => !g.liveInProgress && !g.test && g.date).filter((g) => {
    const [a, b] = scoreOf(g)
    return a + b > 0
  })

// The player a question names: the longest player name (or first name) found as whole words in it.
export function playerIn(state: PooleanState, q: string): string | null {
  let best: { id: string; len: number } | null = null
  for (const p of state.players) {
    for (const n of new Set([p.name.toLowerCase(), p.name.toLowerCase().split(/\s+/)[0]])) {
      if (n.length < 2) continue
      const re = new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}('s)?($|[^a-z])`)
      if (re.test(q) && (!best || n.length > best.len)) best = { id: p.id, len: n.length }
    }
  }
  return best?.id ?? null
}

// Career totals of one stat from this site's games (box-score stats only count games with a box score).
function totals(state: PooleanState, s: Stat): Map<string, number> {
  const m = new Map<string, number>()
  for (const g of finished(state))
    for (const p of [...g.teamA, ...g.teamB]) {
      const l = playerLine(g, p)
      const v = s === "pts" ? l.pts : !l.box ? null : s === "twoWay" ? l.twoWay : l[s]
      if (v) m.set(p, (m.get(p) ?? 0) + v)
    }
  return m
}

const leaders = (m: Map<string, number>) => {
  const top = Math.max(...m.values())
  return { top, ids: [...m].filter(([, v]) => v === top).map(([id]) => id) }
}

export function answer(state: PooleanState, raw: string): Answer[] {
  const q = raw.trim().toLowerCase()
  if (q.length < 4) return []
  const name = (id: string) => playerName(state, id)
  const names = (ids: string[]) => (ids.length <= 2 ? ids.map(name).join(" and ") : `${ids.slice(0, -1).map(name).join(", ")} and ${name(ids.at(-1)!)}`)
  const out: Answer[] = []
  const pid = playerIn(state, q)
  const s = statOf(q)

  // Streaks.
  if (/\bstreak/.test(q)) {
    const all = longestStreaks(state, 50)
    const mine = pid ? all.find((x) => x.id === pid) : all[0]
    if (mine) out.push({ key: `streak:${mine.id}`, label: `${name(mine.id)}: ${mine.n} wins in a row`, detail: `${pid ? `${name(pid)}'s longest win streak` : "Longest win streak ever"}, ended ${formatDateDisplay(mine.end)}`, target: { kind: "page", sub: "hall" } })
    return out
  }

  if (pid) {
    const c = careers(state).find((x) => x.id === pid)
    // "Ben's best game" / "Ben's most points" (not when the question asks for an average).
    const avgAsked = /\b(average|averages|avg|ppg|per game)\b/.test(q)
    if (/\bbest\b|\bmost\b|\bhigh/.test(q) || (s && !avgAsked && !CAREER.test(q))) {
      const stat = s ?? "pts"
      let best: { g: Game; v: number } | null = null
      for (const g of finished(state)) {
        if (!g.teamA.includes(pid) && !g.teamB.includes(pid)) continue
        const l = playerLine(g, pid)
        const v = stat === "pts" ? l.pts : !l.box ? null : stat === "twoWay" ? l.twoWay : l[stat]
        if (v !== null && v > 0 && (!best || v > best.v)) best = { g, v }
      }
      if (best) {
        const l = playerLine(best.g, pid)
        const extra = stat === "pts" && l.box ? `, ${unit("ast", l.ast)}, ${unit("reb", l.reb)}` : ""
        out.push({ key: `best:${pid}:${stat}`, label: `${name(pid)}: ${unit(stat, best.v)}${extra}`, detail: `${name(pid)}'s best game for ${STAT_NAME[stat][1]}, ${formatDateDisplay(best.g.date)}`, target: { kind: "game", id: best.g.id } })
      }
    }
    // "Ben's record" / "Ben wins".
    if (c && /\b(record|wins?|win rate|w-l)\b/.test(q)) out.push({ key: `rec:${pid}`, label: `${name(pid)}: ${c.w}-${c.gp - c.w}`, detail: `${name(pid)}'s record in every result on file, ${Math.round((c.w / Math.max(1, c.gp)) * 100)}% wins`, target: { kind: "player", id: pid } })
    // "Ben average" / "Ben ppg".
    if (/\b(average|averages|avg|ppg|per game|a game)\b/.test(q) && !/\bbest\b/.test(q)) {
      const games = finished(state).filter((g) => g.teamA.includes(pid) || g.teamB.includes(pid))
      if (games.length) {
        const stat = s ?? "pts"
        const counted = stat === "pts" ? games : games.filter((g) => g.scoringEvents.length > 0)
        const sum = counted.reduce((n, g) => {
          const l = playerLine(g, pid)
          return n + (stat === "pts" ? l.pts : stat === "twoWay" ? (l.twoWay ?? 0) : l[stat])
        }, 0)
        if (counted.length) out.push({ key: `avg:${pid}:${stat}`, label: `${name(pid)}: ${(sum / counted.length).toFixed(1)} ${STAT_NAME[stat][1]} a game`, detail: `Over ${counted.length} ${stat === "pts" ? "" : "filmed "}game${counted.length === 1 ? "" : "s"} on this site`, target: { kind: "player", id: pid } })
      }
    }
    return out
  }

  // League-wide: "most wins", "most games".
  if (/\bmost\b|\bleader|\bwho has\b|\bwho's got\b/.test(q) && !s) {
    const cs = careers(state)
    if (/\bwins?\b/.test(q) && cs.length) {
      const top = Math.max(...cs.map((c) => c.w))
      const ids = cs.filter((c) => c.w === top).map((c) => c.id)
      out.push({ key: "most:wins", label: `${names(ids)}: ${top} wins`, detail: "Most wins, every result on file (old site included)", target: { kind: "page", sub: "hall" } })
    }
    if (/\bgames?\b|\bplayed\b|\bappearances?\b/.test(q) && cs.length) {
      const top = Math.max(...cs.map((c) => c.gp))
      const ids = cs.filter((c) => c.gp === top).map((c) => c.id)
      out.push({ key: "most:games", label: `${names(ids)}: ${top} games`, detail: "Most games played, every result on file", target: { kind: "page", sub: "hall" } })
    }
    return out
  }

  if (!s) return out
  // A single game: "most points in a game", "assist record".
  const single = SINGLE.test(q) && !CAREER.test(q)
  if (single || (!CAREER.test(q) && !/\bmost\b|\bwho\b|\bleader/.test(q))) {
    const r = recordBook(state)[s]
    if (r) {
      const who = holders(r)
      out.push({ key: `record:${s}`, label: `${names(who)}: ${unit(s, r.value)}`, detail: `Most ${STAT_NAME[s][1]} in one game${who.length > 1 ? " (shared)" : ""}, first on ${formatDateDisplay(r.date)}`, target: { kind: "game", id: r.gameId } })
    }
    if (single) return out
  }
  // Career: "who has the most 3s", "career assists leader".
  const m = totals(state, s)
  if (m.size) {
    const { top, ids } = leaders(m)
    out.push({ key: `career:${s}`, label: `${names(ids)}: ${unit(s, Math.round(top * 10) / 10)}`, detail: `Most career ${STAT_NAME[s][1]} on this site${s === "pts" ? "" : " (filmed games)"}`, target: ids.length === 1 ? { kind: "player", id: ids[0] } : { kind: "page", sub: "hall" } })
  }
  return out
}
