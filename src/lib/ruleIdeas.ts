import { filmedGames } from "@/lib/filmed"
import { joinNames } from "@/lib/format"
import { currentRules } from "@/lib/rulebook"
import type { PooleanState } from "@/lib/types"

// "Make the rules better" on the Rules page: questions the rulebook does not answer yet (each is checked against the current text, so it
// drops off by itself once Poolean's rulebook covers it), and ideas from the league's own numbers. Suggestions for the group to talk about;
// nothing here changes a rule.

export interface Gap {
  key: string
  section: string // where an answer is filed as a league clarification
  topic: string
  ask: string
  why: string | null // what the games show, when they show anything
}

export interface Idea {
  key: string
  title: string
  fact: string
  idea: string
}

const pct = (x: number) => `${Math.round(x * 100)}%`

export function rulesText(): string {
  const v = currentRules()
  if (!v) return ""
  return v.sections.flatMap((s) => [s.title, ...s.lines, ...s.subs.flatMap((x) => [x.title, ...x.lines])]).join(" \n").toLowerCase()
}

export function ruleGaps(state: PooleanState, text = rulesText()): Gap[] {
  const games = state.games.filter((g) => !g.liveInProgress && !g.test)
  const targets = [...new Set(games.map((g) => Number(g.liveTarget)).filter((t) => t > 0))].sort((a, b) => a - b)
  const uneven = games.filter((g) => g.teamA.length !== g.teamB.length).length
  const fts = filmedGames(state).reduce((n, g) => n + g.scoringEvents.filter((e) => e.points === 1).length, 0)
  const all: (Gap & { covered: RegExp })[] = [
    {
      key: "length",
      section: "Scoring",
      topic: "Game length",
      ask: "What score wins a game, and does it have to be won by 2?",
      why: targets.length ? `Games here have been played to ${joinNames(targets.map(String)).replace(/ and ([^ ]+)$/, " or $1")}, and the site's odds assume win by 2.` : "The site's odds assume first to 21, win by 2.",
      covered: /win by|first to \d|played to \d|game (is|goes) to/,
    },
    {
      key: "uneven",
      section: "General principle",
      topic: "Uneven teams",
      ask: "With an odd number of players (3 against 2), is anything different: a head start, a sub, a shorter game?",
      why: uneven ? `${uneven} ${uneven === 1 ? "game has" : "games have"} had uneven teams.` : null,
      covered: /uneven|odd number|extra player|short.?handed|3 (on|against|v) 2/,
    },
    {
      key: "first-ball",
      section: "Possession",
      topic: "First possession",
      ask: "Who starts with the ball?",
      why: null,
      covered: /first possession|starts? with the ball|opening possession|shoot for (the )?ball|coin/,
    },
    {
      key: "after-ft",
      section: "Fouls and penalties",
      topic: "After free throws",
      ask: "Whose ball is it after free throws, made or missed? Do they count toward the winning score?",
      why: fts ? `${fts} free ${fts === 1 ? "throw has" : "throws have"} been logged in filmed games.` : null,
      covered: /after (a |the )?free throws?|free throws? (are|is) (live|dead)|possession after/,
    },
    {
      key: "held",
      section: "Possession",
      topic: "Held ball",
      ask: "When two players both hold the ball and neither lets go, whose is it?",
      why: null,
      covered: /held ball|jump ball|tie.?up|both players (hold|have)/,
    },
    {
      key: "stall",
      section: "General principle",
      topic: "Stalling",
      ask: "Is there any limit on holding the ball without shooting?",
      why: null,
      covered: /shot clock|stall|seconds to shoot|count/,
    },
  ]
  // Answered either by the rulebook's own words or by a league clarification filed against the question.
  const answered = new Set((state.ruleNotes ?? []).map((n) => n.gap).filter(Boolean))
  return all.filter((g) => !g.covered.test(text) && !answered.has(g.key)).map(({ covered, ...g }) => (void covered, g))
}

export function ruleIdeas(state: PooleanState): Idea[] {
  const games = filmedGames(state)
  if (!games.length) return []
  const out: Idea[] = []
  // Where misses go, by shot value: a turnover with missEventId is a miss ruled out of bounds.
  const miss = { 2: { n: 0, out: 0, made: 0, all: 0 }, 3: { n: 0, out: 0, made: 0, all: 0 } }
  for (const g of games) {
    const outs = new Set(g.turnoverEvents.map((t) => t.missEventId).filter(Boolean) as string[])
    for (const e of g.scoringEvents) {
      if (e.points === 1) continue
      const m = miss[e.points]
      m.all++
      if (e.made !== false) m.made++
      else {
        m.n++
        if (outs.has(e.id)) m.out++
      }
    }
  }
  if (miss[3].n >= 10 && miss[2].n >= 10) {
    const r3 = miss[3].out / miss[3].n
    const r2 = miss[2].out / miss[2].n
    out.push({
      key: "oob",
      title: "Missed 3s and the edge of the pool",
      fact: `${pct(r3)} of missed 3s end out of bounds, against ${pct(r2)} of missed 2s (${miss[3].n} and ${miss[2].n} misses).`,
      idea:
        r3 > r2 + 0.1
          ? "The boundary rule decides a lot of long misses. If that feels like it takes the rebound out of the game, the group could look at the coping rule (more balls staying in) or where a 3 can be taken from."
          : "Long and short misses end out of bounds about as often, so the boundary rules treat both shots alike.",
    })
  }
  if (miss[3].all >= 10 && miss[2].all >= 10) {
    const p3 = (3 * miss[3].made) / miss[3].all
    const p2 = (2 * miss[2].made) / miss[2].all
    const gap = p3 - p2
    out.push({
      key: "three",
      title: "Is the 3-point line in the right place?",
      fact: `A 3 is worth ${p3.toFixed(2)} points a shot and a 2 ${p2.toFixed(2)} (${pct(miss[3].made / miss[3].all)} of ${miss[3].all} 3s go in, ${pct(miss[2].made / miss[2].all)} of ${miss[2].all} 2s).`,
      idea:
        Math.abs(gap) < 0.1
          ? "About even, which is what a well placed line looks like: neither shot is a free lunch."
          : gap > 0
            ? "3s pay better than 2s. If games are turning into a shooting contest, moving the line back a little would even it up."
            : "2s pay better than 3s, so most 3s are a worse shot. Moving the line in a little would make the 3 a real choice.",
    })
  }
  // Instant replay: how often a flagged call was overturned.
  const reviews = state.games.flatMap((g) => g.reviews ?? [])
  const decided = reviews.filter((r) => r.verdict)
  if (decided.length >= 3) {
    const over = decided.filter((r) => r.verdict === "overturned").length
    out.push({
      key: "replay",
      title: "Calls that got looked at again",
      fact: `${decided.length} flagged calls were watched back: ${over} overturned, ${decided.length - over} stood.`,
      idea: over / decided.length >= 0.3 ? "A lot of calls change on video. The rulebook's majority rule could name the replay as the tiebreaker when there is one." : "Most calls stand on video, so the majority rule is working.",
    })
  }
  // Roughness: free throws from the unnecessary roughness rule.
  const fts = games.reduce((n, g) => n + g.scoringEvents.filter((e) => e.points === 1).length, 0)
  const fouls = games.reduce((n, g) => n + ((g.foulEvents as unknown[] | undefined)?.length ?? 0), 0)
  out.push({
    key: "rough",
    title: "Fouls and roughness",
    fact: `${fouls} ${fouls === 1 ? "foul" : "fouls"} and ${fts} free ${fts === 1 ? "throw" : "throws"} over ${games.length} filmed games.`,
    idea:
      fouls / games.length >= 1
        ? "Fouls come up most games. Since regular shooting fouls give nothing, the group could decide whether a foul on a made basket should count (an and-one) or a foul on a miss should give the ball back."
        : "Fouls are rare, so the self-called system is holding up.",
  })
  return out
}
