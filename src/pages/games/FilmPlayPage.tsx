import { useMemo } from "react"
import { Clapperboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/EmptyState"
import { FilmPlay } from "@/components/FilmRoom"
import { findPlay } from "@/lib/filmRoom"
import type { PooleanState } from "@/lib/types"

// A play someone sent from the film room (#/games/film/<game id>.<play id>): the play with its speed, loop and notes, and a way to its game.
export function FilmPlayPage({ state, arg, onBack, onOpenGame }: { state: PooleanState; arg: string; onBack: () => void; onOpenGame: (id: string) => void }) {
  const dot = arg.indexOf(".")
  const gameId = dot > 0 ? arg.slice(0, dot) : ""
  const id = dot > 0 ? arg.slice(dot + 1) : ""
  const play = useMemo(() => (gameId && id ? findPlay(state, gameId, id) : null), [state, gameId, id])
  return (
    <div className="anim-page mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          &larr; Back
        </Button>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Clapperboard aria-hidden className="size-5" /> Film
        </h2>
      </div>
      {play ? (
        <>
          <FilmPlay state={state} play={play} />
          <Button variant="outline" size="sm" className="self-start" onClick={() => onOpenGame(play.gameId)}>
            Open the whole game
          </Button>
        </>
      ) : (
        <EmptyState title="That play is not here" hint="It may have been edited since the link was sent." />
      )}
    </div>
  )
}
