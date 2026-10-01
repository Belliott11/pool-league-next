import { useEffect, useState } from "react"
import type { Update } from "@/lib/store"
import type { Game, PooleanState } from "@/lib/types"
import { BalanceAndPredict } from "./games/BalanceAndPredict"
import { GamePage } from "./games/GamePage"
import { GameLog } from "./games/GameLog"
import { Section } from "@/components/Section"
import { SetUpTonight } from "./games/SetUpTonight"
import { Sidebar } from "./games/Sidebar"

export function GamesPage({
  state,
  update,
  onOpenPlayer,
}: {
  state: PooleanState
  update: Update
  onOpenPlayer: (id: string) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  // Same deep link the classic site's Share button writes: #game=<id>.
  useEffect(() => {
    const m = location.hash.match(/^#game=(.+)$/)
    if (m) setOpenId(decodeURIComponent(m[1]))
  }, [])
  const openGame = state.games.find((g) => g.id === openId) ?? null
  const open = (g: Game) => setOpenId(g.id)

  if (openGame) {
    return (
      <GamePage
        state={state}
        game={openGame}
        onBack={() => {
          setOpenId(null)
          if (location.hash) history.replaceState(null, "", location.pathname + location.search)
        }}
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <GameLog state={state} update={update} onOpen={open} />
        <Section id="games-section-setup" title="Set Up Tonight" teaser="RSVP who's coming and log tonight's game">
          <SetUpTonight state={state} update={update} onCreated={open} />
        </Section>
        <Section id="games-section-balance" title="Balance & Predict" teaser="Even splits, matchup odds, and a full night's schedule">
          <BalanceAndPredict state={state} update={update} onCreated={open} />
        </Section>
      </div>
      <Sidebar state={state} onOpenPlayer={onOpenPlayer} onOpenGame={open} />
    </div>
  )
}
