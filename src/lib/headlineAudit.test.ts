/// <reference types="node" />
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { LABELS } from "@/lib/labels"
import { gameDays, summarizeNight } from "@/lib/nightRecap"
import { nightCallouts } from "@/lib/records"
import { nightStories } from "@/lib/storylines"
import type { PooleanState } from "@/lib/types"

describe("label library", () => {
  it("has no repeated or oversized lines", () => {
    for (const l of LABELS) {
      for (const [ev, lines] of Object.entries(l.lines)) {
        expect(new Set(lines).size, `${l.key}.${ev} repeats a line`).toBe(lines?.length)
        for (const t of lines ?? []) expect(t.length, `${l.key}.${ev}: ${t}`).toBeLessThan(150)
      }
    }
  })
})

// Run with `npm run audit-headlines --backup=backup.json`: writes every night's recap from a real backup and lists the
// wordings that keep coming back, so the repeats are easy to spot and thumb down or reword.
const file = process.env.npm_config_backup
describe.skipIf(!file)("headline audit", () => {
  it("lists repeated headlines across nights", () => {
    const raw = JSON.parse(readFileSync(file as string, "utf8"))
    const state = (raw.state ?? raw) as PooleanState
    const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? id
    const seen = new Map<string, number>()
    const shape = new Map<string, number>()
    for (const date of gameDays(state)) {
      const lines = nightStories(state, summarizeNight(state, date), nightCallouts(state, date), name)
      for (const x of lines) {
        seen.set(x, (seen.get(x) ?? 0) + 1)
        const key = x.replace(/\d+(\.\d+)?/g, "#").replace(new RegExp(state.players.map((p) => p.name).join("|"), "g"), "N")
        shape.set(key, (shape.get(key) ?? 0) + 1)
      }
    }
    const top = (m: Map<string, number>) => [...m.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 15)
    console.log("\nSame line on more than one night:\n" + (top(seen).map(([t, n]) => `  ${n}x  ${t}`).join("\n") || "  none"))
    console.log("\nSame wording with different names or numbers:\n" + (top(shape).map(([t, n]) => `  ${n}x  ${t}`).join("\n") || "  none"))
    expect(seen.size).toBeGreaterThan(0)
  })
})
