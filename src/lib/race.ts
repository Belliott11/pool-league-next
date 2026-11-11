// The league's scoring rule: first to the target, and you have to win by 2. Everything that asks "is the game over" or "who is
// likely to win from here" goes through this file, so the rule lives in one place.
export const WIN_BY = 2

export const gameOver = (a: number, b: number, target: number) => (a >= target || b >= target) && Math.abs(a - b) >= WIN_BY

// Point values of a made basket and how often each happens, e.g. [[1, 0.01], [2, 0.81], [3, 0.18]].
export type Mix = [number, number][]

// Once both teams are within WIN_BY - 1 of the target, only the margin matters: whoever gets WIN_BY ahead wins. Those few margins feed
// each other in a loop, so they are solved by repeating the update until it settles.
function deuce(q: number, mix: Mix): (d: number) => number {
  const p = new Map<number, number>()
  for (let d = -WIN_BY + 1; d < WIN_BY; d++) p.set(d, 0.5)
  const at = (d: number) => (d >= WIN_BY ? 1 : d <= -WIN_BY ? 0 : p.get(d)!)
  for (let i = 0; i < 500; i++)
    for (let d = -WIN_BY + 1; d < WIN_BY; d++) p.set(d, mix.reduce((n, [k, w]) => n + w * (q * at(d + k) + (1 - q) * at(d - k)), 0))
  return at
}

// Chance team A wins from a score of a to b, when each basket goes to A with chance q and is worth points in `mix`.
export function raceWin(a: number, b: number, target: number, q: number, mix: Mix): number {
  const tie = deuce(q, mix)
  const floor = target - WIN_BY + 1
  const memo = new Map<string, number>()
  const go = (x: number, y: number): number => {
    if (x >= target && x - y >= WIN_BY) return 1
    if (y >= target && y - x >= WIN_BY) return 0
    if (Math.min(x, y) >= floor) return tie(x - y)
    const key = `${x}|${y}`
    const hit = memo.get(key)
    if (hit !== undefined) return hit
    const v = mix.reduce((n, [k, w]) => n + w * (q * go(x + k, y) + (1 - q) * go(x, y + k)), 0)
    memo.set(key, v)
    return v
  }
  return go(a, b)
}

// A short line for the scoreboard: who won, who is one basket from it, or how far there is to go.
export function raceLine(a: number, b: number, target: number): string {
  const lead = a > b ? "A" : "B"
  const hi = Math.max(a, b)
  if (gameOver(a, b, target)) return `Team ${lead} won, ${hi} to ${Math.min(a, b)}.`
  if (a === b) return hi >= target - 1 ? `Tied at ${a}. Win by ${WIN_BY}.` : `Tied. First to ${target}, win by ${WIN_BY}.`
  if (hi >= target) return `Team ${lead} leads by ${hi - Math.min(a, b)} at ${hi}. Win by ${WIN_BY}.`
  return `Team ${lead} leads by ${Math.abs(a - b)}. ${target - hi} to go.`
}
