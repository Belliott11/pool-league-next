import { useMemo } from "react"
import { formatDateDisplay } from "@/lib/format"
import { dramaRanking, dramaWords, type Drama } from "@/lib/drama"
import type { Game, PooleanState } from "@/lib/types"

// The drama rating (drama.ts) on the game page, under the summary lines.
export const dramaPoints = (d: Drama) => Math.round(d.score * 100)
const ordinal = (n: number) => (n === 1 ? "the most" : `the ${n}${n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"} most`)
const sentence = (words: string[]) => (words.length ? ` ${words.join(", ").replace(/^./, (c) => c.toUpperCase())}.` : "")

export function GameDrama({ state, game }: { state: PooleanState; game: Game }) {
  const ranking = useMemo(() => dramaRanking(state), [state])
  const i = ranking.findIndex((d) => d.gameId === game.id)
  if (i < 0 || ranking.length < 3) return null
  const d = ranking[i]
  return (
    <p className="border-t pt-3 text-sm">
      <span className="text-muted-foreground">Drama: </span>
      <span className="font-semibold tabular-nums">{dramaPoints(d)}</span>, {ordinal(i + 1)} of {ranking.length} games (how far the win chance moved in all).
      {sentence(dramaWords(d))}
    </p>
  )
}

// The most dramatic games, for the Hall of Fame and the night recap.
export function DramaList({ state, onOpenGame, date, limit = 5, names }: { state: PooleanState; onOpenGame: (id: string) => void; date?: string; limit?: number; names: (g: Game) => string }) {
  const rows = useMemo(() => dramaRanking(state, date), [state, date]).slice(0, limit)
  if (!rows.length) return null
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((d) => {
        const g = state.games.find((x) => x.id === d.gameId)!
        const words = dramaWords(d)
        return (
          <li key={d.gameId}>
            <button type="button" onClick={() => onOpenGame(d.gameId)} className="flex w-full items-baseline justify-between gap-3 text-left hover:underline">
              <span className="min-w-0">
                <span className="text-xs text-muted-foreground">{formatDateDisplay(d.date)}. </span>
                {names(g)}
                {words.length > 0 && <span className="block text-xs text-muted-foreground">{words.join(", ").replace(/^./, (c) => c.toUpperCase())}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{dramaPoints(d)}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
