import { findLiveGame } from "@/lib/live"
import { upcomingRsvp } from "@/lib/nightPreview"
import { isOffseason, seasonGames, showHub } from "@/lib/offseason"
import { openForVotes } from "@/lib/pickem"
import { currentSet, teamOf } from "@/lib/seasonTeams"
import type { PooleanState } from "@/lib/types"

// "Next up for you" on the Games home (MyCard): the few things worth doing right now for the player who said who they are, most
// pressing first. Each step says where it goes: a Games screen (`sub`), a tab of their own Player page, or a card further down this page.
export type StepGo = { kind: "sub"; sub: string } | { kind: "tab"; tab: string } | { kind: "scroll"; id: string }

export interface Step {
  key: string
  text: string
  button: string
  go: StepGo
}

export const MAX_STEPS = 4

export function nextSteps(state: PooleanState, me: string, opts: { mixtape?: boolean; rival?: string | null; today?: string; ballotDone?: boolean } = {}): Step[] {
  const out: Step[] = []
  const live = findLiveGame(state)
  if (live && !live.test) {
    const playing = live.teamA.includes(me) || live.teamB.includes(me)
    out.push({ key: "live", text: playing ? "You are in the game on now." : "A game is on now.", button: "Follow it live", go: { kind: "sub", sub: "live" } })
  }
  if (openForVotes(state).some((g) => !g.test)) out.push({ key: "pickem", text: "Pick'em is open: call who wins before the first basket.", button: "Make your pick", go: { kind: "scroll", id: "pickem-card" } })
  const ballot = state.awardBallots?.at(-1)
  if (ballot?.open && !opts.ballotDone) out.push({ key: "awards", text: `Vote for the ${ballot.label} awards: MVP and more. Nobody sees your ballot.`, button: "Vote", go: { kind: "sub", sub: "awards" } })
  const next = upcomingRsvp(state, opts.today)
  if (next && showHub(state) && !next.playerIds.includes(me)) out.push({ key: "rsvp", text: "Opening night is coming. Let everyone know if you are in.", button: "Answer", go: { kind: "scroll", id: "offseason-hub" } })
  const team = teamOf(currentSet(state), me)
  if (team) out.push({ key: "team", text: `You are on ${team.name}. See the standings and your teammates.`, button: "Your team", go: { kind: "sub", sub: "teams" } })
  const mine = seasonGames(state).filter((g) => !g.test && !g.liveInProgress && (g.teamA.includes(me) || g.teamB.includes(me)))
  if (isOffseason(state) && mine.length > 0) out.push({ key: "wrapped", text: "Your season, one slide at a time.", button: "Your Wrapped", go: { kind: "sub", sub: `wrapped:${me}` } })
  const filmed = state.games.some((g) => !g.test && !g.liveInProgress && (g.teamA.includes(me) || g.teamB.includes(me)) && g.scoringEvents.some((e) => e.videoTime != null))
  if (filmed) out.push({ key: "film", text: "Watch your best plays, the ones to fix, and how people score on you.", button: "Your film", go: { kind: "tab", tab: "film" } })
  if (opts.mixtape) out.push({ key: "mixtape", text: "Your best plays of the season, cut together.", button: "Your mixtape", go: { kind: "tab", tab: "overview" } })
  if (opts.rival) out.push({ key: "rival", text: "Settle it with your biggest rival: the record and the tale of the tape.", button: "Head to head", go: { kind: "sub", sub: `h2h:${me},${opts.rival}` } })
  return out.slice(0, MAX_STEPS)
}
