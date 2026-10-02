import {
  Activity,
  ChartColumn,
  ChartNoAxesCombined,
  Brain,
  Crown,
  Database,
  Download,
  Film,
  Flame,
  Gauge,
  Handshake,
  LayoutList,
  ListOrdered,
  Shield,
  ShieldCheck,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react"

// One icon for every group and panel header, all from the same Lucide set. Panels are matched by what
// their title is about; a group falls back to its own icon.
const BY_TITLE: [RegExp, LucideIcon][] = [
  [/rank|power|standing|league rank/i, ListOrdered],
  [/trophy|award|champion/i, Trophy],
  [/crown|recap|season timeline/i, Crown],
  [/streak|milestone|iron man|attendance/i, Flame],
  [/heat|shot chart|shot distance|shot arc|zone|direction|shot type|deep shot|move/i, Target],
  [/trend|over time|over the season|cumulative|history|seasons/i, TrendingUp],
  [/compar|versus|vs\.|head to head|head-to-head|rivalr|matchup/i, Swords],
  [/pass|assist|chemistry|synergy|teammate|partner/i, Handshake],
  [/turnover|tov/i, Activity],
  [/defens|rebound|resistance|contest/i, Shield],
  [/efficien|ts%|rates|rating|quadrant|creation|volume/i, Gauge],
  [/style|cluster|model|win shares|calibrat/i, Brain],
  [/video|clip|highlight|film|media/i, Film],
  [/game log|games|game-winning|comeback|upset|party/i, LayoutList],
  [/player|roster|tips|areas/i, User],
  [/export|backup|download|data/i, Download],
]

const BY_SECTION: Record<string, LucideIcon> = {
  // Leaderboard
  comparison: ChartNoAxesCombined,
  shooting: Target,
  matchups: Swords,
  situational: Flame,
  style: Brain,
  media: Film,
  // Player
  passing: Handshake,
  defense: Shield,
  team: Users,
  trends: TrendingUp,
  // Export
  exportData: Download,
  review: ShieldCheck,
  dataManagement: Database,
}

export function sectionIcon(key: string): LucideIcon {
  return BY_SECTION[key] ?? ChartColumn
}

export function panelIcon(title: string, section?: string): LucideIcon {
  for (const [re, icon] of BY_TITLE) if (re.test(title)) return icon
  return section ? sectionIcon(section) : ChartColumn
}
