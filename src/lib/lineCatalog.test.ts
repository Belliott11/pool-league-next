import { describe, expect, it } from "vitest"
import { lineKey } from "@/lib/labels"
import { buildCatalog } from "@/lib/lineCatalog"
import type { PooleanState } from "@/lib/types"

const state: PooleanState = { players: [{ id: "a", name: "Adam" }, { id: "b", name: "Ben" }], games: [] }

describe("line catalog", () => {
  it("lists the label lines and injury notes even with no games, one entry per wording", () => {
    const c = buildCatalog(state)
    expect(c.some((l) => l.source.startsWith("Label Gunner"))).toBe(true)
    expect(c.some((l) => l.source.startsWith("Injury note"))).toBe(true)
    expect(new Set(c.map((l) => l.key)).size).toBe(c.length)
    for (const l of c) expect(l.key).toBe(lineKey(l.text))
  })
})
