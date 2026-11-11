import { BookOpenText } from "lucide-react"
import { useMemo } from "react"
import { Section } from "@/components/Section"
import { advancedReads, EARLY_GAMES, READ_MIN_GAMES, type Read, type Tone } from "@/lib/advancedReads"
import { isSeasonOnly } from "@/lib/season"
import type { PooleanState } from "@/lib/types"
import { Grid, Hint, Who } from "./parts"

const TONE: Record<string, string> = { good: "text-pos font-semibold", bad: "text-neg font-semibold" }
const cls = (t: Tone) => (t ? TONE[t] : "")
const pc = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`)
const sg = (v: number | null, d = 2) => (v === null ? "-" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}`)

function Card({ r, state, onOpenPlayer }: { r: Read; state: PooleanState; onOpenPlayer: (id: string) => void }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Who state={state} id={r.id} onOpenPlayer={onOpenPlayer} />
        <span className={`rounded-full bg-muted px-2 py-0.5 text-xs font-semibold ${r.early ? "text-gold" : "text-muted-foreground"}`}>
          {r.early ? "Early read: " : ""}
          {r.m.games} games, {r.m.shots} shots
        </span>
      </div>
      <p className="font-medium">{r.headline}</p>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)]">
        {r.lines.map((l) => (
          <div key={l.label} className="contents">
            <dt className={`text-muted-foreground font-semibold ${cls(l.tone)}`}>{l.label}</dt>
            <dd className="mb-2 min-w-0 sm:mb-0">{l.text}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

// Every regular's non-box-score stats in plain words, rebuilt from the data each time it is opened.
// Early in a season nobody has enough games yet, so it falls back to every game and says so.
export function AdvancedReads({ state, all = state, onOpenPlayer }: { state: PooleanState; all?: PooleanState; onOpenPlayer: (id: string) => void }) {
  const { reads, middle, fallback } = useMemo(() => {
    const now = advancedReads(state)
    return now.reads.length === 0 && isSeasonOnly(state) ? { ...advancedReads(all), fallback: true } : { ...now, fallback: false }
  }, [state, all])
  return (
    <Section id="lb-reads" title="Advanced reads" icon={BookOpenText} teaser="What the box score misses for each regular: shot quality, passing, ball security, defense, boards and winning.">
      {reads.length === 0 ? (
        <Hint>Shows up once players have {READ_MIN_GAMES} filmed even-team games.</Hint>
      ) : (
        <>
          {fallback && <Hint>Nobody has {READ_MIN_GAMES} filmed games this season yet, so these reads still include past seasons.</Hint>}
          <Hint>
            Every player with {READ_MIN_GAMES} or more filmed even-team games, written from the current data. Rates are per 25 combined points and every number is set against the league middle. Green and red mark clear gaps. Under {EARLY_GAMES} games is an early read.
          </Hint>
          <Grid
            min="52rem"
            head={["Player", "Games", "TS%", "Shot quality", "Set-ups/25", "Live TOV/25", "Beat rate", "Opp FG% in position", "Fought REB/25", "Win chance"]}
            rows={[
              { key: "mid", cells: [<span key="m" className="italic text-muted-foreground">League middle</span>, "", pc(middle.ts ?? null), sg(middle.quality ?? null), (middle.setups ?? 0).toFixed(1), (middle.liveTov ?? 0).toFixed(1), pc(middle.beatRate ?? null), pc(middle.oppFg ?? null), (middle.fought ?? 0).toFixed(1), sg(middle.wpa ?? null, 0)] },
              ...reads.map((r) => {
                const t = (label: string) => r.lines.find((l) => l.label === label)?.tone ?? null
                return {
                  key: r.id,
                  cells: [
                    <Who key="w" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />,
                    r.m.games,
                    <span key="ts" className={cls(t("Shooting"))}>{pc(r.m.ts)}</span>,
                    sg(r.m.quality),
                    <span key="su" className={cls(t("Passing"))}>{r.m.setups === null ? "-" : r.m.setups.toFixed(1)}</span>,
                    <span key="tv" className={cls(t("Ball"))}>{r.m.liveTov.toFixed(1)}</span>,
                    pc(r.m.beatRate),
                    pc(r.m.oppFg),
                    <span key="rb" className={cls(t("Boards"))}>{r.m.fought.toFixed(1)}</span>,
                    sg(r.m.wpa, 0),
                  ],
                }
              }),
            ]}
          />
          <div className="flex flex-col gap-3">
            {reads.map((r) => (
              <Card key={r.id} r={r} state={state} onOpenPlayer={onOpenPlayer} />
            ))}
          </div>
        </>
      )}
    </Section>
  )
}
