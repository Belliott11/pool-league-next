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
      ["REB/Miss", "Rebounds per missed shot by either team in a player's games."],
      ["STL/Opp Play", "Steals per opponent play, counting the other team's shots and turnovers."],
      ["AST/Mate FG", "Assists per teammate made field goal."],
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
      ["Steady / Some data / Too early", "How much is behind a number: Steady is 100 or more shots or 15 or more games, Some data is 30 or more shots or 6 or more games. Fainter table rows have fewer than 3 games."],
      ["Win impact", "Points of win chance against an average player, with teammates and opponents held constant."],
      ["Holds up / Backwards / No sign of it", "Whether a rule from another sport is true in your games. No sign of it needs a real sample; with too few games it reads Too early."],
      ["Beat Rate", "How often a defender was the one beaten, out of the shots they were tagged on, split into transition (within 8 seconds of a turnover or steal) and half court. Breakdown shots is the same shots from the shooter's side, so it does not read as skill."],
      ["Got beat", "A contest tag: the tagged defender was beaten right before the shot and is out of the play. It counts the shot as wide open, and it measures a defensive breakdown more than the shooter's skill."],
      ["Likely", "The range the true rate probably sits in, given how few shots are behind it."],
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
