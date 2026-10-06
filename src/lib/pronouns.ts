import type { Player } from "@/lib/types"

// Headline wording is written with "they", "them" and "their" so it reads right for anyone. When the editor picks he
// or she for a player, the lines about that player are switched over, with the verbs fixed ("they are" becomes
// "he is").
type Pick = "he" | "she"

const WORDS: Record<Pick, Record<string, string>> = {
  he: { they: "he", them: "him", their: "his", theirs: "his", themselves: "himself" },
  she: { they: "she", them: "her", their: "her", theirs: "hers", themselves: "herself" },
}
const VERBS: Record<string, string> = { are: "is", were: "was", have: "has", do: "does", "don't": "doesn't", know: "knows", score: "scores", prove: "proves", play: "plays", keep: "keeps", come: "comes" }
const keepCase = (word: string, like: string) => (like[0] === like[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word)

export function applyPronouns(text: string, pick: Pick | undefined): string {
  if (!pick) return text
  const w = WORDS[pick]
  return text
    .replace(/\b(they) (are|were|have|do|don't|know|score|prove|play|keep|come)\b/gi, (_m, they: string, verb: string) => `${keepCase(w.they, they)} ${VERBS[verb.toLowerCase()]}`)
    .replace(/\b(they|them|their|theirs|themselves)\b/gi, (m, _w, at: number, all: string) => {
      // "most of them" is about things, not the player.
      if (m.toLowerCase() === "them" && all.slice(Math.max(0, at - 3), at) === "of ") return m
      return keepCase(w[m.toLowerCase()], m)
    })
}

let chosen: Record<string, Pick> = {}
export const setPronouns = (players: Player[]) => {
  chosen = Object.fromEntries(players.filter((p) => p.pronouns).map((p) => [p.id, p.pronouns as Pick]))
}
// A line about this player, in the pronouns the editor chose for them.
export const forPlayer = (id: string | null, text: string) => (id ? applyPronouns(text, chosen[id]) : text)
