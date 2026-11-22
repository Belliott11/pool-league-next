import { expect, test } from "vitest"
import { mvhdStart, placeGames } from "@/lib/recordingTime"
import type { Game, PooleanState } from "@/lib/types"

const mvhd = (whenMs: number) => {
  const b = new Uint8Array(64)
  b.set([0, 0, 0, 108], 0)
  b.set([0x6d, 0x76, 0x68, 0x64], 4) // "mvhd"
  new DataView(b.buffer).setUint32(12, Math.round((whenMs - Date.UTC(1904, 0, 1)) / 1000))
  return b
}

test("reads when a recording started from its movie header, and ignores an empty one", () => {
  const when = Date.UTC(2026, 7, 16, 23, 5, 0)
  expect(mvhdStart(mvhd(when))).toBe(when)
  expect(mvhdStart(mvhd(Date.UTC(1904, 0, 1)))).toBeNull()
  expect(mvhdStart(new Uint8Array(100))).toBeNull()
})

test("places live games in the recording by the clock, never moving a game placed by hand or one from another time", () => {
  const rec = Date.UTC(2026, 7, 16, 23, 0, 0)
  const at = (min: number) => new Date(rec + min * 60_000).toISOString()
  const g = (id: string, extra: object) => ({ id, date: "2026-08-16", teamA: [], teamB: [], masterVideoId: "m1", ...extra }) as unknown as Game
  const state = { players: [], games: [g("a", { startedAt: at(5), endedAt: at(17) }), g("b", { startedAt: at(20), videoStart: 1234 }), g("c", { startedAt: at(200) }), g("d", {})] } as unknown as PooleanState
  const { state: out, placed } = placeGames(state, (x) => x.masterVideoId === "m1", rec, 45 * 60)
  expect(placed).toBe(1)
  expect(out.games[0]).toMatchObject({ videoStart: 5 * 60 - 20, videoEnd: 17 * 60 + 10 })
  expect(out.games[1].videoStart).toBe(1234)
  expect(out.games[2].videoStart).toBeUndefined()
})
