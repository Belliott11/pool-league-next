import { currentRules } from "@/lib/rulebook"
import type { RuleNote } from "@/lib/types"

// Looking up Poolean's rules (the current version in src/data/rulebook.json) during an argument: every line of the rulebook and every
// clarification the league has added (state.ruleNotes), found by plain word matching with the words people actually say ("oob", "hug",
// "and one"). Shown on the Rules page and, compact, on both live screens.

export interface RuleLine {
  section: string // section title
  sub: string | null // sub-heading, when the line sits under one
  n: number // section number
  text: string
  note?: boolean // a clarification rather than the rulebook's own words
}

// What people say, and the rulebook words it should find.
const SAY: [RegExp, string][] = [
  [/\b(oob|out|sideline|deck|concrete|edge|wall)\b/, "out of bounds boundaries concrete coping"],
  [/\b(hug|hugs|hugging|bear|holding|hold|grab|grabbing)\b/, "hug hugs cuddle grabbing holding"],
  [/\b(dunk|dunked|dunking|underwater|drown)\b/, "dunking underwater"],
  [/\b(foul|fouls|fouled|hack|hacked|and one|and1)\b/, "foul fouls violation free throws"],
  [/\b(ft|fts|free throw|free throws|freebie)\b/, "free throws"],
  [/\b(goaltend|goaltending|goal tend|block on the way down|downward)\b/, "goaltending downward"],
  [/\b(rim|hang|hanging)\b/, "rim hanging"],
  [/\b(timeout|time out|break)\b/, "timeouts timeout"],
  [/\b(three|3|3s|threes|line|deep)\b/, "three-point line"],
  [/\b(check|checked|checking|inbound|inbounds)\b/, "checked check"],
  [/\b(ball|possession|whose ball|who gets)\b/, "possession"],
  [/\b(rough|roughness|physical|heated|cheap shot)\b/, "rough roughness physicality"],
  [/\b(head|neck|face)\b/, "head neck"],
  [/\b(ref|referee|call|dispute|argue|argument|vote|majority)\b/, "call violation majority ref"],
  [/\b(coping|bounce|bounced|bounces)\b/, "coping bounces"],
  [/\b(pole|post|stand)\b/, "hoop pole"],
]

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
const STOP = new Set(["the", "a", "an", "is", "it", "of", "to", "in", "on", "and", "or", "if", "can", "you", "i", "be", "was", "what", "does", "do", "when", "rule", "rules", "for", "with", "that", "this", "at", "by", "off", "my", "me", "we", "he", "they", "there"])

export function ruleLines(notes: RuleNote[] = []): RuleLine[] {
  const v = currentRules()
  if (!v) return []
  const out: RuleLine[] = []
  for (const s of v.sections) {
    for (const t of s.lines) out.push({ section: s.title, sub: null, n: s.n, text: t })
    for (const sub of s.subs) for (const t of sub.lines) out.push({ section: s.title, sub: sub.title, n: s.n, text: t })
    for (const note of notes.filter((x) => x.section === s.title)) out.push({ section: s.title, sub: null, n: s.n, text: note.text, note: true })
  }
  return out
}

// The lines that best match what was typed, best first: each word found in a line (or its section or sub-heading) counts, a section-title
// hit counts double, and the words people say are widened to the rulebook's own words first.
export function searchRules(query: string, notes: RuleNote[] = [], limit = 6): RuleLine[] {
  const q = query.toLowerCase()
  const asked = words(q)
  if (!asked.length) return []
  const extra = SAY.filter(([re]) => re.test(q)).flatMap(([, add]) => words(add))
  const want = [...new Set([...asked, ...extra])]
  const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "")
  const scored = ruleLines(notes).map((l) => {
    const body = words(`${l.text} ${l.sub ?? ""}`).map(stem)
    const head = words(l.section).map(stem)
    let score = 0
    for (const w of want) {
      const sw = stem(w)
      const direct = asked.includes(w) ? 2 : 1
      if (body.some((b) => b === sw || (sw.length >= 4 && b.startsWith(sw)))) score += direct
      if (head.includes(sw)) score += 2 * direct
    }
    if (l.note) score += score > 0 ? 0.5 : 0 // the league's own reading first among equals
    return { l, score }
  })
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.l)
}
