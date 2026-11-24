import { ArrowLeft } from "lucide-react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { pairRecord } from "@/lib/headToHead"
import { playerName } from "@/lib/players"
import type { Game, PooleanState } from "@/lib/types"
import { HeadToHeadCard } from "./HeadToHeadCard"

// Two players side by side, opened from search ("Ben vs Zach") at #/games/h2h/ben,zach: their record over every result, then the
// head-to-head card (filmed meetings with plays, record as teammates, the model's one on one), starting on this pair.
export function HeadToHeadPage({ state, ids, onBack, onOpenGame, onOpenPlayer }: { state: PooleanState; ids: string; onBack: () => void; onOpenGame: (g: Game) => void; onOpenPlayer: (id: string) => void }) {
  const [a, b] = ids.split(",")
  const known = (id?: string) => !!id && state.players.some((p) => p.id === id)
  const ok = known(a) && known(b) && a !== b
  const r = ok ? pairRecord(a, b) : null
  const name = (id: string) => playerName(state, id)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Button variant="ghost" className="self-start" onClick={onBack}>
        <ArrowLeft aria-hidden /> Back
      </Button>
      {ok && r && (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            {[a, b].map((id, i) => (
              <button key={id} type="button" onClick={() => onOpenPlayer(id)} className={`flex min-w-0 items-center gap-2 ${i ? "flex-row-reverse text-right" : ""}`}>
                <PlayerAvatar id={id} name={name(id)} size="lg" />
                <span className="truncate font-display text-lg font-bold hover:underline">{name(id)}</span>
              </button>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Against each other</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">{r.vs[0] + r.vs[1] ? `${r.vs[0]}-${r.vs[1]}` : "Never met"}</dd>
              {r.vs[0] + r.vs[1] > 0 && <dd className="text-xs text-muted-foreground">{name(a)}'s wins first</dd>}
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">As teammates</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">{r.together[0] + r.together[1] ? `${r.together[0]}-${r.together[1]}` : "Never"}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">Every result on record, filmed or not. The card below is from filmed games only.</p>
        </section>
      )}
      <HeadToHeadCard key={ids} state={state} onOpenGame={onOpenGame} initial={ok ? [a, b] : undefined} />
    </div>
  )
}
