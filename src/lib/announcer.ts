import { gameOver } from "@/lib/race"

// Announcer mode (src/components/Announcer.tsx): what to say out loud when a live game's score changes, from two snapshots of it.
// A new basket: who scored and what kind, then the score ("Zach, three. Team A leads 9 to 7."), plus "Game point" when the leader's
// next two would end it. A basket taken back says so. The end of the game is called once ("That's the game. Team A wins 15 to 12.").

export interface Basket {
  pid: string
  points: number
  at?: number
}

export interface Snap {
  id: string
  baskets: Basket[] // the editor's and friends' baskets together
  a: number
  b: number
  target: number
  live: boolean
}

const KIND: Record<number, string> = { 1: "free throw", 2: "two", 3: "three" }

export function scoreLine(a: number, b: number): string {
  if (a === b) return `Tied at ${a}.`
  return `Team ${a > b ? "A" : "B"} leads ${Math.max(a, b)} to ${Math.min(a, b)}.`
}

// Can this team end the game with an ordinary basket (a two) right now?
const gamePointFor = (us: number, them: number, target: number) => !gameOver(us, them, target) && gameOver(us + 2, them, target)

export function callFor(prev: Snap | null, next: Snap, name: (pid: string) => string): string | null {
  if (!prev || prev.id !== next.id) return null // first look at a game: nothing has happened yet
  const over = !next.live || gameOver(next.a, next.b, next.target)
  const wasOver = !prev.live || gameOver(prev.a, prev.b, prev.target)
  if (over && !wasOver) {
    if (next.a === next.b) return `That's the game. Tied at ${next.a}.`
    return `That's the game. Team ${next.a > next.b ? "A" : "B"} wins ${Math.max(next.a, next.b)} to ${Math.min(next.a, next.b)}.`
  }
  if (over) return null
  if (next.baskets.length < prev.baskets.length) return `Basket taken back. ${scoreLine(next.a, next.b)}`
  if (next.baskets.length === prev.baskets.length) return null
  // The newest of the new baskets (the two lists can interleave, so go by time when there is one).
  const added = next.baskets.slice(prev.baskets.length)
  const last = added.reduce((x, y) => ((y.at ?? 0) >= (x.at ?? 0) ? y : x), added[0])
  const parts = [`${name(last.pid)}, ${KIND[last.points] ?? `${last.points} points`}.`, scoreLine(next.a, next.b)]
  const pa = gamePointFor(next.a, next.b, next.target)
  const pb = gamePointFor(next.b, next.a, next.target)
  if (pa && pb) parts.push("Next basket could end it.")
  else if (pa || pb) parts.push(`Game point, Team ${pa ? "A" : "B"}.`)
  return parts.join(" ")
}
