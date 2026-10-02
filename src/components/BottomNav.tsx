import { Download, ListChecks, Trophy, User, Users } from "lucide-react"

const ITEMS = [
  { value: "games", label: "Games", Icon: ListChecks },
  { value: "leaderboard", label: "Leaderboard", Icon: Trophy },
  { value: "player", label: "Player", Icon: User },
  { value: "players", label: "Players", Icon: Users },
  { value: "export", label: "Export", Icon: Download },
]

// The tab bar on a phone: five thumb-reach buttons pinned to the bottom edge. On wider screens the
// tabs stay at the top and this is hidden.
export function BottomNav({ tab, onChange }: { tab: string; onChange: (tab: string) => void }) {
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ value, label, Icon }) => (
          <li key={value}>
            <button
              type="button"
              aria-current={tab === value ? "page" : undefined}
              onClick={() => onChange(value)}
              className={`flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${tab === value ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
