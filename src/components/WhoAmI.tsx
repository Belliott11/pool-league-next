import { UserRound } from "lucide-react"
import { useId } from "react"
import { buttonVariants } from "@/components/ui/button"
import { GUEST, myPlayerId, setWho, useWho } from "@/lib/identity"
import type { PooleanState } from "@/lib/types"

function WhoSelect({ state, id }: { state: PooleanState; id?: string }) {
  const who = useWho()
  return (
    <select
      id={id}
      aria-label="Who are you?"
      className="h-10 w-full rounded-md border bg-background px-2 text-sm"
      value={who ?? ""}
      onChange={(e) => e.target.value && setWho(e.target.value)}
    >
      <option value="" disabled>
        Choose who you are
      </option>
      <option value={GUEST}>Guest</option>
      {[...state.players]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  )
}

// The same picker, placed where it is needed: in a voting card for someone who has not said who they are.
export function IdentityPrompt({ state, text }: { state: PooleanState; text: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed p-3">
      <label htmlFor={id} className="text-sm font-medium">
        {text}
      </label>
      <WhoSelect state={state} id={id} />
      <p className="text-xs text-muted-foreground">No password. It is kept on this device.</p>
    </div>
  )
}

// Header control: pick yourself from the players, or Guest. No password; it is remembered on this device.
export function WhoAmI({ state }: { state: PooleanState }) {
  const who = useWho()
  const me = myPlayerId(who, state.players)
  const name = me ? (state.players.find((p) => p.id === me)?.name ?? "You") : who === GUEST ? "Guest" : "Who are you?"
  return (
    <details data-menu className="relative max-sm:static">
      <summary className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer list-none gap-2 [&::-webkit-details-marker]:hidden`}>
        <UserRound aria-hidden className="size-4" />
        <span className="max-w-24 truncate max-sm:sr-only">{name}</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 max-sm:left-4 max-sm:right-4 max-sm:w-auto max-sm:max-h-[75vh] max-sm:overflow-y-auto rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
        <div className="mb-2 font-semibold">Who are you?</div>
        <WhoSelect state={state} />
        <p className="mt-2 text-xs text-muted-foreground">No password. This only makes the Player tab open on you, and it is kept on this device.</p>
      </div>
    </details>
  )
}

// Shown once to anyone who has not chosen yet; picking anything, or dismissing, ends it.
export function WhoPrompt({ state }: { state: PooleanState }) {
  const who = useWho()
  if (who !== null) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm">
      <UserRound aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 max-sm:hidden">Who are you? The Player tab will open on you.</span>
      <span className="flex-1 font-medium sm:hidden">Who are you?</span>
      <div className="min-w-0 max-sm:order-last max-sm:basis-full sm:w-44 sm:flex-none">
        <WhoSelect state={state} />
      </div>
      <button type="button" className="min-h-10 shrink-0 px-2 text-xs text-muted-foreground underline" onClick={() => setWho(GUEST)}>
        Not now
      </button>
    </div>
  )
}

// The first thing a new visitor sees on the Games home: what the site is and three steps to make it theirs. Picking a player (or "Just
// looking") ends it; after that the Games home opens with "Next up for you" (src/pages/games/MyCard.tsx) instead.
export function Welcome({ state }: { state: PooleanState }) {
  const who = useWho()
  const id = useId()
  if (who !== null) return null
  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div>
        <h2 id={`${id}-h`} className="font-display text-xl font-bold">
          Welcome to Poolean Intel
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Scores, stats, film and odds from our pool basketball games, all from the videos.</p>
      </div>
      <ol className="flex flex-col gap-3 text-sm">
        <li className="flex gap-3">
          <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={id} className="font-medium">
              Tell us who you are
            </label>
            <WhoSelect state={state} id={id} />
            <span className="text-xs text-muted-foreground">No password or account. It is kept on this phone.</span>
          </div>
        </li>
        <li className="flex gap-3">
          <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold">2</span>
          <span>
            <span className="font-medium">The You tab is your page:</span> where you stand, your best plays and your film.
          </span>
        </li>
        <li className="flex gap-3">
          <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold">3</span>
          <span>
            <span className="font-medium">This page has what is on now:</span> live games, Pick'em, the last night and the season teams.
          </span>
        </li>
      </ol>
      <button type="button" className="min-h-10 self-start text-sm text-muted-foreground underline" onClick={() => setWho(GUEST)}>
        Just looking
      </button>
    </section>
  )
}
