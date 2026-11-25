import { useMemo, useState } from "react"
import { ArrowLeft, Check, Share2 } from "lucide-react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { bestAgainst, taleOfTheTape, type TapeRow } from "@/lib/debate"
import { formatDateDisplay } from "@/lib/format"
import { mostMetPair, pairRecord } from "@/lib/headToHead"
import { playerName } from "@/lib/players"
import { SITE } from "@/lib/site"
import { cn } from "@/lib/utils"
import type { Game, PooleanState } from "@/lib/types"
import { HeadToHeadCard } from "./HeadToHeadCard"

// "Settle it" at #/games/h2h/<a>,<b> (from the Games home, search, or "Ben vs Zach" in search): two players for an argument. Their record
// over every result, the stats side by side with who each one favors (src/lib/debate.ts), their best games against each other, and the
// filmed head-to-head card. Changing a player changes the address, so a debate can be shared as a link.

function Picker({ state, value, onChange, label }: { state: PooleanState; value: string; onChange: (id: string) => void; label: string }) {
  const sorted = [...state.players].sort((x, y) => x.name.localeCompare(y.name))
  return (
    <select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {sorted.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

function TapeLine({ r }: { r: TapeRow }) {
  const both = r.a !== null && r.b !== null && Math.abs(r.a - r.b) > 1e-6
  const aWins = both && r.a! > r.b! === r.higher
  const bWins = both && !aWins
  const cell = (v: number | null, win: boolean, right: boolean) => (
    <span className={cn("w-16 shrink-0 tabular-nums", right ? "text-right" : "text-left", win ? "font-display text-base font-bold" : v === null ? "text-muted-foreground" : "")}>
      {v === null ? "-" : r.text(v)}
      {win && <span className="sr-only"> (better)</span>}
    </span>
  )
  return (
    <li className="flex items-center gap-2 border-t py-2 first:border-t-0">
      {cell(r.a, aWins, false)}
      <span className="min-w-0 flex-1 text-center">
        <span className="block text-sm font-medium">{r.label}</span>
        <span className="block text-xs text-muted-foreground">{r.note}</span>
      </span>
      {cell(r.b, bWins, true)}
    </li>
  )
}

export function HeadToHeadPage({
  state,
  ids,
  onBack,
  onOpenGame,
  onOpenPlayer,
  onPick,
}: {
  state: PooleanState
  ids: string
  onBack: () => void
  onOpenGame: (g: Game) => void
  onOpenPlayer: (id: string) => void
  onPick?: (ids: string) => void
}) {
  const known = (id?: string) => !!id && state.players.some((p) => p.id === id)
  const fallback = useMemo(() => mostMetPair(state), [state])
  const [ga, gb] = ids ? ids.split(",") : (fallback ?? ["", ""])
  const [a, setA] = useState(known(ga) ? ga : "")
  const [b, setB] = useState(known(gb) ? gb : "")
  const [copied, setCopied] = useState(false)
  const pick = (na: string, nb: string) => {
    setA(na)
    setB(nb)
    if (na && nb && na !== nb) onPick?.(`${na},${nb}`)
  }
  const ok = known(a) && known(b) && a !== b
  const r = ok ? pairRecord(a, b) : null
  const tape = useMemo(() => (ok ? taleOfTheTape(state, a, b) : null), [state, a, b, ok])
  const best = useMemo(() => (ok ? bestAgainst(state, a, b) : []), [state, a, b, ok])
  const name = (id: string) => playerName(state, id)
  const verdict = tape
    ? tape.aWins === tape.bWins
      ? `Dead even, ${tape.aWins} to ${tape.bWins}.`
      : `The stats favor ${name(tape.aWins > tape.bWins ? a : b)}, ${Math.max(tape.aWins, tape.bWins)} to ${Math.min(tape.aWins, tape.bWins)}.`
    : ""
  const share = async () => {
    if (!ok || !r || !tape) return
    const lines = [
      `${name(a)} vs ${name(b)}`,
      r.vs[0] + r.vs[1] ? `Against each other: ${name(r.vs[0] >= r.vs[1] ? a : b)} leads ${Math.max(...r.vs)}-${Math.min(...r.vs)}.` : "They have never been on opposite teams.",
      verdict,
      `${SITE}#/games/h2h/${a},${b}`,
    ]
    const text = lines.join("\n")
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ text })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // nothing more to try
    }
  }
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Button variant="ghost" className="self-start" onClick={onBack}>
        <ArrowLeft aria-hidden /> Back
      </Button>
      <div>
        <h2 className="font-display text-xl font-bold">Settle it</h2>
        <p className="text-sm text-muted-foreground">Any two players, side by side: their record, the stats, and their best games against each other.</p>
      </div>
      <div className="flex items-center gap-2">
        <Picker state={state} value={a} onChange={(v) => pick(v, b)} label="First player" />
        <span className="text-sm text-muted-foreground">vs</span>
        <Picker state={state} value={b} onChange={(v) => pick(a, v)} label="Second player" />
      </div>
      {ok && r && tape && (
        <>
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
            <p className="text-xs text-muted-foreground">Every result on record, filmed or not.</p>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="font-display">Tale of the tape</CardTitle>
              <p className="text-sm font-medium">{verdict}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>{name(a)}</span>
                <span>{name(b)}</span>
              </div>
              <ul>
                {tape.rows.map((row) => (
                  <TapeLine key={row.label} r={row} />
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                The better number in each row is in bold. A dash means not enough games yet (3 filmed games, 10 trips used, or 5 shots guarded). Filmed stats come from
                last summer's filmed games, so a few nights can still swing them.
              </p>
              <Button size="sm" variant="outline" className="self-start" onClick={() => void share()}>
                {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
                {copied ? "Copied" : "Share this debate"}
              </Button>
            </CardContent>
          </Card>

          {best.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Best games against each other</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {best.map((g) => (
                    <li key={`${g.id}|${g.game.id}`}>
                      <button type="button" onClick={() => onOpenGame(g.game)} className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted">
                        <span>
                          <span className="font-semibold">{name(g.id)}</span>, {formatDateDisplay(g.game.date)}
                          <span className="text-muted-foreground">{g.won ? ", won" : ", lost"}</span>
                        </span>
                        <span className="tabular-nums">
                          {g.line.pts} pts
                          {g.line.box ? `, ${g.line.reb} reb, ${g.line.ast} ast, ${g.line.fgm} of ${g.line.fga}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
      {ok ? (
        <HeadToHeadCard key={`${a},${b}`} state={state} onOpenGame={onOpenGame} initial={[a, b]} hidePicker />
      ) : (
        <p className="text-sm text-muted-foreground">Pick two different players to compare them.</p>
      )}
    </div>
  )
}
