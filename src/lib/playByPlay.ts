import type { Game } from "@/lib/types"

// A broadcast-style line under the score on the game video (src/components/ScoreOverlay.tsx): every logged shot and turnover with a
// video time, written from the shot log in the site's deadpan style ("Zach from deep, off Ben's pass. Good."). A shot's video time is
// the release, so a line comes up then and stays SHOW seconds; a turnover's line the same.
export const SHOW = 4

export interface PlayLine {
  t: number
  text: string
  good: boolean | null // a make, a miss, or neither (a turnover)
}

type Name = (pid: string) => string

const HOW: Record<string, string> = { drive: "on the drive", move: "off a move", deepHeave: "with a heave", catchAndShoot: "off the catch" }

export function playByPlay(game: Game, name: Name): PlayLine[] {
  const out: PlayLine[] = []
  const evs = game.scoringEvents ?? []
  for (const e of evs) {
    if (e.videoTime == null) continue
    const who = name(e.scorerId)
    const made = e.made !== false
    let shot: string
    if (e.dunk) shot = `${who} goes up for the dunk`
    else if (e.points === 1) shot = `${who} at the line`
    else if (e.points === 3) shot = e.shotType === "deepHeave" ? `${who} heaves it from deep` : `${who} from deep`
    else shot = e.shotType && HOW[e.shotType] ? `${who} ${HOW[e.shotType]}` : `${who} for two`
    const passed = !!e.assistId && e.shotType === "catchAndShoot" && e.points !== 3 && !e.dunk
    if (passed) shot = `${who} off ${name(e.assistId!)}'s pass`
    const pass = e.assistId && !passed ? `, off ${name(e.assistId)}'s pass` : ""
    const d = (e.defenderIds ?? []).filter(Boolean)
    const guard = !made && !e.blockerId && d.length && e.contestLevel === "heavy" ? `, ${name(d[0])} all over it` : made && d.length && e.contestLevel === "heavy" ? `, right over ${name(d[0])}` : ""
    let end: string
    if (made) end = "Good."
    else if (e.blockerId) end = `Blocked by ${name(e.blockerId)}.`
    else if (e.rebounderId) end = `No good. ${name(e.rebounderId)} with the board.`
    else end = "No good."
    out.push({ t: e.videoTime, text: `${shot}${pass}${guard}. ${end}`, good: made })
  }
  const steals = new Map((game.stealEvents ?? []).map((s) => [s.id, s]))
  for (const t of game.turnoverEvents ?? []) {
    if (t.missEventId) continue // a miss ruled out of bounds: the shot's line covers it
    const s = t.stealEventId ? steals.get(t.stealEventId) : undefined
    const at = t.videoTime ?? s?.videoTime
    if (at == null) continue
    const thief = s?.playerId ?? t.opponentId
    out.push({ t: at, text: thief ? `${name(thief)} picks off ${name(t.playerId)}.` : `${name(t.playerId)} gives it away.`, good: null })
  }
  return out.sort((a, b) => a.t - b.t)
}

// The line showing at a moment of the video, if any.
export function lineAt(lines: PlayLine[], t: number): PlayLine | null {
  let cur: PlayLine | null = null
  for (const l of lines) if (l.t <= t && t < l.t + SHOW) cur = l
  return cur
}
