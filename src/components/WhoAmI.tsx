import { UserRound } from "lucide-react"
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

// Header control: pick yourself from the players, or Guest. No password; it is remembered on this device.
export function WhoAmI({ state }: { state: PooleanState }) {
  const who = useWho()
  const me = myPlayerId(who, state.players)
  const name = me ? (state.players.find((p) => p.id === me)?.name ?? "You") : who === GUEST ? "Guest" : "Who are you?"
  return (
    <details className="relative">
      <summary className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer list-none gap-2 [&::-webkit-details-marker]:hidden`}>
        <UserRound aria-hidden className="size-4" />
        <span className="max-w-24 truncate max-sm:sr-only">{name}</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
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
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
      <UserRound aria-hidden className="size-4 text-muted-foreground" />
      <span className="min-w-0 flex-1">Who are you? The Player tab will open on you.</span>
      <div className="w-44">
        <WhoSelect state={state} />
      </div>
      <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setWho(GUEST)}>
        Not now
      </button>
    </div>
  )
}
