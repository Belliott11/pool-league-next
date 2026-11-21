/// <reference types="node" />
import { readFileSync, writeFileSync } from "node:fs"
import { describe, it } from "vitest"
import { gameClips } from "@/lib/clips"
import { cutKey, cutWindow } from "@/lib/clipCuts"
import type { PooleanState } from "@/lib/types"
import { gameVideoUrl, isDirectVideoUrl } from "@/lib/video"

// Step one of `npm run cut-clips` (scripts/cut-clips.mjs): lists the stretch of recording every clip on the site plays, from the league
// data in CLIP_STATE, into CLIP_PLAN. Skipped in a normal test run.
const stateFile = process.env.CLIP_STATE
const planFile = process.env.CLIP_PLAN
describe.skipIf(!stateFile || !planFile)("clip cut plan", () => {
  it("lists every clip's cut", () => {
    const state = JSON.parse(readFileSync(stateFile!, "utf8")) as PooleanState
    const plan = new Map<string, { key: string; url: string; start: number; end: number }>()
    for (const g of state.games) {
      const url = gameVideoUrl(state, g)
      if (!isDirectVideoUrl(url)) continue
      for (const c of gameClips(state, g)) {
        if (c.kind === "still") continue // a still never plays
        const w = cutWindow(c)
        const key = cutKey(url, w)
        plan.set(key, { key, url: url.split("#")[0], ...w })
      }
    }
    writeFileSync(planFile!, JSON.stringify([...plan.values()], null, 1))
  })
})
