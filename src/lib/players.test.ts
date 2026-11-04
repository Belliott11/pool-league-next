import { describe, expect, it } from "vitest"
import { resolvePlayer } from "@/lib/players"
import type { PooleanState } from "@/lib/types"

const state: PooleanState = {
  players: [
    { id: "adam", name: "Adam" },
    { id: "g-ian", name: "Ian" },
    { id: "logan-hoskins", name: "Logan H" },
    { id: "logan-watson", name: "Logan W" },
  ],
  games: [],
}

describe("resolvePlayer", () => {
  it("finds a player by exact id, by name, or by the name part of the id", () => {
    expect(resolvePlayer(state, "g-ian")?.id).toBe("g-ian")
    expect(resolvePlayer(state, "ian")?.id).toBe("g-ian")
    expect(resolvePlayer(state, "Ian")?.id).toBe("g-ian")
    expect(resolvePlayer(state, "logan hoskins")?.id).toBe("logan-hoskins")
    expect(resolvePlayer(state, "Logan-Watson")?.id).toBe("logan-watson")
  })

  it("answers nothing for an unknown or ambiguous link, never some other player", () => {
    expect(resolvePlayer(state, "nobody")).toBeNull()
    expect(resolvePlayer(state, "logan")).toBeNull()
  })
})
