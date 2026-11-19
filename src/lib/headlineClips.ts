import { bestClips, type Clip } from "@/lib/clips"
import type { PooleanState } from "@/lib/types"

// A headline that is about something going badly. ponytail: a word list; a headline it misses just gets no rough clip, never the wrong one.
const BAD = /\b(struggl\w*|cold|slump\w*|cool(?:ed|ing)|los(?:t|ing|s)|fell|fall(?:s|ing)|rough|turnovers?|miss(?:ed|es)?|bricks?|dipp?ed|dropp?ed|trouble|sluggish|slid|slipp?ed)\b/i

const escape = (t: string) => t.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")

export const isBadNews = (text: string) => BAD.test(text)

// The play to show with a headline: the first player it names, their best clip for it. Good news gets a good clip (the words of the headline
// steer it toward a clip described the same way). Bad news gets a clip an editor marked rough for them, or nothing, never a highlight.
export function headlineClip(state: PooleanState, text: string, gameIds?: string[]): Clip | undefined {
  const named = state.players
    .map((p) => ({ id: p.id, at: text.search(new RegExp(`\\b${escape(p.name)}\\b`)) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)[0]
  if (!named) return undefined
  return bestClips(state, { pid: named.id, gameIds, limit: 1, about: text, mood: isBadNews(text) ? "bad" : undefined })[0]
}
