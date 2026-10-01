import { Button } from "@/components/ui/button"
import type { PooleanState } from "@/lib/types"

// app.js's .attendee-chip pickers: a row of toggle chips, one per player.
export function PlayerChips({
  state,
  selected,
  onToggle,
}: {
  state: PooleanState
  selected: string[]
  onToggle: (id: string) => void
}) {
  const players = [...state.players].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => (
        <Button
          key={p.id}
          type="button"
          size="sm"
          variant={selected.includes(p.id) ? "default" : "outline"}
          onClick={() => onToggle(p.id)}
        >
          {p.name}
        </Button>
      ))}
    </div>
  )
}

export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}
