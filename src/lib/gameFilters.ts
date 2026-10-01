// Ported from app.js's gameMatchesFilter() / gameMatchesAdvancedFilters() / getGameStatValue().
import { formatDateDisplay } from "./format"
import {
  gameDefenseStats,
  getGameStats,
  offensiveRating,
  shootingStats,
  twoWayScore,
} from "./stats"
import type { Game, PooleanState } from "./types"

export type TeamMode = "either" | "together" | "against"
export type StatField = "pts" | "oreb" | "dreb" | "ast" | "stl" | "blk" | "tov" | "pf" | "offRtg" | "twoWay"
export type StatOp = "gte" | "lte" | "eq"

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
  const s = getGameStats(game, playerId)
  if (field === "offRtg") return offensiveRating(s, shootingStats(game, playerId))
  if (field === "twoWay") {
    return twoWayScore(s, shootingStats(game, playerId), gameDefenseStats(game, playerId))
  }
  return s[field]
}

export function gameMatchesFilters(state: PooleanState, game: Game, f: GameFilters): boolean {
  const rosterIds = [...game.teamA, ...game.teamB]

  if (f.text) {
    const names = rosterIds
      .map((id) => state.players.find((p) => p.id === id)?.name.toLowerCase())
      .filter(Boolean)
    const haystack = [
      game.date || "",
      formatDateDisplay(game.date).toLowerCase(),
      (game.notes || "").toLowerCase(),
      ...names,
    ].join(" ")
    if (!haystack.includes(f.text.toLowerCase())) return false
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

  if (f.stat.playerId && f.stat.value !== "") {
    if (!rosterIds.includes(f.stat.playerId)) return false
    const val = getGameStatValue(game, f.stat.playerId, f.stat.field)
    const threshold = parseFloat(f.stat.value)
    if (Number.isNaN(threshold)) return false
    if (f.stat.op === "gte" && !(val >= threshold)) return false
    if (f.stat.op === "lte" && !(val <= threshold)) return false
    if (f.stat.op === "eq" && !(Math.abs(val - threshold) < 0.05)) return false
  }

  return true
}
