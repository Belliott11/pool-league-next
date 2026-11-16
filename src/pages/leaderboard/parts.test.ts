import { describe, expect, it } from "vitest"
import { sortValue } from "./parts"

describe("grid sort values", () => {
  it("reads the number a cell shows", () => {
    expect(sortValue("8 of 16 (50%)")).toBe(50)
    expect(sortValue("+0.38")).toBe(0.38)
    expect(sortValue("−0.13")).toBe(-0.13)
    expect(sortValue("1.23x")).toBe(1.23)
    expect(sortValue("58%(19 FGA)")).toBe(58)
    expect(sortValue("Ben")).toBe("ben")
    expect(sortValue("-")).toBeNull()
    expect(sortValue("Steady")).toBeGreaterThan(sortValue("Too early") as number)
  })
})
