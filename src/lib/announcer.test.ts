import { describe, expect, it } from "vitest"
import { callFor, type Snap } from "./announcer"

const name = (p: string) => ({ z: "Zach", b: "Ben" })[p] ?? p
const s = (baskets: Snap["baskets"], a: number, b: number, live = true): Snap => ({ id: "g", baskets, a, b, target: 15, live })

describe("announcer", () => {
  it("calls a basket with the score", () => {
    expect(callFor(s([], 6, 7), s([{ pid: "z", points: 3 }], 9, 7), name)).toBe("Zach, three. Team A leads 9 to 7.")
    expect(callFor(s([], 6, 8), s([{ pid: "b", points: 2 }], 8, 8), name)).toBe("Ben, two. Tied at 8.")
  })
  it("says game point when the next two would end it", () => {
    expect(callFor(s([], 11, 10), s([{ pid: "z", points: 2 }], 13, 10), name)).toBe("Zach, two. Team A leads 13 to 10. Game point, Team A.")
    expect(callFor(s([], 13, 11), s([{ pid: "b", points: 2 }], 13, 13), name)).toContain("Next basket could end it.")
  })
  it("calls the end once, and a basket taken back", () => {
    expect(callFor(s([{ pid: "z", points: 2 }], 13, 10), s([{ pid: "z", points: 2 }, { pid: "z", points: 2 }], 15, 10), name)).toBe("That's the game. Team A wins 15 to 10.")
    expect(callFor(s([], 15, 10, false), s([], 15, 10, false), name)).toBeNull()
    expect(callFor(s([{ pid: "z", points: 2 }], 8, 6), s([], 6, 6), name)).toBe("Basket taken back. Tied at 6.")
  })
  it("stays quiet on the first look at a game", () => {
    expect(callFor(null, s([{ pid: "z", points: 2 }], 2, 0), name)).toBeNull()
  })
})
