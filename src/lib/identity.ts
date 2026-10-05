import { useEffect, useState } from "react"

// "Who are you?": a choice kept on this device only, with no password and no account. It just makes the
// app open on you (the Player tab, a "you" mark on the leaderboard). null means not chosen yet.
const KEY = "pooleanIntelWho"
export const GUEST = "guest"

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setWho(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* private mode: it just will not be remembered */
  }
  window.dispatchEvent(new Event("poolean-who"))
}

export function useWho(): string | null {
  const [who, setLocal] = useState<string | null>(read)
  useEffect(() => {
    const on = () => setLocal(read())
    window.addEventListener("poolean-who", on)
    window.addEventListener("storage", on)
    return () => {
      window.removeEventListener("poolean-who", on)
      window.removeEventListener("storage", on)
    }
  }, [])
  return who
}

// The chosen player's id when it is still a real player, otherwise null (guest, unchosen, or removed).
export function myPlayerId(who: string | null, players: { id: string }[]): string | null {
  return who && who !== GUEST && players.some((p) => p.id === who) ? who : null
}
