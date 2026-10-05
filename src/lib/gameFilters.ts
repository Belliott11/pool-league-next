// Ported from app.js's gameMatchesFilter() / gameMatchesAdvancedFilters() / getGameStatValue().
import { formatDateDisplay } from "./format"
import {
  gameDefenseStats,
  getGameStats,
  isLiveScoreOnly,
  liveScoreOf,
  offensiveRating,
  shootingStats,
  twoWayScore,
} from "./stats"
import type { Game, PooleanState } from "./types"

export type TeamMode = "either" | "together" | "against"
export type StatField = "pts" | "oreb" | "dreb" | "ast" | "stl" | "blk" | "tov" | "pf" | "offRtg" | "twoWay"
export type StatOp = "gt" | "gte" | "lt" | "lte" | "eq"

export interface GameFilters {
  text: string
  playerIds: string[]
  teamMode: TeamMode
  dateFrom: string
  dateTo: string
  stat: { playerId: string; field: StatField; op: StatOp; value: string }
}

export const EMPTY_FILTERS: GameFilters = {
  text: "",
  playerIds: [],
  teamMode: "either",
  dateFrom: "",
  dateTo: "",
  stat: { playerId: "", field: "pts", op: "gte", value: "" },
}

export const STAT_FIELD_LABELS: Record<StatField, string> = {
  pts: "PTS",
  oreb: "OREB",
  dreb: "DREB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  tov: "TOV",
  pf: "PF",
  offRtg: "Off Rating",
  twoWay: "Two-Way",
}

function getGameStatValue(game: Game, playerId: string, field: StatField): number {
  // Games scored only live have no box score, but their baskets still count as points.
  if (field === "pts" && isLiveScoreOnly(game)) return liveScoreOf(game, [playerId])
  const s = getGameStats(game, playerId)
  if (field === "offRtg") return offensiveRating(s, shootingStats(game, playerId))
  if (field === "twoWay") {
    return twoWayScore(s, shootingStats(game, playerId), gameDefenseStats(game, playerId))
  }
  return s[field]
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

// The search box understands a few phrases about points besides plain words: "10+", ">10", "over 10", "more than 10"
// mean a game where somebody scored that much. Everything else is words that must each appear somewhere in the game's
// date, players, notes or score.
export function parseSearch(text: string): { words: string[]; pts: { op: StatOp; value: number } | null } {
  let rest = text.toLowerCase()
  let pts: { op: StatOp; value: number } | null = null
  const take = (re: RegExp, op: StatOp) => {
    const m = re.exec(rest)
    if (!m || pts) return
    pts = { op, value: Number(m[1]) }
    rest = rest.replace(re, " ")
  }
  // The ">=" forms go first so ">" does not swallow them.
  take(/(?:at least|>=)\s*(\d+)(?:\s*(?:points|pts|pt|p))?/, "gte")
  take(/(?:at most|<=)\s*(\d+)(?:\s*(?:points|pts|pt|p))?/, "lte")
  take(/(?:more than|over|above|>)\s*(\d+)(?:\s*(?:points|pts|pt|p))?/, "gt")
  take(/(\d+)\s*\+/, "gte")
  take(/(?:fewer than|less than|under|below|<)\s*(\d+)(?:\s*(?:points|pts|pt|p))?/, "lt")
  return { words: rest.split(/[\s,]+/).filter((w) => w && !["points", "point", "pts", "scored", "scores", "score", "games", "game", "where", "any", "player", "a"].includes(w)), pts }
}

const passes = (val: number, op: StatOp, t: number) => (op === "gt" ? val > t : op === "gte" ? val >= t : op === "lt" ? val < t : op === "lte" ? val <= t : Math.abs(val - t) < 0.05)

export function gameMatchesFilters(state: PooleanState, game: Game, f: GameFilters): boolean {
  const rosterIds = [...game.teamA, ...game.teamB]

  if (f.text) {
    const q = parseSearch(f.text)
    if (q.pts && !rosterIds.some((id) => passes(getGameStatValue(game, id, "pts"), q.pts!.op, q.pts!.value))) return false
    const d = game.date ? new Date(game.date + "T12:00:00") : null
    const names = rosterIds.map((id) => state.players.find((p) => p.id === id)?.name.toLowerCase()).filter(Boolean)
    const scoreA = game.teamA.reduce((n, id) => n + getGameStatValue(game, id, "pts"), 0)
    const scoreB = game.teamB.reduce((n, id) => n + getGameStatValue(game, id, "pts"), 0)
    const haystack = [
      game.date || "",
      formatDateDisplay(game.date).toLowerCase(),
      d && !Number.isNaN(d.getTime()) ? `${MONTHS[d.getMonth()]} ${DAYS[d.getDay()]}` : "",
      (game.notes || "").toLowerCase(),
      `${scoreA}-${scoreB} ${scoreB}-${scoreA}`,
      ...names,
    ].join(" ")
    if (!q.words.every((w) => haystack.includes(w))) return false
  }

  if (f.playerIds.length > 0) {
    if (!f.playerIds.every((id) => rosterIds.includes(id))) return false
    if (f.teamMode === "together") {
      const allOnA = f.playerIds.every((id) => game.teamA.includes(id))
      const allOnB = f.playerIds.every((id) => game.teamB.includes(id))
      if (!allOnA && !allOnB) return false
    } else if (f.teamMode === "against") {
      const anyOnA = f.playerIds.some((id) => game.teamA.includes(id))
      const anyOnB = f.playerIds.some((id) => game.teamB.includes(id))
      if (!anyOnA || !anyOnB) return false
    }
  }

  if (f.dateFrom && (game.date || "") < f.dateFrom) return false
  if (f.dateTo && (game.date || "") > f.dateTo) return false

  // A stat filter: for one chosen player, or (left on "Any player") for anybody who played in the game.
  if (f.stat.value !== "") {
    const threshold = parseFloat(f.stat.value)
    if (Number.isNaN(threshold)) return false
    if (f.stat.playerId) {
      if (!rosterIds.includes(f.stat.playerId)) return false
      if (!passes(getGameStatValue(game, f.stat.playerId, f.stat.field), f.stat.op, threshold)) return false
    } else if (!rosterIds.some((id) => passes(getGameStatValue(game, id, f.stat.field), f.stat.op, threshold))) {
      return false
    }
  }

  return true
}
