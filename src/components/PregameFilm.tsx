import { useMemo } from "react"
import { Clapperboard } from "lucide-react"
import { PlaysToWatch } from "@/components/FilmRoom"
import { scoutGame } from "@/lib/filmRoom"
import { liveOpenForVotes } from "@/lib/pickem"
import { playerName } from "@/lib/players"
import type { Game, PooleanState } from "@/lib/types"

// "Film before you play" on both live screens until the first basket (src/lib/filmRoom.ts scoutGame): each player's go-to kind of shot
// over every filmed game, with two of their makes of that kind to watch, so both sides know what to take away.
export function PregameFilm({ state, game }: { state: PooleanState; game: Game }) {
  const teams = useMemo(() => [scoutGame(state, game.teamA), scoutGame(state, game.teamB)] as const, [state, game.teamA, game.teamB])
  if (!liveOpenForVotes(game) || (!teams[0].length && !teams[1].length)) return null
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-3" aria-label="Film before you play">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Clapperboard aria-hidden className="size-4 text-accent" /> Film before you play
      </h3>
      <p className="text-xs text-muted-foreground">Each player's go-to shot from every filmed game. Gone at the first basket.</p>
      {teams.map((list, i) =>
        list.length ? (
          <div key={i} className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: `var(--color-team-${i ? "b" : "a"})` }} /> Team {i ? "B" : "A"}
            </span>
            <ul className="flex flex-col gap-2">
              {list.map((s) => (
                <li key={s.id} className="flex flex-col gap-1 text-sm">
                  <span>
                    <span className="font-medium">{playerName(state, s.id)}</span>: {s.best.label}, {s.best.pps.toFixed(2)} points a shot ({s.best.shots})
                  </span>
                  <PlaysToWatch state={state} plays={s.plays} label={`Watch ${s.plays.length === 1 ? "it" : `${s.plays.length} of them`}`} />
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </section>
  )
}
