// Voice scoring on the live screens: what someone said ("Zach three", "two for Ben", "Logan W and one") turned into a basket. Only the
// players in the game are matched, so most first names are enough; when two players share one ("Logan H", "Logan W") the letter after it
// decides. Live scoring logs who scored and how many, so a pass ("off Adam") is heard but not saved.

export interface Who {
  id: string
  name: string
}

export type Call =
  | { ok: true; pid: string; points: 1 | 2 | 3; passer: string | null; heard: string }
  | { ok: false; why: string; heard: string }

// Words the phone's speech recognition writes for each value, homophones included ("to", "tree", "won").
const POINTS: [RegExp, 1 | 2 | 3][] = [
  [/\b(three|3|tree|trey|three pointer|threes|from deep|from downtown|deep)\b/, 3],
  [/\b(two|2|to|too|deuce|bucket|layup|lay up|basket|dunk)\b/, 2],
  [/\b(one|1|won|free throw|and one|and 1|freebie)\b/, 1],
]

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

// Edit distance, for names the phone spells a little wrong ("Zack", "Reiley").
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

// Where in the words a player is named (index of the first word), or -1. A name's first word must match (exactly, or one letter off for
// names of 4+ letters, two for 6+, so "Riley" finds Reilly); a second part ("W", "T") is checked when the name has one and another player shares the first word.
function findName(words: string[], p: Who, shared: boolean): number {
  const parts = norm(p.name).split(" ")
  const first = parts[0]
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const close = w === first || (first.length >= 4 && w.length >= 3 && distance(w, first) <= (first.length >= 6 ? 2 : 1))
    if (!close) continue
    if (!shared || parts.length < 2) return i
    const rest = parts[1]
    const next = words[i + 1] ?? ""
    // "Logan W", "Logan double you", "Michael T", "Michael tee": the letter, its spoken name, or the surname's first letter.
    const letter = rest[0]
    const spoken: Record<string, string[]> = { w: ["w", "double", "dub"], t: ["t", "tee", "tea"], k: ["k", "kay"], h: ["h", "aitch", "age"] }
    if (next === rest || (next[0] === letter && next.length <= 2) || (spoken[letter] ?? []).includes(next)) return i
  }
  return -1
}

export function parseCall(text: string, players: Who[]): Call {
  const heard = text.trim()
  const said = norm(text)
  if (!said) return { ok: false, why: "Did not catch that.", heard }
  const words = said.split(" ")
  const firstOf = (p: Who) => norm(p.name).split(" ")[0]
  const named = players
    .map((p) => ({ p, at: findName(words, p, players.filter((q) => firstOf(q) === firstOf(p)).length > 1) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
  // The scorer is the first player named; one named after "off", "from" or "assist" is the passer.
  const passWord = /\b(off|from|assist|assisted|feed|dish)\b/
  const passAt = words.findIndex((w, i) => passWord.test(w) && !(w === "from" && /^(deep|downtown)$/.test(words[i + 1] ?? "")))
  // A first name two players in the game share, said without the letter ("Logan two"), before any pass word: ask, never guess.
  const before = passAt < 0 ? words : words.slice(0, passAt)
  const shared = [...new Set(players.map(firstOf))].filter((f) => players.filter((q) => firstOf(q) === f).length > 1)
  const vague = shared.find((f) => before.includes(f) && !named.some((x) => x.at < (passAt < 0 ? words.length : passAt) && firstOf(x.p) === f))
  if (vague) return { ok: false, why: `Which ${vague[0].toUpperCase()}${vague.slice(1)}? Say the letter too.`, heard }
  if (!named.length) return { ok: false, why: "Did not hear a player in this game.", heard }
  const scorer = named.find((x) => passAt < 0 || x.at < passAt)
  if (!scorer) return { ok: false, why: "Did not hear who scored.", heard }
  const passer = named.find((x) => x !== scorer && passAt >= 0 && x.at > passAt)?.p.id ?? null
  const sameFirst = named.filter((x) => x.at === scorer.at)
  if (sameFirst.length > 1) return { ok: false, why: `Which ${firstOf(scorer.p)}? Say the letter too.`, heard }
  // Points: look at the words without the names, so "Tony" or "Juan" never read as a number.
  const nameWords = new Set(named.flatMap((x) => norm(x.p.name).split(" ")))
  const rest = words.filter((w) => !nameWords.has(w)).join(" ")
  const hit = POINTS.find(([re]) => re.test(rest))
  if (!hit) return { ok: false, why: "Did not hear one, two or three.", heard }
  return { ok: true, pid: scorer.p.id, points: hit[1], passer, heard }
}
