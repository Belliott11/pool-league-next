// How much is behind a number. A percentage shown on its own hides whether it is 5 of 15 or 50 of 150, so tables put the count next to
// it and fade it when it is thin. These thresholds are the only place that decides "thin"; nothing here changes how a stat is computed.
export const SAMPLE_MIN = {
  shots: 15, // shooting percentages: shots taken
  faced: 5, // defensive percentages: shots faced
  games: 4, // per-game rates: games played
} as const

export type SampleKind = keyof typeof SAMPLE_MIN

// What a column reports about one row: how much data, and the words to print next to the value.
export interface Sample {
  kind: SampleKind
  n: number
  count: string // "5/15", "15 FGA", "6 GP"
}

export const isLowSample = (s: Pick<Sample, "kind" | "n">) => s.n < SAMPLE_MIN[s.kind]

export const lowSampleNote = (s: Pick<Sample, "kind">) =>
  `Fewer than ${SAMPLE_MIN[s.kind]} ${s.kind === "games" ? "games" : s.kind === "faced" ? "shots faced" : "shots"}, so this can swing a lot`

export const shotSample = (made: number, att: number): Sample => ({ kind: "shots", n: att, count: `${made}/${att}` })
export const fgaSample = (att: number): Sample => ({ kind: "shots", n: att, count: `${att} FGA` })
export const facedSample = (hit: number, faced: number): Sample => ({ kind: "faced", n: faced, count: `${hit}/${faced}` })
export const gamesSample = (gp: number): Sample => ({ kind: "games", n: gp, count: `${gp} GP` })

const KEY = "pooleanIntelHideLowSample"
export const readHideLow = () => {
  try {
    return localStorage.getItem(KEY) === "true"
  } catch {
    return false
  }
}
export const writeHideLow = (v: boolean) => {
  try {
    localStorage.setItem(KEY, String(v))
  } catch {
    // private window: the choice just does not persist
  }
}
