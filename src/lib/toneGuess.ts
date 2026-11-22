import TONES from "@/data/headline-tones.json"
import type { PooleanState } from "@/lib/types"

// A guess at whether a headline is good or bad news, from the words of the headlines already marked (src/data/headline-tones.json and the
// editor's own marks), for the editor to confirm with one tap, never applied by itself. A plain word count (naive Bayes). Tried by
// guessing each of the 78 judged lines from the other 77: right on 68; when at least 80% sure (57 of them), right on 52.
const SURE = 0.8

const words = (s: string) => [...new Set(s.toLowerCase().match(/[a-z]{3,}/g) ?? [])]

export function guessTone(state: PooleanState, text: string): { tone: "good" | "bad"; sure: number } | null {
  const marked = new Map<string, "good" | "bad">()
  for (const [line, [, tone]] of Object.entries(TONES as unknown as Record<string, [string, "good" | "bad"]>)) marked.set(line, tone)
  for (const [line, mark] of Object.entries(state.headlineTones ?? {})) {
    if (mark) marked.set(line, mark[1])
    else marked.delete(line) // marked "no clip": mixed news, which says nothing either way
  }
  marked.delete(text) // never learn from the headline being guessed
  if (marked.size < 10) return null
  const count = { good: new Map<string, number>(), bad: new Map<string, number>() }
  const lines = { good: 0, bad: 0 }
  const total = { good: 0, bad: 0 }
  const vocab = new Set<string>()
  for (const [line, tone] of marked) {
    lines[tone]++
    for (const w of words(line)) {
      count[tone].set(w, (count[tone].get(w) ?? 0) + 1)
      total[tone]++
      vocab.add(w)
    }
  }
  const score = (tone: "good" | "bad") =>
    Math.log(lines[tone] / marked.size) + words(text).reduce((sum, w) => sum + Math.log(((count[tone].get(w) ?? 0) + 1) / (total[tone] + vocab.size)), 0)
  const good = 1 / (1 + Math.exp(score("bad") - score("good")))
  const sure = Math.max(good, 1 - good)
  return sure >= SURE ? { tone: good >= 0.5 ? "good" : "bad", sure } : null
}
