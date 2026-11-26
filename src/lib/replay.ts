import type { Game } from "@/lib/types"

// The animated replay on the game page's Shots tab: every logged shot in order, with the score after it. Shots are in the order they were
// logged (by video time when every shot has one). A shot with a spot on the court (`shotLocation`, 0..100 across and up from the basket's
// end) is drawn there; a free throw or a shot with no spot only moves the score.

export interface ReplayStep {
  id: string
  side: "A" | "B" | null
  scorerId: string
  assistId: string | null
  points: number
  made: boolean
  at: { x: number; y: number } | null
  a: number // score after this shot
  b: number
  videoTime: number | null
}

export function replaySteps(game: Game): ReplayStep[] {
  const evs = [...game.scoringEvents]
  if (evs.length && evs.every((e) => typeof e.videoTime === "number")) evs.sort((x, y) => x.videoTime! - y.videoTime!)
  let a = 0
  let b = 0
  return evs.map((e) => {
    const side = game.teamA.includes(e.scorerId) ? "A" : game.teamB.includes(e.scorerId) ? "B" : null
    const made = e.made !== false
    if (made && side === "A") a += e.points
    if (made && side === "B") b += e.points
    return { id: e.id, side, scorerId: e.scorerId, assistId: e.assistId ?? null, points: e.points, made, at: e.shotLocation ?? null, a, b, videoTime: e.videoTime ?? null }
  })
}
