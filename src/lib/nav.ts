// Where the person is in the app, kept in the address bar so the browser's Back button moves between screens
// instead of leaving the site. The tabs and the screens inside them (a game, its stat entry, a night recap, a live
// game) each get their own history entry.
export interface View {
  tab: string
  sub: string // "" for the tab itself, or "game:ID", "stat:ID", "recap:DATE", "live"
  player: string | null
}

export const DEFAULT_VIEW: View = { tab: "games", sub: "", player: null }
const TABS = ["games", "leaderboard", "player", "players", "export"]

export const sameView = (a: View, b: View) => a.tab === b.tab && a.sub === b.sub && a.player === b.player

export function viewToHash(v: View): string {
  const enc = encodeURIComponent
  if (v.tab === "games") {
    if (!v.sub) return "#/games"
    const [kind, ...rest] = v.sub.split(":")
    return `#/games/${kind}${rest.length ? "/" + enc(rest.join(":")) : ""}`
  }
  if (v.tab === "player") return v.player ? `#/player/${enc(v.player)}` : "#/player"
  return `#/${v.tab}`
}

// Reads the address bar, including the links the classic site wrote (#game=ID and #player=ID).
export function hashToView(hash: string): View | null {
  const dec = (s: string) => {
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  }
  let m = hash.match(/^#game=(.+)$/)
  if (m) return { tab: "games", sub: `game:${dec(m[1])}`, player: null }
  m = hash.match(/^#player=(.+)$/)
  if (m) return { tab: "player", sub: "", player: dec(m[1]) }
  if (!hash.startsWith("#/")) return null
  const parts = hash.slice(2).split("/")
  const tab = parts[0]
  if (!TABS.includes(tab)) return null
  if (tab === "games") {
    const kind = parts[1]
    if (!kind) return { tab, sub: "", player: null }
    const arg = parts.slice(2).join("/")
    return { tab, sub: arg ? `${kind}:${dec(arg)}` : kind, player: null }
  }
  if (tab === "player") return { tab, sub: "", player: parts.length > 1 ? dec(parts.slice(1).join("/")) : null }
  return { tab, sub: "", player: null }
}
