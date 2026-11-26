import { describe, expect, it } from "vitest"
import fs from "node:fs"
import data from "@/data/poolean-seasons.json"
import { milestoneBook, nextUp, reachedIn, type MGame, type OldResult } from "@/lib/milestones"

const g = (id: string, date: string, teamA: string[], teamB: string[], winner: "A" | "B", pts: Record<string, number> = {}, extra: Partial<MGame> = {}): MGame => ({
  id,
  date,
  teamA,
  teamB,
  winner,
  liveScores: Object.entries(pts).map(([pid, points]) => ({ pid, points })),
  ...extra,
})

describe("milestones", () => {
  it("the game-alerts function runs the same file and the same old results", () => {
    expect(fs.readFileSync("supabase/functions/game-alerts/milestones.ts", "utf8")).toBe(fs.readFileSync("src/lib/milestones.ts", "utf8"))
    const d = data as unknown as { list: number[]; seasons: Record<string, { games: OldResult[] }> }
    const want = d.list.flatMap((y) => (d.seasons[String(y)]?.games ?? []).map((r) => ({ date: r.date, a: r.a, b: r.b, w: r.w })))
    expect(JSON.parse(fs.readFileSync("supabase/functions/game-alerts/old-results.json", "utf8"))).toEqual(want)
  })
  it("dates career points to the game that crossed the mark, and counts a single-game first once", () => {
    const book = milestoneBook([g("g1", "2027-06-01", ["a"], ["b"], "A", { a: 12 }), g("g2", "2027-06-02", ["a"], ["b"], "A", { a: 14 })], [])
    const a = book.byPlayer.get("a")!.map((m) => `${m.label}@${m.gameId}`)
    expect(a).toContain("25 career points@g2")
    expect(a.filter((x) => x.startsWith("First 10-point game"))).toEqual(["First 10-point game@g1"])
    expect(reachedIn(book, "g2").map((m) => m.label)).toContain("25 career points")
  })
  it("does not count a result twice when the old list already has it, and carries a streak across both", () => {
    const old: OldResult[] = Array.from({ length: 4 }, (_, i) => ({ date: `2026-08-0${i + 1}`, a: ["a"], b: ["b"], w: "A" }))
    // The same night as the old list's last result: already in it. The next one is new.
    const book = milestoneBook([g("dup", "2026-08-04", ["a"], ["b"], "A"), g("new", "2027-06-01", ["a"], ["b"], "A")], old)
    expect(book.totals.get("a")!.wins).toBe(5)
    expect(book.byPlayer.get("a")!.find((m) => m.kind === "streak")).toMatchObject({ value: 5, gameId: "new" })
  })
  it("leaves out test games and games still live, and lists the nearest marks ahead", () => {
    const book = milestoneBook([g("t", "2027-06-01", ["a"], ["b"], "A", { a: 30 }, { test: true }), g("l", "2027-06-01", ["a"], ["b"], "A", { a: 30 }, { liveInProgress: true }), g("r", "2027-06-02", ["a"], ["b"], "A", { a: 20 })], [])
    expect(book.totals.get("a")!.points).toBe(20)
    expect(nextUp(book, "a")[0].label).toBe("25 career points")
    expect(nextUp(book, "a")[0].left).toBe("5 points to go")
  })
})
