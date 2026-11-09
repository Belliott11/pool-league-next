import type { PooleanState } from "@/lib/types"

// A "who" picker for league cards: everyone, or one player who has played a game.
export function PlayerPick({ state, value, onChange }: { state: PooleanState; value: string; onChange: (id: string) => void }) {
  const players = [...state.players].filter((p) => state.games.some((g) => g.teamA.includes(p.id) || g.teamB.includes(p.id))).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Show</span>
      <select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm sm:flex-none" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Show everyone or one player">
        <option value="">Everyone</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </label>
  )
}
