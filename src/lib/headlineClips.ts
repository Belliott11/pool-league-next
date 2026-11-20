import { bestClips, words, type Clip } from "@/lib/clips"
import TONES from "@/data/headline-tones.json"
import type { PooleanState } from "@/lib/types"

// Who each hand-written headline is about and whether it is good or bad for them, judged by reading it (src/data/headline-tones.json,
// written with the headlines). A line that is not listed (mixed news, or written since) gets no clip, so a highlight never sits next to a
// roast. It is a data file, so a new headline needs its line added there: ask for "rerun the headline tones".
export type Tones = Record<string, [string, "good" | "bad"]>

// The play to show with a headline. Good news gets a good clip of that player, steered toward one described with the headline's words.
// Bad news gets a clip an editor marked rough for them, or nothing.
export function headlineClip(state: PooleanState, text: string, gameIds?: string[], tones: Tones = TONES as unknown as Tones): Clip | undefined {
  const t = tones[text]
  if (!t) return undefined
  const top = bestClips(state, { pid: t[0], gameIds, limit: 3, about: text, mood: t[1] === "bad" ? "bad" : undefined })
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
