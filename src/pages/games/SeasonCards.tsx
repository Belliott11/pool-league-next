import { Newspaper, Trophy } from "lucide-react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import { RECORD_KEYS, RECORD_LABEL, chasers, recordBook } from "@/lib/records"
import { useLabeledState } from "@/lib/labelsContext"
import { usePublishedStories } from "@/lib/published"
import { StoryList } from "@/components/StoryList"
import { seasonStories } from "@/lib/storylines"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"

// The league's single-game records, with who holds each and when.
export function RecordsCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const book = useMemo(() => recordBook(state), [state])
  const keys = RECORD_KEYS.filter((k) => book[k])
  const chasing = useMemo(() => chasers(state), [state])
  if (keys.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Trophy aria-hidden className="size-4 text-gold" /> League records
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {keys.map((k) => {
            const r = book[k]!
            return (
              <li key={k} className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">{RECORD_LABEL[k]}</span>
                <span className="text-right">
                  <span className="font-display font-bold tabular-nums">{Number.isInteger(r.value) ? r.value : r.value.toFixed(1)}</span>{" "}
                  <button type="button" className="hover:underline" onClick={() => onOpenPlayer(r.playerId)}>
                    {playerName(state, r.playerId)}
                  </button>
                  <span className="block text-xs text-muted-foreground">{formatDateDisplay(r.date)}</span>
                </span>
              </li>
            )
          })}
        </ul>
        {chasing.length > 0 && (
          <div className="mt-3 flex flex-col gap-1 border-t pt-3">
            <h4 className="text-sm font-semibold">Closest to a record</h4>
            <ul className="flex flex-col gap-1 text-sm">
              {chasing.map((c) => (
                <li key={c.key}>
                  <button type="button" className="font-medium hover:underline" onClick={() => onOpenPlayer(c.playerId)}>
                    {playerName(state, c.playerId)}
                  </button>{" "}
                  <span className="text-muted-foreground">
                    is {c.gap} shy of {playerName(state, c.holderId)}&apos;s {c.value} {RECORD_LABEL[c.key].toLowerCase()} (best game: {c.best})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Storylines for the season so far: who leads, the longest streak, the closest race.
export function SeasonStoriesCard({ state, update }: { state: PooleanState; update?: Update }) {
  const labeled = useLabeledState(state)
  const written = useMemo(() => seasonStories(labeled, (id) => playerName(state, id)), [labeled, state])
  const stories = usePublishedStories(state, update, "season", written)
  if (stories.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Newspaper aria-hidden className="size-4 text-accent" /> The season so far
        </CardTitle>
      </CardHeader>
      <CardContent>
        <StoryList stories={stories} />
      </CardContent>
    </Card>
  )
}
