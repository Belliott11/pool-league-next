// Panels that show the same kind of thing are combined into one panel with a tab for each, so the Leaderboard and Player
// pages are shorter and nothing repeats. Groups are config only: every member keeps its own maths and markup.
export interface GroupDef {
  id: string
  title: string
  home: string // the section the group sits in
  members: [title: string, label: string][]
  editorOnly?: boolean // tuning views that visitors do not need
}

// A panel that repeats another is dropped. The self-inflicted bars say what Turnover Type Breakdown says in a table, and
// Season Timeline retells Season Recap and Upset Tracker in order.
export const LEADERBOARD_DROP = new Set(["Season Timeline", "Self-Inflicted vs. Forced Turnover Rate"])

export const LEADERBOARD_GROUPS: GroupDef[] = [
  { id: "recaps", title: "Recaps", home: "media", members: [["Season Recap", "Season"], ["Party Recap", "Party night"], ["Upset Tracker", "Upsets"]] },
  { id: "awards", title: "Awards", home: "media", members: [["Award Race", "Race"], ["Trophy Case", "Trophies"], ["Awards vs. Stats", "Votes and stats"]] },
  { id: "games-clips", title: "Games and clips", home: "media", members: [["Best & Worst Individual Games", "Best games"], ["Highlights & Lowlights (League)", "Clips"], ["Play Search", "Search plays"]] },
  { id: "rivalries", title: "Rivalries", home: "matchups", members: [["Rivalries", "Superlatives"], ["Real Rivalry Matrix", "Matrix"], ["Head to Head", "Pick two"]] },
  { id: "passing", title: "Passing", home: "matchups", members: [["Assist Connections", "Assists"], ["Passing Chemistry: Pair Detail", "Pair detail"], ["League Passing Chemistry Grid", "Grid"]] },
  { id: "rebounding", title: "Rebounding", home: "matchups", members: [["Rebound Battle Record", "Record"], ["Rebound Battle Head-to-Head", "Head to head"], ["Opportunity-Adjusted Rebounding", "Per chance"]] },
  { id: "grids", title: "Matchups and teammates", home: "matchups", members: [["Head-to-Head Matchup Grid", "Scorer vs defender"], ["Teammate Lift Matrix", "Teammate lift"], ["Teammate Context", "Context"]] },
  { id: "shot-mix", title: "Shot mix", home: "shooting", members: [["Shot Distance", "Distance"], ["Defensive Shot Distance", "Defended"], ["Shot Type Efficiency", "Shot types"], ["Shot Types: Open vs. Contested", "Open or guarded"], ["Deep Shot Check", "Deep shots"], ["Is the Move Working?", "The move"], ["Wide-Open Shooting", "Wide open"]] },
  { id: "shooting-trends", title: "Shooting trends", home: "shooting", members: [["TS% by Shot Distance", "TS by distance"], ["League TS% Over Time", "TS over time"], ["Shot-Making Added (xPTS)", "Shot-making"], ["Shot-Making Added, Cumulative Over the Season", "Shot-making over time"], ["Shooting & Wins by Direction", "By direction"], ["League Shot Heatmap", "Heatmap"]] },
  { id: "shape", title: "Player shape", home: "comparison", members: [["Two-Way Quadrant", "Offense vs defense"], ["Volume vs. Efficiency", "Volume vs efficiency"], ["Stat Strengths", "Strengths"], ["Consistency", "Consistency"]] },
  { id: "season", title: "Over the season", home: "comparison", members: [["Two-Way/20 Rank Over the Season", "Rank"], ["Power Ranking vs. Performance", "Power vs play"], ["Closed Seasons in This App (League)", "Closed seasons"]] },
  { id: "turnovers", title: "Turnovers", home: "situational", members: [["TOV Recomputed", "TOV%"], ["Turnover Type Breakdown", "Types"], ["Turnover Type Mix", "Mix"], ["Forced Turnover Credit", "Forced credit"], ["Turnover Type vs. Shot Type", "Vs shot type"], ["Self-Creation Full Accounting", "Self-creation"], ["Turnover Type Over Time", "Over time"], ["Out-of-Bounds Misses", "Out of bounds"]] },
  { id: "close", title: "Close games", home: "situational", members: [["Close-Game Shooting", "Shooting"], ["Comeback Tracker", "Comebacks"], ["Game-Winning Buckets", "Game winners"]] },
  { id: "second", title: "Second chances", home: "situational", members: [["Second-Chance Conversion", "Conversion"], ["Second-Chance Points Allowed", "Allowed"], ["Points off Takeaways", "Takeaways"]] },
  { id: "defense", title: "Defense", home: "style", members: [["Defensive Load", "Load"], ["Contest Level & Defensive Engagement", "Contests"], ["Shooter-Quality-Adjusted Defense", "Adjusted defense"], ["Defender-Quality-Adjusted Offense", "Adjusted offense"], ["Close-Game Defense", "Close games"]] },
  { id: "dev", title: "Developer views", home: "style", editorOnly: true, members: [["Calibrated Thresholds", "Thresholds"], ["Win Shares Model (beta)", "Win shares model"]] },
]

export const PLAYER_GROUPS: GroupDef[] = [
  { id: "old-site", title: "Old site history", home: "overview", members: [["Old Site Awards", "Awards"], ["Power Rankings", "Power ranking"], ["Old Site Seasons", "Seasons"], ["Milestones", "Milestones"], ["Real Game Record", "Record"], ["Real Partners & Matchups", "Partners"], ["Streaks", "Streaks"], ["Attendance Streak", "Attendance"]] },
  { id: "tips", title: "Tips", home: "overview", members: [["Personalized Tips", "Tips"], ["Areas to Work On", "Room to grow"]] },
  { id: "shot-maps", title: "Shot maps", home: "shooting", members: [["Shot Chart", "Chart"], ["Shot Heatmap", "Heatmap"], ["Shot Arc", "Arc"]] },
  { id: "shot-creation", title: "Shot creation", home: "shooting", members: [["Shot Types", "Shot types"], ["Self-Creation", "Self-creation"], ["Resistance Faced & Shot-Making Added", "Resistance"], ["Shooting by Direction", "Direction"]] },
  { id: "defense", title: "Defense", home: "defense", members: [["Contest Quality & Engagement", "Contests"], ["Defensive Heatmap", "Heatmap"], ["Defensive Load", "Load"]] },
  { id: "passing", title: "Passing and turnovers", home: "passing", members: [["Assisted By", "Assisted by"], ["Passing Quality & Volume", "Passing"], ["Turnover Mix", "Turnovers"]] },
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
