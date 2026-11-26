import { SEASON_TEAMS_PUBLIC } from "@/lib/visibility"
import { CalendarDays, FileText, Search, Swords, User } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { formatDateLong } from "@/lib/format"
import type { View } from "@/lib/nav"
import { playerName } from "@/lib/players"
import { pairRecord } from "@/lib/headToHead"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

type Hit = { key: string; kind: "page" | "player" | "game" | "pair"; label: string; detail: string; words: string; go: () => void }

const ICON = { page: FileText, player: User, game: CalendarDays, pair: Swords }

// "ben vs zach", "ben v zach": two names to compare. Each must match one player, by the start of their name or their id.
const VS = /\s+(?:vs\.?|v\.?|versus)\s+/i
function findPlayer(state: PooleanState, q: string): string | null {
  const n = q.trim().toLowerCase()
  if (!n) return null
  const hits = state.players.filter((p) => p.name.toLowerCase().startsWith(n) || p.id.toLowerCase() === n || p.id.toLowerCase().endsWith(`-${n}`))
  const exact = hits.find((p) => p.name.toLowerCase() === n)
  return exact?.id ?? (hits.length === 1 ? hits[0].id : null)
}



// Search the whole site: players, games and pages. Opened from the bottom bar on a phone, the tab row on a wider screen, or Ctrl/Cmd+K
// anywhere. Arrow keys move through the results and Enter opens one.
export function SiteSearch({ state, open, onOpenChange, go, openPlayer, readOnly }: { state: PooleanState; open: boolean; onOpenChange: (open: boolean) => void; go: (v: Partial<View>) => void; openPlayer: (id: string) => void; readOnly: boolean }) {
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onOpenChange])
  useEffect(() => {
    if (open) {
      setQ("")
      setActive(0)
    }
  }, [open])

  const all = useMemo<Hit[]>(() => {
    const page = (key: string, label: string, detail: string, words: string, v: Partial<View>): Hit => ({ key: `page:${key}`, kind: "page", label, detail, words, go: () => go(v) })
    const pages: Hit[] = [
      page("games", "Games", "Every game, newest first", "home results schedule", { tab: "games", sub: "", player: null }),
      page("leaderboard", "Leaderboard", "Rankings and every stat table", "standings stats ranking two-way", { tab: "leaderboard", sub: "", player: null }),
      page("hall", "Hall of fame", "Records and awards", "records awards best ever", { tab: "games", sub: "hall", player: null }),
      page("wrapped", "Season Wrapped", "Each player's season in review", "recap review summary", { tab: "games", sub: "wrapped", player: null }),
      page("poty", "Play of the Year", "Vote on the season's best plays, a bracket at a time", "play of the year bracket vote best plays clips poty", { tab: "games", sub: "poty", player: null }),
      ...(readOnly && !SEASON_TEAMS_PUBLIC ? [] : [page("teams", "Season teams", "Standings, the draft and rivalry games", "season teams standings draft captains rivalry club", { tab: "games", sub: "teams", player: null })]),
      page("h2h", "Settle it", "Any two players side by side", "debate versus vs compare head to head who is better argument", { tab: "games", sub: "h2h", player: null }),
      page("how", "How the numbers work", "Live odds, runs and Two-Way, on real games", "method explain odds win probability momentum streak run outlier formula", { tab: "games", sub: "how", player: null }),
      page("live", "Live game", "Watch or keep score", "score live now stream", { tab: "games", sub: "live", player: null }),
      ...(readOnly ? [] : [page("players", "Players", "Add and edit players", "roster edit", { tab: "players", sub: "", player: null })]),
    ]
    const players: Hit[] = [...state.players]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ key: `player:${p.id}`, kind: "player", label: p.name, detail: "Player", words: p.id, go: () => openPlayer(p.id) }))
    const side = (ids: string[]) => ids.map((id) => playerName(state, id)).join(", ")
    const games: Hit[] = [...state.games]
      .filter((g) => !g.liveInProgress)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map((g) => ({ key: `game:${g.id}`, kind: "game", label: formatDateLong(g.date), detail: `${side(g.teamA)} vs ${side(g.teamB)}`, words: g.date ?? "", go: () => go({ tab: "games", sub: `game:${g.id}`, player: null }) }))
    return [...pages, ...players, ...games]
  }, [state, go, openPlayer, readOnly])

  const needle = q.trim().toLowerCase()
  const pair = useMemo<Hit | null>(() => {
    const parts = q.split(VS)
    if (parts.length !== 2) return null
    const [x, y] = parts.map((s) => findPlayer(state, s))
    if (!x || !y || x === y) return null
    const r = pairRecord(x, y)
    const nx = playerName(state, x), ny = playerName(state, y)
    const vs = r.vs[0] + r.vs[1] > 0 ? `${nx} ${r.vs[0]}-${r.vs[1]} against ${ny}` : "Never on opposite teams"
    const mates = r.together[0] + r.together[1] > 0 ? `${r.together[0]}-${r.together[1]} as teammates` : "never teammates"
    return {
      key: `pair:${x}|${y}`,
      kind: "pair",
      label: `${nx} vs ${ny}`,
      detail: `${vs}, ${mates}. Every result.`,
      words: "",
      go: () => go({ tab: "games", sub: `h2h:${x},${y}`, player: null }),
    }
  }, [q, state, go])
  const hits = pair
    ? [pair]
    : needle
    ? all
        .filter((h) => needle.split(/\s+/).every((w) => `${h.label} ${h.detail} ${h.words}`.toLowerCase().includes(w)))
        .sort((a, b) => Number(b.label.toLowerCase().startsWith(needle)) - Number(a.label.toLowerCase().startsWith(needle)))
        .slice(0, 12)
    : all.filter((h) => h.kind !== "game")
  const pick = (h: Hit) => {
    onOpenChange(false)
    h.go()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] translate-y-0 gap-3 p-3 sm:max-w-lg" initialFocus={input}>
        <DialogTitle className="sr-only">Search the site</DialogTitle>
        <div className="flex items-center gap-2 pr-8">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, hits.length - 1))
              else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0))
              else if (e.key === "Enter" && hits[active]) pick(hits[active])
              else return
              e.preventDefault()
            }}
            placeholder="A player, a date, or Ben vs Zach"
            aria-label="Search the site"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="flex max-h-[60vh] flex-col overflow-y-auto">
          {hits.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nothing matches "{q.trim()}".</li>}
          {hits.map((h, i) => {
            const Icon = ICON[h.kind]
            return (
              <li
                key={h.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2", i === active && "bg-muted")}
              >
                <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{h.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{h.detail}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
