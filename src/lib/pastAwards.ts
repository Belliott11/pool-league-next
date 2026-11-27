import data from "@/data/poolean-seasons.json"

// The end-of-season awards the players voted on in Adam's Poolean app, for seasons before this site ran its own vote (awardVote.ts).
// Only the final point totals are kept (src/data/poolean-seasons.json): Poolean scored each ballot's top three 3, 2 and 1 and broke a
// points tie on first-place picks, then attendance. The ballots themselves stay private in Poolean. First and second team come from
// one combined vote: places 1 to 3 are the first team, 4 to 6 the second.

export interface PastAward {
  key: string
  label: string
  winners: string[]
  standings: { ids: string[]; points: number }[] // most first
  tieWon: boolean // the winner was level on points at the top, and Poolean's tiebreak decided it
}

export interface PastSeason {
  season: string // "Summer 2026"
  awards: PastAward[]
}

// Display order, and names that follow the site's wording.
const LABELS: [string, string][] = [
  ["mvp", "MVP"],
  ["best-player", "Best Player"],
  ["first-team", "First Team"],
  ["second-team", "Second Team"],
  ["dpoy", "Defensive Player"],
  ["clutch", "Clutch Player"],
  ["mip-season", "Most Improved (this season)"],
  ["mip-yoy", "Most Improved (year over year)"],
  ["teammate", "Best Teammate"],
  ["best-duo", "Best Duo"],
  ["worst-duo", "Rough-patch Duo"],
]

type Raw = { key: string; winners: string[]; votedStandings?: { slug: string; points: number }[] }

export function pastSeasonAwards(): PastSeason[] {
  const seasons = data.seasons as unknown as Record<string, { awards?: Raw[] }>
  return (data.list as string[])
    .map((year) => {
      const raw = seasons[year]?.awards ?? []
      const awards = LABELS.flatMap(([key, label]) => {
        const a = raw.find((r) => r.key === key)
        if (!a) return []
        const isWinner = (st: { ids: string[] }) => st.ids.every((id) => a.winners.includes(id))
        const standings = (a.votedStandings ?? []).map((s) => ({ ids: s.slug.split("|"), points: s.points })).sort((x, y) => y.points - x.points || Number(isWinner(y)) - Number(isWinner(x)))
        // The two teams share one standings list; each team shows its own slice of it.
        const shown = key === "first-team" ? standings.slice(0, 3) : key === "second-team" ? standings.slice(3, 6) : standings
        const top = standings[0]?.points ?? 0
        const tieWon = key !== "first-team" && key !== "second-team" && standings.filter((s) => s.points === top).length > 1
        return [{ key, label, winners: a.winners, standings: shown, tieWon }]
      })
      return awards.length ? { season: `Summer ${year}`, awards } : null
    })
    .filter((s): s is PastSeason => !!s)
    .reverse()
}
