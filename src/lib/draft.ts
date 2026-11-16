// A captains' draft in snake order (A, B, B, A, A, B...): each captain takes the best player left by the given rating.
export function snakeDraft(capA: string, capB: string, pool: string[], rating: (id: string) => number): { a: string[]; b: string[]; order: { id: string; to: "A" | "B" }[] } {
  const left = pool.filter((id) => id !== capA && id !== capB).sort((x, y) => rating(y) - rating(x))
  const a = [capA]
  const b = [capB]
  // The captain with the lower rating picks first.
  const first: "A" | "B" = rating(capA) <= rating(capB) ? "A" : "B"
  const other = first === "A" ? "B" : "A"
  const order = left.map((id, i) => ({ id, to: i % 4 === 0 || i % 4 === 3 ? first : other }))
  for (const p of order) (p.to === "A" ? a : b).push(p.id)
  return { a, b, order }
}
