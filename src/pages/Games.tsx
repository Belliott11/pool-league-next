import { CalendarDays, Radio } from "lucide-react"
import { getClient } from "@/lib/cloud"
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
import { LiveBanner, LiveWatch } from "./live/LiveWatch"
import { NightRecap } from "./games/NightRecap"
import { GoingIn } from "./games/GoingIn"
import { StatEntryPage } from "./statentry/StatEntryPage"
import { findLiveGame } from "@/lib/live"

export function GamesPage({
  state,
  update,
  onOpenPlayer,
  sub,
  go,
  goBack,
  openRequest,
}: {
  state: PooleanState
  update: Update
  onOpenPlayer: (id: string) => void
  // Which screen is open inside Games ("" is the list), kept in the address bar by App.
  sub: string
  go: (sub: string, replace?: boolean) => void
  goBack: () => void
  openRequest?: { id: string; time: number | null; n: number } | null
}) {
  const readOnly = useReadOnly()
  const [kind, ...rest] = sub.split(":")
  const arg = rest.join(":")
  const liveOpen = kind === "live"
  const recapOpen = kind === "recap"
  const recapDate = recapOpen && arg ? arg : undefined
  const openGame = kind === "game" || kind === "stat" ? (state.games.find((g) => g.id === arg) ?? null) : null
  // A finished live game lands on its night's recap, in place of the live screen.
  const showRecap = (date?: string) => go(date ? "recap:" + date : "recap", true)
  const open = (g: Game) => go(g.liveInProgress ? "live" : "game:" + g.id)

  if (liveOpen) {
    return readOnly ? <LiveWatch state={state} onClose={goBack} onRecap={showRecap} /> : <LiveGamePage state={state} update={update} onClose={goBack} onRecap={showRecap} />
  }

  if (recapOpen) {
    return (
      <NightRecap
        update={update}
        key={recapDate ?? "latest"}
        initialDate={recapDate}
        state={state}
        onBack={goBack}
        onOpenGame={(id) => go("game:" + id)}
        onOpenPlayer={onOpenPlayer}
      />
    )
  }

  if (openGame && kind === "stat" && !readOnly) {
    return <StatEntryPage state={state} update={update} game={openGame} onBack={goBack} />
  }

  if (openGame) {
    return (
      <GamePage
        state={state}
        update={update}
        game={openGame}
        onStatEntry={() => go("stat:" + openGame.id)}
        autoSeek={openRequest && openRequest.id === openGame.id ? openRequest : null}
        onBack={goBack}
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {readOnly && <LiveBanner state={state} onOpen={() => go("live")} />}
        <div className="flex flex-wrap gap-2">
          {(!readOnly || (!findLiveGame(state) && getClient())) && (
            <Button variant={readOnly ? "outline" : "default"} onClick={() => go("live")}>
              <Radio />
              {findLiveGame(state) ? "Resume live game" : "Start a live game"}
            </Button>
          )}
          {state.games.length > 0 && (
            <Button variant="outline" onClick={() => showRecap()}>
              <CalendarDays />
              Night recap
            </Button>
          )}
        </div>
        <GoingIn state={state} update={update} />
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
      <Sidebar state={state} update={update} onOpenPlayer={onOpenPlayer} onOpenGame={open} />
    </div>
  )
}
