import { ArrowRight, Eye } from "lucide-react"
import { useMemo } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { watchList, type Watch } from "@/lib/watchList"

const num = (n: number) => n.toFixed(1)

function Row({ state, w, onOpenPlayer }: { state: PooleanState; w: Watch; onOpenPlayer: (id: string) => void }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline" onClick={() => onOpenPlayer(w.id)}>
        <PlayerAvatar id={w.id} name={playerName(state, w.id)} size="sm" />
        <span className="truncate font-medium">{playerName(state, w.id)}</span>
      </button>
      <span className="flex items-center gap-1 tabular-nums text-muted-foreground" title="Two-way per 20, first half of their games then second half">
        {num(w.early)} <ArrowRight aria-hidden className="size-3" /> <span className="font-semibold text-foreground">{num(w.late)}</span>
      </span>
    </li>
  )
}

// Two short lists for next season, from how each player finished against how they started. It is a hint from a few
// games, and the card says so.
export function PlayersToWatch({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const w = useMemo(() => watchList(state), [state])
  if (w.rising.length === 0 && w.bounce.length === 0) return null
  return (
    <section className="flex flex-col gap-3" aria-label="Players to watch">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Eye aria-hidden className="size-4 text-accent" /> Players to watch
      </h4>
      {w.rising.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium">Finishing strong</p>
          <p className="text-xs text-muted-foreground">Played better in the second half of their games than the first.</p>
          <ul className="flex flex-col gap-1.5">
            {w.rising.map((r) => (
              <Row key={r.id} state={state} w={r} onOpenPlayer={onOpenPlayer} />
            ))}
          </ul>
        </div>
      )}
      {w.bounce.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium">Due a bounce back</p>
          <p className="text-xs text-muted-foreground">Cooled off late, but were above the middle of the league over the whole season.</p>
          <ul className="flex flex-col gap-1.5">
            {w.bounce.map((r) => (
              <Row key={r.id} state={state} w={r} onOpenPlayer={onOpenPlayer} />
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Numbers are two-way per 20, first half of a player's games then the second half, from box-scored games ({w.rated} players had at least 4). With this few games it is a hint, not a forecast.</p>
    </section>
  )
}
