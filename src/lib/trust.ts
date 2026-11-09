// How much to believe a number, given how much is behind it. Used by the player tables so a hot nine shots does not read
// like a skill.
export type Trust = "steady" | "some" | "early"
export const TRUST_LABEL: Record<Trust, string> = { steady: "Steady", some: "Some data", early: "Too early" }

const STEADY = { shots: 100, games: 15 }
const SOME = { shots: 30, games: 6 }
export const trustOf = (n: number, kind: keyof typeof STEADY): Trust => (n >= STEADY[kind] ? "steady" : n >= SOME[kind] ? "some" : "early")

// A rate pulled toward the league's: `k` is how many attempts of league-average play it starts with.
export const shrink = (total: number, att: number, league: number, k = 10) => (total + league * k) / (att + k)

// 90% Wilson range for a make rate, as fractions.
export function wilson(made: number, att: number, z = 1.645): [number, number] {
  if (att === 0) return [0, 1]
  const p = made / att
  const d = 1 + (z * z) / att
  const mid = (p + (z * z) / (2 * att)) / d
  const half = (z * Math.sqrt((p * (1 - p)) / att + (z * z) / (4 * att * att))) / d
  return [Math.max(0, mid - half), Math.min(1, mid + half)]
}
