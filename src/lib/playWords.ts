// One play told as a plain sentence, the way someone would describe it: "Zach hits a 3 off Ben's pass after getting past Ian." or
// "Ben misses on the drive with Ian all over it. Ian grabs the board." Used by the film room (filmRoom.ts) and the play-by-play line on
// the game video (playByPlay.ts). Never a pronoun for a player (they are named), and no "good"/"no good" verdict tacked on the end.

export type Name = (pid: string) => string

export interface ShotWords {
  player: string
  points: number // 1 (free throw), 2 or 3
  made: boolean
  shotType: string | null // drive, move, catchAndShoot, deepHeave, dunk
  passer: string | null // on a make
  defenders: string[]
  contest: string | null // none, beat, light, medium, heavy
  blocker: string | null
  end: "made" | "out" | "kept" | "lost" | null // where a miss went: out of bounds, back to the shooting team, or to the defense
  rebounder: string | null
}

// What happened to the shot: "hits a 3", "scores on the drive", "misses a deep heave".
function verb(s: ShotWords): string {
  if (s.points === 1) return s.made ? "hits a free throw" : "misses a free throw"
  if (s.shotType === "dunk") return s.made ? "dunks it" : "misses a dunk"
  if (s.points === 3) {
    if (s.shotType === "deepHeave") return s.made ? "hits a deep heave" : "misses a deep heave"
    return s.made ? "hits a 3" : "misses a 3"
  }
  if (s.shotType === "drive") return s.made ? "scores on the drive" : "misses on the drive"
  if (s.shotType === "move") return s.made ? "scores off a move" : "misses off a move"
  if (s.shotType === "catchAndShoot") return s.made ? "hits a 2 off the catch" : "misses a 2 off the catch"
  return s.made ? "hits a 2" : "misses a 2"
}

// The shot as a noun, for a block: "Ian blocks Ben's drive."
function noun(s: ShotWords): string {
  if (s.shotType === "dunk") return "dunk"
  if (s.points === 3) return s.shotType === "deepHeave" ? "heave" : "3"
  if (s.shotType === "drive") return "drive"
  return "shot"
}

// Who was guarding, and how closely: "after getting past Ian", "over Ian", "with Ian all over it", "wide open".
function guard(s: ShotWords, name: Name): string {
  const d = s.defenders.map(name).join(" and ")
  if (!s.defenders.length) return s.contest === "none" ? " wide open" : ""
  switch (s.contest) {
    case "beat":
      return ` after getting past ${d}`
    case "heavy":
      return s.made ? ` over ${d}` : ` with ${d} all over it`
    case "medium":
      return ` with ${d} contesting`
    case "light":
      return ` with ${d} close`
    case "none":
      return ` with ${d} a step off`
    default:
      return ` with ${d} guarding`
  }
}

export function shotSentence(s: ShotWords, name: Name): string {
  const who = name(s.player)
  if (!s.made && s.blocker) return `${name(s.blocker)} blocks ${who}'s ${noun(s)}.`
  const pass = s.made && s.passer ? ` off ${name(s.passer)}'s pass` : ""
  // A catch and shoot off a pass is just "off Ben's pass" (not "off the catch off Ben's pass").
  const v = s.made && s.passer && s.shotType === "catchAndShoot" && s.points === 2 ? "hits a 2" : verb(s)
  const first = `${who} ${v}${pass}${guard(s, name)}.`
  if (s.made || s.points === 1) return first
  if (s.end === "out") return `${first} It goes out of bounds.`
  if (s.end === "kept" && s.rebounder) return `${first} ${name(s.rebounder)} keeps it alive.`
  if (s.rebounder) return `${first} ${name(s.rebounder)} grabs the board.`
  return first
}

export const turnoverSentence = (player: string, forcer: string | null, name: Name) => (forcer ? `${name(forcer)} picks off ${name(player)}.` : `${name(player)} turns it over.`)
