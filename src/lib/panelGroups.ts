// Panels that show the same kind of thing are combined into one panel with a tab for each, so the Leaderboard and Player
// pages are shorter and nothing repeats. Groups are config only: every member keeps its own maths and markup.
export interface GroupDef {
  id: string
  title: string
  home: string // the section the group sits in
  members: [title: string, label: string][]
  editorOnly?: boolean // tuning views that visitors do not need
}

// Tabs in each group run most to least important, so the first one is the one worth opening.
// A panel belongs with the side of the ball it measures: offense next to offense, defense in Defense.
// A panel that repeats another is dropped. The self-inflicted bars say what Turnover Type Breakdown says in a table, and
// Season Timeline retells Season Recap and Upset Tracker in order.
export const LEADERBOARD_DROP = new Set(["Season Timeline", "Self-Inflicted vs. Forced Turnover Rate"])

export const LEADERBOARD_GROUPS: GroupDef[] = [
  { id: "recaps", title: "Recaps", home: "media", members: [["Season Recap", "Season"], ["Party Recap", "Party night"], ["Upset Tracker", "Upsets"]] },
  { id: "awards", title: "Awards", home: "media", members: [["Award Race", "Race"], ["Trophy Case", "Trophies"], ["Awards vs. Stats", "Votes and stats"]] },
  { id: "games-clips", title: "Games and clips", home: "media", members: [["Best & Worst Individual Games", "Best games"], ["Highlights & Lowlights (League)", "Clips"], ["Play Search", "Search plays"]] },
  { id: "rivalries", title: "Rivalries", home: "matchups", members: [["Rivalries", "Superlatives"], ["Head to Head", "Pick two"], ["Real Rivalry Matrix", "Matrix"]] },
  { id: "passing", title: "Passing", home: "matchups", members: [["Assist Connections", "Assists"], ["League Passing Chemistry Grid", "Grid"], ["Passing Chemistry: Pair Detail", "Pair detail"]] },
  { id: "rebounding", title: "Rebounding", home: "matchups", members: [["Opportunity-Adjusted Rebounding", "Per chance"], ["Rebound Battle Record", "Record"], ["Rebound Battle Head-to-Head", "Head to head"]] },
  { id: "grids", title: "Matchups and teammates", home: "matchups", members: [["Teammate Lift Matrix", "Teammate lift"], ["Teammate Context", "Context"], ["Head-to-Head Matchup Grid", "Scorer vs defender"]] },
  { id: "shot-mix", title: "Shot mix", home: "shooting", members: [["Shot Distance", "Distance"], ["Shot Type Efficiency", "Shot types"], ["Shot Types: Open vs. Contested", "Open or guarded"], ["Wide-Open Shooting", "Wide open"], ["Deep Shot Check", "Deep shots"], ["Is the Move Working?", "The move"]] },
  { id: "shooting-trends", title: "Shooting trends", home: "shooting", members: [["Shot-Making Added (xPTS)", "Shot-making"], ["TS% by Shot Distance", "TS by distance"], ["League Shot Heatmap", "Heatmap"], ["Defender-Quality-Adjusted Offense", "Vs defender quality"], ["League TS% Over Time", "TS over time"], ["Shot-Making Added, Cumulative Over the Season", "Shot-making over time"], ["Shooting & Wins by Direction", "By direction"]] },
  { id: "shape", title: "Player shape", home: "comparison", members: [["Two-Way Quadrant", "Offense vs defense"], ["Stat Strengths", "Strengths"], ["Volume vs. Efficiency", "Volume vs efficiency"], ["Consistency", "Consistency"]] },
  { id: "season", title: "Over the season", home: "comparison", members: [["Two-Way/25 Rank Over the Season", "Rank"], ["Power Ranking vs. Performance", "Power vs play"], ["Closed Seasons in This App (League)", "Closed seasons"]] },
  { id: "turnovers", title: "Turnovers", home: "situational", members: [["TOV Recomputed", "TOV%"], ["Turnover Type Breakdown", "Types"], ["Forced Turnover Credit", "Forced credit"], ["Self-Creation Full Accounting", "Self-creation"], ["Turnover Type Mix", "Mix"], ["Turnover Type vs. Shot Type", "Vs shot type"], ["Turnover Type Over Time", "Over time"], ["Out-of-Bounds Misses", "Out of bounds"]] },
  { id: "close", title: "Close games", home: "situational", members: [["Close-Game Shooting", "Shooting"], ["Game-Winning Buckets", "Game winners"], ["Comeback Tracker", "Comebacks"]] },
  { id: "second", title: "Second chances", home: "situational", members: [["Second-Chance Conversion", "Conversion"], ["Points off Takeaways", "Takeaways"]] },
  { id: "defense", title: "Defense", home: "defense", members: [["Defensive Load", "Load"], ["Shooter-Quality-Adjusted Defense", "Adjusted defense"], ["Contest Level & Defensive Engagement", "Contests"], ["Defensive Shot Distance", "Shots faced"], ["Close-Game Defense", "Close games"], ["Second-Chance Points Allowed", "Second chances allowed"]] },
  { id: "dev", title: "Developer views", home: "style", editorOnly: true, members: [["Calibrated Thresholds", "Thresholds"], ["Win Shares Model (beta)", "Win shares model"]] },
]

export const PLAYER_GROUPS: GroupDef[] = [
  { id: "old-site", title: "Old site history", home: "overview", members: [["Old Site Awards", "Awards"], ["Power Rankings", "Power ranking"], ["Old Site Seasons", "Seasons"], ["Milestones", "Milestones"], ["Real Game Record", "Record"], ["Real Partners & Matchups", "Partners"], ["Streaks", "Streaks"], ["Attendance Streak", "Attendance"]] },
  { id: "tips", title: "Tips", home: "overview", members: [["Personalized Tips", "Tips"], ["Areas to Work On", "Room to grow"]] },
  { id: "shot-maps", title: "Shot maps", home: "shooting", members: [["Shot Chart", "Chart"], ["Shot Heatmap", "Heatmap"], ["Shot Arc", "Arc"]] },
  { id: "shot-creation", title: "Shot creation", home: "shooting", members: [["Shot Types", "Shot types"], ["Self-Creation", "Self-creation"], ["Resistance Faced & Shot-Making Added", "Resistance"], ["Shooting by Direction", "Direction"]] },
  { id: "defense", title: "Defense", home: "defense", members: [["Defensive Load", "Load"], ["Contest Quality & Engagement", "Contests"], ["Defensive Heatmap", "Heatmap"]] },
  { id: "passing", title: "Passing and turnovers", home: "passing", members: [["Passing Quality & Volume", "Passing"], ["Turnover Mix", "Turnovers"], ["Assisted By", "Assisted by"]] },
  { id: "head-to-head", title: "Head to head", home: "matchups", members: [["Notable Matchups", "Notable"], ["Head-to-Head: As Scorer", "As scorer"], ["Head-to-Head: As Defender", "As defender"], ["Offensive Matchup Difficulty", "Offense difficulty"], ["Defensive Matchup Difficulty", "Defense difficulty"]] },
  { id: "teammates", title: "Teammates", home: "team", members: [["Teammate Synergy (With/Without)", "With and without"], ["Teammate Quality", "Quality"]] },
  { id: "trends", title: "Trends", home: "trends", members: [["Two-Way Trend", "Two-way"], ["Stat Trend", "Stats"], ["Closed Seasons in This App", "Closed seasons"]] },
  { id: "videos", title: "Session videos", home: "media", members: [["Session Videos", "Videos"], ["Broken Session Video Links", "Broken links"]] },
]

export interface Placed<T> {
  order: number
  item?: T // a panel left on its own
  group?: GroupDef
  members?: { title: string; label: string; item: T }[]
}

// Lays the panels out by section: grouped ones become one entry at the group's home section and the earliest member's
// position, the rest keep their own section and order. A group with one panel present is not a group.
export function arrange<T extends { title: string; section: string; order: number }>(specs: T[], groups: GroupDef[], opts: { drop?: Set<string>; editor?: boolean } = {}): Map<string, Placed<T>[]> {
  const live = specs.filter((s) => !opts.drop?.has(s.title))
  const byTitle = new Map(live.map((s) => [s.title, s]))
  const used = new Set<string>()
  const out = new Map<string, Placed<T>[]>()
  const put = (section: string, p: Placed<T>) => out.set(section, [...(out.get(section) ?? []), p])
  for (const g of groups) {
    if (g.editorOnly && !opts.editor) {
      for (const [t] of g.members) used.add(t) // hidden from visitors
      continue
    }
    const members = g.members.filter(([t]) => byTitle.has(t) && !used.has(t)).map(([title, label]) => ({ title, label, item: byTitle.get(title)! }))
    if (members.length < 2) continue
    members.forEach((m) => used.add(m.title))
    put(g.home, { order: Math.min(...members.map((m) => m.item.order)), group: g, members })
  }
  for (const s of live) if (!used.has(s.title)) put(s.section, { order: s.order, item: s })
  for (const list of out.values()) list.sort((a, b) => a.order - b.order)
  return out
}

// Where a panel now lives, for search and jump: its group when it has one.
export function placeOf(title: string, groups: GroupDef[]): GroupDef | undefined {
  return groups.find((g) => g.members.some(([t]) => t === title))
}
