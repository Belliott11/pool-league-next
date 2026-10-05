import { describe, expect, it } from "vitest"
import { GUEST, myPlayerId } from "@/lib/identity"

const players = [{ id: "adam" }, { id: "ben" }]

describe("myPlayerId", () => {
  it("returns the chosen player while they still exist", () => {
    expect(myPlayerId("adam", players)).toBe("adam")
  })

  it("is null for guest, nothing chosen, or a player who was removed", () => {
    expect(myPlayerId(GUEST, players)).toBeNull()
    expect(myPlayerId(null, players)).toBeNull()
    expect(myPlayerId("zed", players)).toBeNull()
  })
})
