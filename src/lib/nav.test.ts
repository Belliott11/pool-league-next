import { describe, expect, it } from "vitest"
import { hashToView, viewToHash, type View } from "@/lib/nav"

const views: View[] = [
  { tab: "games", sub: "", player: null },
  { tab: "games", sub: "game:abc123", player: null },
  { tab: "games", sub: "stat:abc123", player: null },
  { tab: "games", sub: "recap:2026-08-10", player: null },
  { tab: "games", sub: "live", player: null },
  { tab: "leaderboard", sub: "", player: null },
  { tab: "player", sub: "", player: "g-michael-t" },
  { tab: "players", sub: "", player: null },
  { tab: "export", sub: "", player: null },
]

describe("nav hashes", () => {
  it("round trips every view", () => {
    for (const v of views) expect(hashToView(viewToHash(v))).toEqual(v)
  })

  it("still reads the classic share links", () => {
    expect(hashToView("#game=xyz")).toEqual({ tab: "games", sub: "game:xyz", player: null })
    expect(hashToView("#player=adam")).toEqual({ tab: "player", sub: "", player: "adam" })
  })

  it("ignores things it does not know", () => {
    expect(hashToView("")).toBeNull()
    expect(hashToView("#/nope")).toBeNull()
    expect(hashToView("#section")).toBeNull()
  })
})
