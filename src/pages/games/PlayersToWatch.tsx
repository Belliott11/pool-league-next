import { ArrowRight, Eye } from "lucide-react"
import { useMemo } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { watchList, type Kind, type Signal, type Watch } from "@/lib/watchList"

const LABEL: Record<Kind, string> = { twoWay: "Two-way per 20", scoring: "Points per 20", wins: "Win rate", power: "Old site power rank" }
const show = (s: Signal, v: number) => (s.kind === "wins" ? `${Math.round(v * 100)}%` : s.kind === "power" ? String(Math.round(v)) : v.toFixed(1))

function Row({ state, w, onOpenPlayer }: { state: PooleanState; w: Watch; onOpenPlayer: (id: string) => void }) {
  return (
    <li className="flex flex-col gap-0.5 text-sm">
      <button type="button" className="flex min-w-0 items-center gap-2 self-start text-left hover:underline" onClick={() => onOpenPlayer(w.id)}>
        <PlayerAvatar id={w.id} name={playerName(state, w.id)} size="sm" />
        <span className="truncate font-medium">{playerName(state, w.id)}</span>
      </button>
      {w.signals.map((s) => (
        <span key={s.kind} className="ml-9 flex items-center gap-1 text-xs tabular-nums text-muted-foreground" title={`${s.n} games or nights, first half then second half`}>
          {LABEL[s.kind]} {show(s, s.early)} <ArrowRight aria-hidden className="size-3" /> <span className="font-semibold text-foreground">{show(s, s.late)}</span>
        </span>
      ))}
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
      <p className="text-xs text-muted-foreground">Each line compares the first half of a player's record with the second half. It uses box scores where there are enough, points for games without them, and the old site's results and power rankings for games that were never filmed ({w.rated} players had something to compare). With this few games it is a hint, not a forecast.</p>
    </section>
  )
}
