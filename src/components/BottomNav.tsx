import { Download, ListChecks, Search, Trophy, User, Users } from "lucide-react"

const ITEMS = [
  { value: "games", label: "Games", Icon: ListChecks },
  { value: "leaderboard", label: "Stats", short: "Stats", Icon: Trophy },
  { value: "player", label: "Player", Icon: User },
  { value: "players", label: "Players", Icon: Users },
  { value: "export", label: "Export", Icon: Download },
]

// The tab bar on a phone: thumb-reach buttons pinned to the bottom edge, ending with Search (src/components/SiteSearch.tsx). On wider screens the
// tabs stay at the top and this is hidden. It reaches the screen's bottom edge only because the page uses the whole screen
// (viewport-fit=cover in index.html); without that, iOS stops it above the home indicator and the page shows through below it. Its
// background also carries on past the edge (::after), for the bounce at the end of a scroll.
// The Player tab reads "You" once the visitor has said who they are, since it then opens on them.
export function BottomNav({ tab, onChange, onSearch, editor = true, you = false }: { tab: string; onChange: (tab: string) => void; onSearch: () => void; editor?: boolean; you?: boolean }) {
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
              {/* Six buttons on a phone leave about 65px each, too narrow for long labels. */}
              <span className="max-w-full truncate px-0.5">{value === "player" && you ? "You" : editor && short ? short : label}</span>
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
