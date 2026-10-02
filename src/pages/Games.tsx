import { Radio } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import type { Update } from "@/lib/store"
import type { Game, PooleanState } from "@/lib/types"
import { BalanceAndPredict } from "./games/BalanceAndPredict"
import { GamePage } from "./games/GamePage"
import { GameLog } from "./games/GameLog"
import { Section } from "@/components/Section"
import { useReadOnly } from "@/lib/mode"
import { SetUpTonight } from "./games/SetUpTonight"
import { Sidebar } from "./games/Sidebar"
import { LiveGamePage } from "./live/LiveGamePage"
import { StatEntryPage } from "./statentry/StatEntryPage"
import { findLiveGame } from "@/lib/live"

export function GamesPage({
  state,
  update,
  onOpenPlayer,
  liveOpen,
  setLiveOpen,
}: {
  state: PooleanState
  update: Update
  onOpenPlayer: (id: string) => void
  liveOpen: boolean
  setLiveOpen: (open: boolean) => void
}) {
  const readOnly = useReadOnly()
  const [openId, setOpenId] = useState<string | null>(null)
  const [statEntry, setStatEntry] = useState(false)
  // Same deep link the classic site's Share button writes: #game=<id>.
  useEffect(() => {
    const m = location.hash.match(/^#game=(.+)$/)
    if (m) setOpenId(decodeURIComponent(m[1]))
  }, [])
  const openGame = state.games.find((g) => g.id === openId) ?? null
  const open = (g: Game) => setOpenId(g.id)

  if (liveOpen && !readOnly) return <LiveGamePage state={state} update={update} onClose={() => setLiveOpen(false)} />

  if (openGame && statEntry && !readOnly) {
    return <StatEntryPage state={state} update={update} game={openGame} onBack={() => setStatEntry(false)} />
  }

  if (openGame) {
    return (
      <GamePage
        state={state}
        update={update}
        game={openGame}
        onStatEntry={() => setStatEntry(true)}
        onBack={() => {
          setOpenId(null)
          setStatEntry(false)
          if (location.hash) history.replaceState(null, "", location.pathname + location.search)
        }}
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {!readOnly && (
          <Button className="self-start" onClick={() => setLiveOpen(true)}>
            <Radio />
            {findLiveGame(state) ? "Resume live game" : "Start a live game"}
          </Button>
        )}
        <GameLog state={state} update={update} onOpen={open} />
        {!readOnly && (
          <>
            <Section id="games-section-setup" title="Set Up Tonight" teaser="RSVP who's coming and log tonight's game">
              <SetUpTonight state={state} update={update} onCreated={open} />
            </Section>
            <Section id="games-section-balance" title="Balance & Predict" teaser="Even splits, matchup odds, and a full night's schedule">
              <BalanceAndPredict state={state} update={update} onCreated={open} />
            </Section>
          </>
        )}
      </div>
      <Sidebar state={state} onOpenPlayer={onOpenPlayer} onOpenGame={open} />
    </div>
  )
}
