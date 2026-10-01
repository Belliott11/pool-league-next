import type { PooleanState } from "./types"

export function playerName(state: PooleanState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? "?"
}

export function playerInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?"
}

// Same idea as app.js's avatarHueForPlayer(): a stable color per player id, not random per
// render, so a player's fallback-initial avatar always looks the same.
export function avatarHueForPlayer(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return hash % 360
}
