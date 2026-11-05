import { BookOpen } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PER } from "@/lib/per"

// A key to the abbreviations used in column headers and panels, one tap away on any screen. Plain definitions only; each
// panel's own hint has the detail.
const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: "Rates",
    rows: [
      [`/${PER}`, `Per ${PER} combined points scored by both teams in a player's games, about one game. It evens out short and long games.`],
      [`Two-Way/${PER}`, `Offense plus defense in one number, per ${PER}.`],
      [`Off Rating/${PER}`, "The offense half: scoring, shooting, passing and ball security."],
      [`Def Rating/${PER}`, "The defense half: stops, steals and blocks against points allowed and times beaten."],
      ["GP", "Games played."],
      ["W-L", "Wins and losses."],
    ],
  },
  {
    title: "Box score",
    rows: [
      ["PTS", "Points."],
      ["AST", "Assists."],
      ["OREB / DREB / REB", "Offensive, defensive and total rebounds."],
      ["STL", "Steals."],
      ["BLK", "Blocks."],
      ["Stocks", "Steals plus blocks."],
      ["TOV", "Turnovers."],
      ["PF", "Personal fouls."],
    ],
  },
  {
    title: "Shooting",
    rows: [
      ["FG / FGA", "Field goals made and attempted."],
      ["3PT", "Threes made and attempted."],
      ["FT", "Free throws made and attempted."],
      ["TS%", "True shooting: points per shot, counting threes and free throws."],
      ["eFG%", "Field goal percentage with threes counted extra."],
      ["Mix", "How a player's shots split across zones or types."],
      ["xPTS", "Expected points on a shot, from how hard that kind of shot is for the league."],
      ["Shot-Making Added", "Points scored above what the shots were worth."],
    ],
  },
  {
    title: "Shares and defense",
    rows: [
      ["Shot%", "Share of a team's shots a player takes."],
      ["AST%", "Share of a team's assists a player gets."],
      ["OREB% / DREB% / TRB%", "Share of the rebounds a player grabs."],
      ["TOV%", "Turnovers as a share of a player's plays."],
      ["A/TO", "Assists for each turnover."],
      ["Opp FG%", "How well opponents shoot on shots a player defended."],
      ["Beaten", "Times scored on while defending."],
      ["Stops", "Times defending a missed shot."],
      ["Pts Allowed", "Points scored on a player's defended shots."],
    ],
  },
  {
    title: "Colors and labels",
    rows: [
      ["Clear / Hint / Too early", "How sure a pattern is: clear difference, a hint, or too little data to say."],
      ["Roughest", "The lowest value in a list. Someone always is, and it is usually close."],
    ],
  },
]

export function StatLegend() {
  return (
    <Dialog>
      <DialogTrigger className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium" aria-label="Open the key to stat abbreviations">
        <BookOpen aria-hidden className="size-4" /> Key
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stat key</DialogTitle>
          <DialogDescription>What the short names in the tables mean.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {GROUPS.map((g) => (
            <section key={g.title} className="flex flex-col gap-2">
              <h3 className="font-display text-sm font-bold">{g.title}</h3>
              <dl className="flex flex-col gap-2">
                {g.rows.map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5">
                    <dt className="font-semibold tabular-nums">{k}</dt>
                    <dd className="text-muted-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
