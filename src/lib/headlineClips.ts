import { bestClips, clipKey, words, type Clip } from "@/lib/clips"
import TONES from "@/data/headline-tones.json"
import type { PooleanState } from "@/lib/types"

// Who each hand-written headline is about and whether it is good or bad for them. The editor marks it from the film button beside the
// headline (saved as `headlineTones` in the league data); lines judged earlier by reading them are in src/data/headline-tones.json, and the
// editor's mark wins over that. A line marked nowhere (mixed news, or written since) gets no clip, so a highlight never sits next to a roast.
// Pass the same `used` set for every headline shown together: each clip is then used once.
export type Tones = Record<string, [string, "good" | "bad"]>

// The play to show with a headline. Good news gets a good clip of that player, steered toward one described with the headline's words.
// Bad news gets a clip an editor marked rough for them, or nothing.
export function headlineClip(state: PooleanState, text: string, gameIds?: string[], tones: Tones = TONES as unknown as Tones, used?: Set<string>): Clip | undefined {
  const t = toneOf(state, text, tones)
  if (!t) return undefined
  const top = bestClips(state, { pid: t[0], gameIds, limit: 3, about: text, mood: t[1] === "bad" ? "bad" : undefined, skip: used })
  const pick = choose(top, text)
  if (pick) used?.add(clipKey(pick)) // a clip already used by another headline is never used again: no clip is better than a repeat
  return pick
}

// The editor's mark for a headline, else the data file's. An editor's "no clip" (null) wins too.
export function toneOf(state: PooleanState, text: string, tones: Tones = TONES as unknown as Tones): [string, "good" | "bad"] | undefined {
  const mine = state.headlineTones
  if (mine && Object.hasOwn(mine, text)) return mine[text] ?? undefined
  return tones[text]
}

// The players a headline names, in the order they appear, for the editor to pick who it is about.
export function namedIn(state: PooleanState, text: string): string[] {
  const hits = state.players
    .map((p) => ({ id: p.id, at: new RegExp(`\\b${p.name.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).exec(text)?.index ?? -1 }))
    .filter((h) => h.at >= 0)
  return hits.sort((a, b) => a.at - b.at).map((h) => h.id)
}

function choose(top: Clip[], text: string): Clip | undefined {
  if (top.length < 2) return top[0]
  // A clip described with the headline's words wins. Otherwise the headline picks among the player's best few, so five headlines about
  // one player do not all show the same play.
  const said = words(text)
  const overlap = (c: Clip) => words(`${c.label} ${c.note ?? ""}`).filter((w) => said.includes(w)).length
  const best = top.reduce((m, c) => Math.max(m, overlap(c)), 0)
  if (best > 0) return top.find((c) => overlap(c) === best)
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return top[h % top.length]
}
