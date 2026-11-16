// A captains' draft: each captain takes the best player left by the given rating, and the captain with the lower rating picks first.
// When the captains are close it is a snake (first, second, second, first). When one captain is clearly better, a snake still
// leaves that captain's team favored about 6 times in 10 on the league's numbers, so the weaker captain gets every other pick
// instead (first, second, first, second), which brings it back to even.
export const CAPTAIN_GAP = 1.5 // two-way points per 25 between the captains
export function snakeDraft(capA: string, capB: string, pool: string[], rating: (id: string) => number): { a: string[]; b: string[]; order: { id: string; to: "A" | "B" }[]; snake: boolean } {
  const left = pool.filter((id) => id !== capA && id !== capB).sort((x, y) => rating(y) - rating(x))
  const a = [capA]
  const b = [capB]
  // The captain with the lower rating picks first.
  const first: "A" | "B" = rating(capA) <= rating(capB) ? "A" : "B"
  const other = first === "A" ? "B" : "A"
  const snake = Math.abs(rating(capA) - rating(capB)) < CAPTAIN_GAP
  const order = left.map((id, i) => ({ id, to: (snake ? i % 4 === 0 || i % 4 === 3 : i % 2 === 0) ? first : other }))
  for (const p of order) (p.to === "A" ? a : b).push(p.id)
  return { a, b, order, snake }
}
