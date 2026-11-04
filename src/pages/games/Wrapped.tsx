import { Share2, X } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { FlipDigits } from "@/components/FlipDigits"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { formatDateDisplay } from "@/lib/format"
import { myPlayerId, useWho } from "@/lib/identity"
import { ordinalOf } from "@/lib/ordinal"
import { playerName, resolvePlayer } from "@/lib/players"
import { shareWrappedCard } from "@/lib/shareCard"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"
import { wrappedFor, wrappedPlayers, type Slide } from "@/lib/wrapped"

const pct = (w: number, l: number) => (w + l ? Math.round((w / (w + l)) * 100) : 0)

// The big number starts at 0 and flips to its value once the slide is up.
function Big({ value, className }: { value: string | number; className?: string }) {
  const [shown, setShown] = useState<string | number>(0)
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 250)
    return () => clearTimeout(t)
  }, [value])
  return (
    <div className={cn("text-7xl leading-none text-accent", className)}>
      <FlipDigits value={shown} />
      <span className="sr-only">{value}</span>
    </div>
  )
}

// One slide's words and numbers. Every slide is a small headline, one big number or name, and a plain line under it.
function SlideBody({ s, state, name }: { s: Slide; state: PooleanState; name: string }) {
  const nm = (id: string) => playerName(state, id)
  const frame = (top: string, big: ReactNode, line: ReactNode) => (
    <>
      <p className="text-lg text-muted-foreground">{top}</p>
      {big}
      <p className="max-w-sm text-xl">{line}</p>
    </>
  )
  switch (s.kind) {
    case "intro":
      return frame(`${name}, here is your season.`, <Big value={s.gp} />, <>games played, across {s.nights} of {s.totalNights} nights. You went {s.w}-{s.l}, {pct(s.w, s.l)}% wins.</>)
    case "totals":
      return frame(
        "Points this season",
        <Big value={s.pts} />,
        <>
          {ordinalOf(s.ptsRank)} of {s.players} in the league.
          {s.twoWay !== null && s.twoWayRank !== null && <> Two-way total {s.twoWay}, {ordinalOf(s.twoWayRank)} in the league.</>}
        </>,
      )
    case "best":
      return frame(
        `Your best game, ${formatDateDisplay(s.date)}`,
        <Big value={s.line.pts} />,
        <>
          points
          {s.line.box &&
            [s.line.reb && `${s.line.reb} rebounds`, s.line.ast && `${s.line.ast} assists`, s.line.stl && `${s.line.stl} steals`, s.line.blk && `${s.line.blk} blocks`, s.line.twoWay !== null && `two-way ${s.line.twoWay.toFixed(1)}`]
              .filter(Boolean)
              .map((x) => `, ${x}`)
              .join("")}
          .
        </>,
      )
    case "teammate":
      return frame(
        "Your best teammate",
        <div className="flex items-center gap-4">
          <PlayerAvatar id={s.id} name={nm(s.id)} size="lg" />
          <span className="font-display text-5xl font-extrabold">{nm(s.id)}</span>
        </div>,
        <>You went {s.w}-{s.l} together.</>,
      )
    case "rival":
      return frame(
        "Your rival",
        <div className="flex items-center gap-4">
          <PlayerAvatar id={s.id} name={nm(s.id)} size="lg" />
          <span className="font-display text-5xl font-extrabold">{nm(s.id)}</span>
        </div>,
        <>You faced each other {s.w + s.l} times. You are {s.w}-{s.l} against them.</>,
      )
    case "awards":
      return frame(
        "Award race finishes",
        <ul className="flex flex-col gap-2">
          {s.finishes.map((f) => (
            <li key={f.label} className="flex items-baseline gap-3">
              <span className="font-display text-4xl font-extrabold text-accent">{ordinalOf(f.rank)}</span>
              <span className="text-xl">{f.label}</span>
            </li>
          ))}
        </ul>,
        <>Where you finished in each race this season.</>,
      )
    case "records":
      return frame(
        "Season records you hold",
        <ul className="flex flex-col gap-2">
          {s.rows.map((r) => (
            <li key={r.label} className="flex items-baseline gap-3">
              <span className="font-display text-4xl font-extrabold text-accent">{Number.isInteger(r.value) ? r.value : r.value.toFixed(1)}</span>
              <span className="text-xl">{r.label}</span>
            </li>
          ))}
        </ul>,
        <>Nobody did better in one game this season.</>,
      )
    case "summary":
      return frame(
        "That was your season",
        <span className="font-display text-5xl font-extrabold">{name}</span>,
        <>
          {s.w}-{s.l}, {s.pts} points{s.bestDate && <>, best night {formatDateDisplay(s.bestDate)}</>}. See you on opening night.
        </>,
      )
  }
}

// A tap-through story: right side of the screen goes forward, left side goes back.
export function Wrapped({ state, playerId, onPick, onClose }: { state: PooleanState; playerId?: string; onPick: (id: string) => void; onClose: () => void }) {
  const who = useWho()
  const ids = useMemo(() => wrappedPlayers(state), [state])
  const requested = playerId ? resolvePlayer(state, playerId) : null
  const id = requested && ids.includes(requested.id) ? requested.id : playerId ? undefined : (myPlayerId(who, state.players) ?? ids[0])
  const slides = useMemo(() => (id ? wrappedFor(state, id) : []), [state, id])
  const [i, setI] = useState(0)
  const [shared, setShared] = useState("")
  const at = Math.min(i, Math.max(0, slides.length - 1))
  const name = id ? playerName(state, id) : ""
  if (playerId && !id) {
    // A link for someone who is not a player here, or who has not played this season.
    return (
      <div className="flex flex-col items-start gap-3">
        <p>{requested ? `${requested.name} has no Season Wrapped: they have not played a game this season.` : `No player matches "${playerId}".`}</p>
        {ids.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">These players have one:</p>
            <div className="flex flex-wrap gap-2">
              {ids.map((p) => (
                <Button key={p} size="sm" variant="outline" onClick={() => onPick(p)}>
                  {playerName(state, p)}
                </Button>
              ))}
            </div>
          </>
        )}
        <Button variant="ghost" onClick={onClose}>
          Back to games
        </Button>
      </div>
    )
  }
  if (!id || slides.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">Nobody has played a game this season yet, so there is nothing to wrap.</p>
        <Button variant="outline" onClick={onClose}>
          Back to games
        </Button>
      </div>
    )
  }
  const s = slides[at]
  const share = async () => {
    const intro = slides.find((x) => x.kind === "intro")
    const totals = slides.find((x) => x.kind === "totals")
    const mate = slides.find((x) => x.kind === "teammate")
    const lines = [
      intro?.kind === "intro" ? { big: `${intro.w}-${intro.l}`, label: `${intro.gp} games, ${pct(intro.w, intro.l)}% wins` } : null,
      totals?.kind === "totals" ? { big: String(totals.pts), label: `points, ${ordinalOf(totals.ptsRank)} in the league` } : null,
      mate?.kind === "teammate" ? { big: playerName(state, mate.id), label: `best teammate, ${mate.w}-${mate.l} together` } : null,
    ].filter((x): x is { big: string; label: string } => !!x)
    try {
      await shareWrappedCard(name, lines, "Backyard pool basketball")
      setShared("")
    } catch {
      setShared("Could not make the picture.")
    }
  }
  const go = (d: number) => setI(Math.max(0, Math.min(slides.length - 1, at + d)))
  return (
    <div data-no-swipe className="anim-page fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex gap-1 px-4 pt-4" aria-hidden>
        {slides.map((_, k) => (
          <span key={k} className={cn("h-1 flex-1 rounded-full", k <= at ? "bg-accent" : "bg-muted")} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <select className="h-10 rounded-md border bg-card px-2 text-sm" aria-label="Whose season" value={id} onChange={(e) => (setI(0), onPick(e.target.value))}>
          {ids.map((p) => (
            <option key={p} value={p}>
              {playerName(state, p)}
            </option>
          ))}
        </select>
        <button type="button" onClick={onClose} aria-label="Close Season Wrapped" className="flex size-11 items-center justify-center rounded-full border">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <section key={`${id}-${at}`} aria-live="polite" className="anim-rise mx-auto flex h-full max-w-lg flex-col justify-center gap-5 px-6">
          <SlideBody s={s} state={state} name={name} />
          {s.kind === "summary" && (
            <Button className="relative z-10 self-start" onClick={() => void share()}>
              <Share2 aria-hidden /> Share my season
            </Button>
          )}
          {shared && <p className="text-sm text-neg">{shared}</p>}
        </section>
        <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3" onClick={() => go(-1)} />
        <button type="button" aria-label="Next" className={cn("absolute inset-y-0 right-0 w-2/3", s.kind === "summary" && "pointer-events-none")} onClick={() => go(1)} />
      </div>
      <p className="px-4 pb-4 text-center text-xs text-muted-foreground">
        {at + 1} of {slides.length}. Tap the right side for next, the left side to go back.
      </p>
    </div>
  )
}
