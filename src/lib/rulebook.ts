import book from "@/data/rulebook.json"
import type { Game } from "@/lib/types"

// Poolean's rulebook over time (src/data/rulebook.json, kept by scripts/rulebook.mjs from poolean.net). Every game is matched to the
// version in force on its date, so stats can be split by rules and a change can be judged before and after.

export interface RuleSection {
  n: number
  title: string
  lines: string[]
  subs: { title: string; lines: string[] }[]
}
export interface RuleVersion {
  from: string | null // first day it applies; null for the version in force before any change was tracked
  hash: string
  sections: RuleSection[]
}

// What a change is about, from the section it touched. Only scoring, possession and boundaries change the math the models rest on
// (what a basket is worth, who gets the ball, where a miss goes); defense covers contact, rough play and fouls.
export type ChangeKind = "scoring" | "possession" | "boundaries" | "defense" | "other"
export const KIND_LABEL: Record<ChangeKind, string> = { scoring: "Scoring", possession: "Possession", boundaries: "Out of bounds", defense: "Defense and contact", other: "Other" }
export const MATH_KINDS: ChangeKind[] = ["scoring", "possession", "boundaries"]

export function kindOf(title: string): ChangeKind {
  const t = title.toLowerCase()
  if (/scor|point|three/.test(t)) return "scoring"
  if (/possess/.test(t)) return "possession"
  if (/bound/.test(t)) return "boundaries"
  if (/contact|rough|foul|penalt|defen|goaltend|hug/.test(t)) return "defense"
  return "other"
}

let versions: RuleVersion[] = (book as { versions: RuleVersion[] }).versions
// Tests swap in their own history.
export function setRulebook(v: RuleVersion[]) {
  versions = v
}
export const rulebook = () => versions
export const currentRules = () => versions.at(-1) ?? null

// The version in force on a date (YYYY-MM-DD).
export function rulesOn(date: string | undefined): RuleVersion | null {
  let found: RuleVersion | null = null
  for (const v of versions) if (v.from === null || (date ?? "") >= v.from) found = v
  return found ?? versions[0] ?? null
}
export const rulesOf = (g: Game) => rulesOn(g.date)

// Every line of a version, keyed by where it sits ("Contact / Off-ball contact"), for comparing two versions.
function linesOf(v: RuleVersion): Map<string, { section: string; kind: ChangeKind; lines: Set<string> }> {
  const out = new Map<string, { section: string; kind: ChangeKind; lines: Set<string> }>()
  for (const s of v.sections) {
    out.set(s.title, { section: s.title, kind: kindOf(s.title), lines: new Set(s.lines) })
    for (const sub of s.subs) out.set(`${s.title} / ${sub.title}`, { section: `${s.title}: ${sub.title}`, kind: kindOf(`${s.title} ${sub.title}`), lines: new Set(sub.lines) })
  }
  return out
}

export interface RuleDiff {
  section: string
  kind: ChangeKind
  added: string[]
  removed: string[]
}

// What changed from one version to the next, line by line.
export function diffRules(before: RuleVersion, after: RuleVersion): RuleDiff[] {
  const a = linesOf(before)
  const b = linesOf(after)
  const out: RuleDiff[] = []
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(key)
    const y = b.get(key)
    const added = [...(y?.lines ?? [])].filter((l) => !x?.lines.has(l))
    const removed = [...(x?.lines ?? [])].filter((l) => !y?.lines.has(l))
    if (added.length || removed.length) out.push({ section: (y ?? x)!.section, kind: (y ?? x)!.kind, added, removed })
  }
  return out
}

export interface RuleChange {
  version: RuleVersion
  previous: RuleVersion
  diffs: RuleDiff[]
  kinds: ChangeKind[]
}

export function ruleChanges(): RuleChange[] {
  return versions.slice(1).map((v, i) => {
    const diffs = diffRules(versions[i], v)
    return { version: v, previous: versions[i], diffs, kinds: [...new Set(diffs.map((d) => d.kind))] }
  })
}

// The games played under the same math rules (scoring, possession, out of bounds) as `date`, for the league rates the models rest on.
// Changes to contact or anything else leave the math alone, so those games still count together. While the newest math rules have
// fewer than `min` games, every game is used, so a new rule leans on the old rates until it has enough of its own.
export function sameMathRules(gs: Game[], date: string | undefined, min = 8): Game[] {
  const key = (d: string | undefined) => {
    let k = 0
    ruleChanges().forEach((c, i) => {
      if (c.kinds.some((x) => MATH_KINDS.includes(x)) && (d ?? "") >= (c.version.from ?? "")) k = i + 1
    })
    return k
  }
  const mine = key(date)
  const same = gs.filter((g) => key(g.date) === mine)
  return same.length >= min ? same : gs
}

// The games played under the current rulebook, for the "Only games under the current rules" filter. Every game while the rules have
// never changed.
export function underCurrentRules<T extends { games: Game[] }>(state: T): T {
  const from = currentRules()?.from
  if (!from) return state
  return { ...state, games: state.games.filter((g) => (g.date || "") >= from) }
}
