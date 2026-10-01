import type { Game, PooleanState } from "./types"

export type Update = (fn: (state: PooleanState) => PooleanState) => void

// Same shape app.js's addGameForm builds, with normalizeGame()'s empty event arrays filled in.
export function newGame(fields: Partial<Game> & { id: string; date: string }): Game {
  return {
    videoUrl: "",
    notes: "",
    winner: null,
    teamA: [],
    teamB: [],
    stats: [],
    matchups: [],
    scoringEvents: [],
    turnoverEvents: [],
    stealEvents: [],
    foulEvents: [],
    plays: [],
    ...fields,
  }
}
