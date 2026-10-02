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

// Same photo map as the classic site (files live in public/photos).
const PLAYER_PHOTO_FILES: Record<string, string> = {
  adam: "adam.jpg", alex: "alex.png", ben: "ben.png", evan: "evan.jpg",
  "g-danny": "g-danny.jpg", "g-ian": "g-ian.jpg", "g-lukas": "g-lukas.jpg",
  "g-michael-k": "g-michael-k.jpg", "g-michael-t": "g-michael-t.jpg",
  jason: "jason.jpg", kayla: "kayla.jpg", "logan-hoskins": "logan-hoskins.jpg",
  "logan-watson": "logan-watson.jpg", michael: "michael.png", phillip: "phillip.jpg",
  reilly: "reilly.jpg", ryder: "ryder.png", sean: "sean.jpg", viraj: "viraj.png",
  will: "will.png", zach: "zach.jpg",
}

export function playerPhotoUrl(id: string): string | null {
  const file = PLAYER_PHOTO_FILES[id]
  return file ? `${import.meta.env.BASE_URL}photos/${file}` : null
}
