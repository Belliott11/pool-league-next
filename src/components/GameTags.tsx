import { Input } from "@/components/ui/input"
import type { Update } from "@/lib/store"
import type { Game } from "@/lib/types"
import { cn } from "@/lib/utils"

export const PICK_METHODS = [
  { key: "balanced", label: "App balanced" },
  { key: "captains", label: "Captains" },
  { key: "random", label: "Random" },
  { key: "runback", label: "Run it back" },
] as const
export type PickMethodKey = (typeof PICK_METHODS)[number]["key"]

// One tap: how the teams were decided. Tap the chosen one again to clear it.
export function PickChips({ value, onChange }: { value?: string; onChange: (v: PickMethodKey | undefined) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="How teams were picked">
      {PICK_METHODS.map((m) => (
        <button key={m.key} type="button" aria-pressed={value === m.key} onClick={() => onChange(value === m.key ? undefined : m.key)} className={cn("min-h-10 rounded-full border px-3 text-sm font-medium", value === m.key && "border-primary bg-primary text-primary-foreground")}>
          {m.label}
        </button>
      ))}
    </div>
  )
}

// Editors only, on a game's page: how teams were picked, what it was played to, and any house rules that night.
export function GameTagsEditor({ game, update }: { game: Game; update: Update }) {
  const patch = (fields: Partial<Game>) => update((s) => ({ ...s, games: s.games.map((g) => (g.id === game.id ? { ...g, ...fields } : g)) }))
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm" aria-label="Game setup">
      <span className="font-medium">How teams were picked</span>
      <PickChips value={game.teamsPickedBy} onChange={(v) => patch({ teamsPickedBy: v })} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="font-medium">Played to</span>
          <Input className="h-10 w-20" type="number" min={1} defaultValue={game.liveTarget ? Number(game.liveTarget) : ""} onBlur={(e) => patch({ liveTarget: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} />
        </label>
        <label className="flex min-w-48 flex-1 items-center gap-2">
          <span className="font-medium">House rules</span>
          <Input className="h-10" placeholder="Any rules that night" defaultValue={game.rules ?? ""} onBlur={(e) => patch({ rules: e.target.value.trim() || undefined })} />
        </label>
      </div>
    </section>
  )
}
