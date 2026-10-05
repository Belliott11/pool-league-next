// Compute layer, ported verbatim from dashboard/app.js per the migration plan: logic unchanged,
// just typed. Deliberately trimmed to what this app's first slice (Games list, Season Rates,
// Player Detail header) actually renders — not a toggle-complete port yet:
//   - qualifyingGamesForPlayer() omits the Include Outlier Games exclusion (IQR-based, see
//     app.js's own qualifyingGamesForPlayer) -- a per-player toggle, defaulted ON in the old app,
//     so leaving it out here matches that default exactly rather than silently diverging.
//   - Include Imbalanced Games / Include Past Seasons both default OFF in the old app too, so
//     hardcoding that default here (rather than porting the toggles themselves) matches it.
//   - shootingStats() omits the close/mid/arc/deep distance-banded splits (needs shot-location
//     calibration state this slice doesn't load) -- fgm/fga/tpm/tpa/ftm/fta are unaffected.
// Every formula that IS included is unchanged from app.js, not reimplemented from memory.

import type { Game, Player, PlayerGameStats, PooleanState } from "./types"

export function isBalancedGame(game: Game): boolean {
  return game.teamA.length === game.teamB.length
}

export function isQualifyingGame(game: Game): boolean {
  return game.scoringEvents.length > 0 && isBalancedGame(game)
}

export function qualifyingGamesForPlayer(state: PooleanState, playerId: string): Game[] {
  return state.games.filter(
    (g) => isQualifyingGame(g) && (g.teamA.includes(playerId) || g.teamB.includes(playerId)),
  )
}

export function teamScore(game: Game, playerIds: string[]): number {
  return playerIds.reduce((sum, pid) => {
    const s = game.stats.find((st) => st.playerId === pid)
    return sum + (s ? s.pts : 0)
  }, 0)
}

export function gameTotalPoints(game: Game): number {
  return teamScore(game, game.teamA) + teamScore(game, game.teamB)
}

export function playerGameResult(game: Game, playerId: string): "W" | "L" | "T" | null {
  const onA = game.teamA.includes(playerId)
  const onB = game.teamB.includes(playerId)
  if (!onA && !onB) return null

  let outcome: "A" | "B" | "T"
  if (game.scoringEvents.length > 0) {
    const scoreA = teamScore(game, game.teamA)
    const scoreB = teamScore(game, game.teamB)
    outcome = scoreA === scoreB ? "T" : scoreA > scoreB ? "A" : "B"
  } else if (game.winner === "A" || game.winner === "B") {
    outcome = game.winner
  } else {
    return null
  }

  if (outcome === "T") return "T"
  const wonIt = (onA && outcome === "A") || (onB && outcome === "B")
  return wonIt ? "W" : "L"
}

export interface ShootingStats {
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
}

export function shootingStats(game: Game, playerId: string): ShootingStats {
  const shots = game.scoringEvents.filter((ev) => ev.scorerId === playerId)
  const made = (ev: Game["scoringEvents"][number]) => ev.made !== false
  const fg = shots.filter((ev) => ev.points === 2 || ev.points === 3)
  const three = shots.filter((ev) => ev.points === 3)
  const ft = shots.filter((ev) => ev.points === 1)
  return {
    fgm: fg.filter(made).length,
    fga: fg.length,
    tpm: three.filter(made).length,
    tpa: three.length,
    ftm: ft.filter(made).length,
    fta: ft.length,
  }
}

export interface DefenseStats {
  ptsAllowed: number
  timesBeaten: number
  stops: number
  blocksNotAlreadyStopped: number
}

export function gameDefenseStats(game: Game, playerId: string): DefenseStats {
  const against = game.scoringEvents.filter((ev) => (ev.defenderIds || []).includes(playerId))
  const madeAgainst = against.filter((ev) => ev.made !== false)
  const timesBeaten = madeAgainst.length
  const stops = against.filter((ev) => ev.made === false).length
  const blocksNotAlreadyStopped = game.scoringEvents.filter(
    (ev) => ev.blockerId === playerId && ev.made === false && !(ev.defenderIds || []).includes(playerId),
  ).length
  return {
    ptsAllowed: madeAgainst.reduce((sum, ev) => sum + ev.points, 0),
    timesBeaten,
    stops,
    blocksNotAlreadyStopped,
  }
}

export function pct(made: number, attempted: number): number | null {
  return attempted > 0 ? Math.round((made / attempted) * 100) : null
}

export function trueShootingPct(pts: number, fga: number, fta: number): number | null {
  const denom = 2 * (fga + 0.44 * fta)
  return denom > 0 ? Math.round((pts / denom) * 100) : null
}

export function turnoverPct(tov: number, fga: number, fta: number): number | null {
  const denom = fga + 0.44 * fta + tov
  return denom > 0 ? Math.round((tov / denom) * 100) : null
}

export function formatAstTov(ast: number, tov: number): string {
  if (tov === 0) return ast === 0 ? "0.0" : "∞"
  return (ast / tov).toFixed(1)
}

export function offensiveRating(s: PlayerGameStats, sh: ShootingStats): number {
  return (
    s.pts +
    0.4 * sh.fgm -
    0.7 * sh.fga -
    0.4 * (sh.fta - sh.ftm) +
    0.7 * s.oreb +
    0.3 * s.dreb +
    0.7 * s.ast -
    0.4 * s.pf -
    s.tov
  )
}

export function defensiveRating(s: PlayerGameStats, def: DefenseStats): number {
  return s.stl + 0.7 * def.blocksNotAlreadyStopped + def.stops - def.timesBeaten - 0.4 * def.ptsAllowed
}

export interface TovSplit {
  liveBall: number
  shotBased: number
  total: number
}

export function computeTovSplit(state: PooleanState, playerId: string): TovSplit {
  let liveBall = 0
  let shotBased = 0
  qualifyingGamesForPlayer(state, playerId).forEach((game) => {
    game.turnoverEvents
      .filter((ev) => ev.playerId === playerId)
      .forEach((ev) => {
        if (ev.missEventId) shotBased++
        else liveBall++
      })
  })
  return { liveBall, shotBased, total: liveBall + shotBased }
}

const STAT_FIELDS = ["pts", "oreb", "dreb", "ast", "stl", "blk", "tov", "pf"] as const

export interface LeaderboardRow {
  player: Player
  gp: number
  wins: number
  losses: number
  ties: number
  winPct: number | null
  totals: PlayerGameStats
  shooting: ShootingStats
  ptsPer20: number
  astPer20: number
  tovSplit: TovSplit
  tovPct: number | null
  astTov: string
  tsPct: number | null
  offRatingPer20: number
  twoWayPer20: number
}

// Mirrors computeLeaderboardUncached() in app.js, trimmed to the columns this slice's Season
// Rates table shows (see the file header comment for exactly what's deferred).
export function computeLeaderboard(state: PooleanState): LeaderboardRow[] {
  return state.players.map((p) => {
    const gamesPlayed = qualifyingGamesForPlayer(state, p.id)
    const totals: PlayerGameStats = {
      playerId: p.id,
      pts: 0,
      oreb: 0,
      dreb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pf: 0,
    }
    const shooting: ShootingStats = { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 }
    const defense: DefenseStats = { ptsAllowed: 0, timesBeaten: 0, stops: 0, blocksNotAlreadyStopped: 0 }
    let wins = 0
    let losses = 0
    let ties = 0
    let combinedPoints = 0

    gamesPlayed.forEach((g) => {
      const s = g.stats.find((st) => st.playerId === p.id)
      if (s) STAT_FIELDS.forEach((f) => (totals[f] += s[f]))
      const sh = shootingStats(g, p.id)
      ;(Object.keys(shooting) as (keyof ShootingStats)[]).forEach((k) => (shooting[k] += sh[k]))
      const def = gameDefenseStats(g, p.id)
      defense.ptsAllowed += def.ptsAllowed
      defense.timesBeaten += def.timesBeaten
      defense.stops += def.stops
      defense.blocksNotAlreadyStopped += def.blocksNotAlreadyStopped
      combinedPoints += gameTotalPoints(g)
      const result = playerGameResult(g, p.id)
      if (result === "W") wins++
      else if (result === "L") losses++
      else if (result === "T") ties++
    })

    const gp = gamesPlayed.length
    const totalOffRating = offensiveRating(totals, shooting)
    const totalTwoWay = totalOffRating + defensiveRating(totals, defense)
    const per20 = (value: number) => (combinedPoints > 0 ? (value / combinedPoints) * 20 : 0)
    const tovSplit = computeTovSplit(state, p.id)

    return {
      player: p,
      gp,
      wins,
      losses,
      ties,
      winPct: wins + losses > 0 ? pct(wins, wins + losses) : null,
      totals,
      shooting,
      ptsPer20: per20(totals.pts),
      astPer20: per20(totals.ast),
      tovSplit,
      tovPct: turnoverPct(tovSplit.liveBall, shooting.fga, shooting.fta),
      astTov: formatAstTov(totals.ast, tovSplit.liveBall),
      tsPct: trueShootingPct(totals.pts, shooting.fga, shooting.fta),
      offRatingPer20: per20(totalOffRating),
      twoWayPer20: per20(totalTwoWay),
    }
  })
}

// ---- Games tab helpers (ported from app.js) ----

export function twoWayScore(s: PlayerGameStats, sh: ShootingStats, def: DefenseStats): number {
  return offensiveRating(s, sh) + defensiveRating(s, def)
}

// app.js's getOrCreatePlayerStats(), minus the "create": a rostered player with no stats row yet
// just reads as all zeros, without mutating the game.
export function getGameStats(game: Game, playerId: string): PlayerGameStats {
  return (
    game.stats.find((st) => st.playerId === playerId) ?? {
      playerId,
      pts: 0,
      oreb: 0,
      dreb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pf: 0,
    }
  )
}

export function liveScoreOf(game: Game, team: string[]): number {
  return [...(game.liveScores ?? []), ...(game.scorekeeperScores ?? [])].filter((s) => team.includes(s.pid)).reduce((sum, s) => sum + s.points, 0)
}

export function isLiveScoreOnly(game: Game): boolean {
  return game.scoringEvents.length === 0 && (game.liveScores ?? []).length + (game.scorekeeperScores ?? []).length > 0
}

export function isCurrentSeasonGame(state: PooleanState, game: Game): boolean {
  return !state.currentSeasonStartedAt || (game.date || "") >= state.currentSeasonStartedAt
}

export function effectiveFgPct(fgm: number, tpm: number, fga: number): number | null {
  return fga > 0 ? Math.round(((fgm + 0.5 * tpm) / fga) * 100) : null
}

export function formatVideoTime(t: number | null | undefined): string {
  if (t === null || t === undefined) return "—"
  const s = Math.max(0, Math.round(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

// ---- Planner helpers (ported from app.js) ----

// Same per-20 math as computeLeaderboard(), scoped to a specific subset of one player's games.
export function computeRateSummaryForGames(playerId: string, games: Game[]) {
  const totals: PlayerGameStats = { playerId, pts: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }
  const shooting: ShootingStats = { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 }
  const defense: DefenseStats = { ptsAllowed: 0, timesBeaten: 0, stops: 0, blocksNotAlreadyStopped: 0 }
  let combinedPoints = 0
  games.forEach((g) => {
    const s = g.stats.find((st) => st.playerId === playerId)
    if (s) STAT_FIELDS.forEach((f) => (totals[f] += s[f]))
    const sh = shootingStats(g, playerId)
    ;(Object.keys(shooting) as (keyof ShootingStats)[]).forEach((k) => (shooting[k] += sh[k]))
    const def = gameDefenseStats(g, playerId)
    defense.ptsAllowed += def.ptsAllowed
    defense.timesBeaten += def.timesBeaten
    defense.stops += def.stops
    defense.blocksNotAlreadyStopped += def.blocksNotAlreadyStopped
    combinedPoints += gameTotalPoints(g)
  })
  const totalOffRating = offensiveRating(totals, shooting)
  const totalTwoWay = totalOffRating + defensiveRating(totals, defense)
  const per20 = (value: number) => (combinedPoints > 0 ? (value / combinedPoints) * 20 : 0)
  return { gp: games.length, offRatingPer20: per20(totalOffRating), twoWayPer20: per20(totalTwoWay) }
}

// For each teammate this player has shared a team with, split their own games into "with" and
// "without" that teammate and compare per-20 output across the split.
export function computeTeammateSynergy(state: PooleanState, playerId: string) {
  const qualifyingGames = qualifyingGamesForPlayer(state, playerId)
  const teammateIds = new Set<string>()
  qualifyingGames.forEach((g) => {
    const myTeam = g.teamA.includes(playerId) ? g.teamA : g.teamB
    myTeam.forEach((id) => {
      if (id !== playerId) teammateIds.add(id)
    })
  })
  return [...teammateIds]
    .map((teammateId) => {
      const withGames: Game[] = []
      const withoutGames: Game[] = []
      qualifyingGames.forEach((g) => {
        const myTeam = g.teamA.includes(playerId) ? g.teamA : g.teamB
        ;(myTeam.includes(teammateId) ? withGames : withoutGames).push(g)
      })
      return {
        teammate: state.players.find((p) => p.id === teammateId),
        with: computeRateSummaryForGames(playerId, withGames),
        without: computeRateSummaryForGames(playerId, withoutGames),
      }
    })
    .filter((r): r is typeof r & { teammate: Player } => !!r.teammate)
    .sort((a, b) => b.with.gp - a.with.gp)
}

// League-wide scorer-vs-defender FG pairs (an event with several tagged defenders counts once per
// defender), as app.js's computeMatchupGrid().
export function computeMatchupCells(state: PooleanState) {
  const cells: Record<string, { fgm: number; fga: number }> = {}
  state.games.filter(isQualifyingGame).forEach((g) => {
    g.scoringEvents.forEach((ev) => {
      ;(ev.defenderIds || []).forEach((defenderId) => {
        const cell = (cells[`${ev.scorerId}|${defenderId}`] ||= { fgm: 0, fga: 0 })
        cell.fga++
        if (ev.made !== false) cell.fgm++
      })
    })
  })
  return (scorerId: string, defenderId: string) => cells[`${scorerId}|${defenderId}`] ?? null
}
