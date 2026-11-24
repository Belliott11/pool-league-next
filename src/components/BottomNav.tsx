import { Download, ListChecks, Search, Trophy, User, Users } from "lucide-react"

const ITEMS = [
  { value: "games", label: "Games", Icon: ListChecks },
  { value: "leaderboard", label: "Leaderboard", short: "Leaders", Icon: Trophy },
  { value: "player", label: "Player", Icon: User },
  { value: "players", label: "Players", Icon: Users },
  { value: "export", label: "Export", Icon: Download },
]

// The tab bar on a phone: thumb-reach buttons pinned to the bottom edge, ending with Search (src/components/SiteSearch.tsx). On wider screens the
// tabs stay at the top and this is hidden. Its background carries on below the bottom edge (::after): iOS Safari opens a strip
// under a pinned bar while its own toolbar shrinks on scroll, and without this the page shows through that strip.
export function BottomNav({ tab, onChange, onSearch, editor = true }: { tab: string; onChange: (tab: string) => void; onSearch: () => void; editor?: boolean }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-48 after:bg-card sm:hidden"
    >
      <ul className={`mx-auto grid max-w-md ${editor ? "grid-cols-6" : "grid-cols-4"}`}>
        {ITEMS.filter((i) => editor || (i.value !== "export" && i.value !== "players")).map(({ value, label, short, Icon }: { value: string; label: string; short?: string; Icon: typeof Trophy }) => (
          <li key={value}>
            <button
              type="button"
              aria-current={tab === value ? "page" : undefined}
              onClick={() => onChange(value)}
              className={`flex w-full flex-col items-center gap-0.5 py-2 text-xs font-medium ${tab === value ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="size-5" aria-hidden />
              {/* Six buttons on a phone leave about 65px each, too narrow for "Leaderboard". */}
              <span className="max-w-full truncate px-0.5">{editor && short ? short : label}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={onSearch} className="flex w-full flex-col items-center gap-0.5 py-2 text-xs font-medium text-muted-foreground">
            <Search className="size-5" aria-hidden />
            Search
          </button>
        </li>
      </ul>
    </nav>
  )
}
