/// <reference types="node" />
import { readFileSync, writeFileSync } from "node:fs"
import { describe, it } from "vitest"
import { bestClips, gameClips } from "@/lib/clips"
import { seasonState } from "@/lib/offseason"
import { clipCutKey, cutKey, cutPath, cutWindow } from "@/lib/clipCuts"
import { clipId } from "@/lib/clipShare"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { gameVideoUrl, isDirectVideoUrl } from "@/lib/video"

// Step one of `npm run cut-clips` (scripts/cut-clips.mjs): lists the stretch of recording every clip on the site plays, from the league
// data in CLIP_STATE, into CLIP_PLAN. Skipped in a normal test run.
const TRAILER_PLAYS = 8
const stateFile = process.env.CLIP_STATE
const planFile = process.env.CLIP_PLAN
describe.skipIf(!stateFile || !planFile)("clip cut plan", () => {
  it("lists every clip's cut", () => {
    const state = JSON.parse(readFileSync(stateFile!, "utf8")) as PooleanState
    type Entry = { key: string; url: string; start: number; end: number; id: string; time: number; title: string; score: number; shareable: boolean; follow: ReturnType<typeof cutPath>; date: string; frameX: number | null; still: boolean }
    const plan = new Map<string, Entry>()
    for (const g of state.games) {
      const url = gameVideoUrl(state, g)
      if (!isDirectVideoUrl(url)) continue
      for (const c of gameClips(state, g)) {
        const w = cutWindow(c)
        const key = clipCutKey(url, c) // with the follow tag when the clip is followed
        const id = clipId(cutKey(url, w)) // share links stay the same whether or not a clip is followed
        // The picture for a share link is the moment of the play; where two clips share a cut, the better one names it.
        const prev = plan.get(key)
        if (!prev || c.score > prev.score) plan.set(key, { key, url: url.split("#")[0], ...w, id, follow: cutPath(c), date: c.date, frameX: c.frame && c.frame.z > 1.02 ? c.frame.x : null, still: c.kind === "still", time: c.time, title: `${c.kind === "marked" ? "Highlight" : c.kind === "still" ? "Moment" : c.label}, ${playerName(state, c.playerId)}`, score: c.score, shareable: !c.rough?.length })
      }
    }
    writeFileSync(planFile!, JSON.stringify([...plan.values()], null, 1))
    // The season trailer: the season's best plays (marked and kept highlights first), at most two from a game, none that goes badly for
    // anyone, in the order they happened.
    if (process.env.CLIP_TRAILER) {
      const top = bestClips(seasonState(state), { limit: 20, perGame: 2 }).filter((c) => !c.rough?.length && c.kind !== "still").slice(0, TRAILER_PLAYS)
      // Each with what the trailer's caption needs: the moment of the play in the cut, who and what, and the date.
      const plays = top
        .sort((x, y) => x.date.localeCompare(y.date) || x.time - y.time)
        .map((c) => {
          const g = state.games.find((x) => x.id === c.gameId)!
          const url = gameVideoUrl(state, g)
          if (!isDirectVideoUrl(url)) return null
          return { key: clipCutKey(url, c), at: Math.round((c.time - cutWindow(c).start) * 100) / 100, label: c.kind === "marked" ? "Highlight" : c.label, player: playerName(state, c.playerId), date: c.date }
        })
        .filter((k) => !!k)
      writeFileSync(process.env.CLIP_TRAILER, JSON.stringify(plays))
    }
  })
})
