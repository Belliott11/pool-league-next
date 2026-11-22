import { Suspense, type ReactNode } from "react"
import { lazyPage } from "@/lib/lazyPage"
import { CalendarDays, Crown, Radio } from "lucide-react"
import { PageSkeleton } from "@/components/PageSkeleton"
import { getClient } from "@/lib/cloud"
import { Button } from "@/components/ui/button"
import type { Update } from "@/lib/store"
import type { Game, PooleanState } from "@/lib/types"
import { GameLog } from "./games/GameLog"
import { Section } from "@/components/Section"
import { useReadOnly } from "@/lib/mode"
import { Sidebar } from "./games/Sidebar"
import { LiveBanner } from "./live/LiveBanner"
import { GoingIn } from "./games/GoingIn"
import { NightPreviewCard } from "./games/NightPreview"
import { PickEmCard } from "./games/PickEm"
import { findLiveGame } from "@/lib/live"
import { upcomingRsvp } from "@/lib/nightPreview"
import { showHub } from "@/lib/offseason"
import { OffseasonHub } from "./games/OffseasonHub"
import { MyCard } from "./games/MyCard"
import { TopPlays } from "./games/TopPlays"

// Screens opened from the game list load when first opened, so the list itself shows up faster.
const BalanceAndPredict = lazyPage(() => import("./games/BalanceAndPredict").then((m) => ({ default: m.BalanceAndPredict })))
const GamePage = lazyPage(() => import("./games/GamePage").then((m) => ({ default: m.GamePage })))
const LiveGamePage = lazyPage(() => import("./live/LiveGamePage").then((m) => ({ default: m.LiveGamePage })))
// The live screens and the editor's Set Up Tonight load only when opened, so a visitor's first load stays smaller.
const LiveWatch = lazyPage(() => import("./live/LiveWatch").then((m) => ({ default: m.LiveWatch })))
const SetUpTonight = lazyPage(() => import("./games/SetUpTonight").then((m) => ({ default: m.SetUpTonight })))
const NightRecap = lazyPage(() => import("./games/NightRecap").then((m) => ({ default: m.NightRecap })))
const StatEntryPage = lazyPage(() => import("./statentry/StatEntryPage").then((m) => ({ default: m.StatEntryPage })))
const HallOfFame = lazyPage(() => import("./games/HallOfFame").then((m) => ({ default: m.HallOfFame })))
const Wrapped = lazyPage(() => import("./games/Wrapped").then((m) => ({ default: m.Wrapped })))
const ClipPage = lazyPage(() => import("./games/ClipPage").then((m) => ({ default: m.ClipPage })))
const Lazy = ({ children }: { children: ReactNode }) => <Suspense fallback={<PageSkeleton label="Loading" />}>{children}</Suspense>

export function GamesPage({
  state,
  pastSeasons = false,
  update,
  onOpenPlayer,
  sub,
  go,
  goBack,
  openRequest,
}: {
  state: PooleanState
  pastSeasons?: boolean
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

  if (kind === "wrapped") {
    return <Lazy><Wrapped state={state} playerId={arg || undefined} onPick={(id) => go("wrapped:" + id, true)} onClose={goBack} /></Lazy>
  }

  if (kind === "clip") {
    return <Lazy><ClipPage state={state} id={arg} onBack={goBack} onOpenGame={(id) => go("game:" + id)} /></Lazy>
  }

  if (kind === "hall") {
    return <Lazy><HallOfFame state={state} onBack={goBack} onOpenPlayer={onOpenPlayer} onOpenGame={(id) => go("game:" + id)} /></Lazy>
  }

  if (liveOpen) {
    return readOnly ? <Lazy><LiveWatch state={state} onClose={goBack} onRecap={showRecap} /></Lazy> : <Lazy><LiveGamePage state={state} update={update} onClose={goBack} onRecap={showRecap} /></Lazy>
  }

  if (recapOpen) {
    return (
      <Lazy><NightRecap
        update={update}
        key={recapDate ?? "latest"}
        initialDate={recapDate}
        state={state}
        onBack={goBack}
        onOpenGame={(id) => go("game:" + id)}
        onStatEntry={(id) => go("stat:" + id)}
        onOpenPlayer={onOpenPlayer}
      /></Lazy>
    )
  }

  if (openGame && kind === "stat" && !readOnly) {
    return <Lazy><StatEntryPage state={state} update={update} game={openGame} onBack={goBack} /></Lazy>
  }

  if (openGame) {
    return (
      <Lazy><GamePage
        state={state}
        update={update}
        game={openGame}
        onStatEntry={() => go("stat:" + openGame.id)}
        onOpenGame={open}
        autoSeek={openRequest && openRequest.id === openGame.id ? openRequest : null}
        onBack={goBack}
      /></Lazy>
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
          {state.games.length > 0 && (
            <Button variant="outline" onClick={() => go("hall")}>
              <Crown />
              Hall of fame
            </Button>
          )}
        </div>
        <MyCard state={state} onOpenPlayer={onOpenPlayer} />
        <TopPlays state={state} />
        {showHub(state) && <OffseasonHub state={state} onWrapped={() => go("wrapped")} onOpenPlayer={onOpenPlayer} onLive={() => go("live")} onOpenGame={open} />}
        <PickEmCard state={state} />
        {/* The hub already covers opening night, so the regular next-night card would repeat it. */}
        {!(showHub(state) && upcomingRsvp(state)?.date === state.openingNight?.date) && <NightPreviewCard state={state} update={update} />}
        <GoingIn state={state} update={update} />
        <GameLog state={state} update={update} onOpen={open} />
        {!readOnly && (
          <>
            <Section id="games-section-setup" title="Set Up Tonight" teaser="RSVP who's coming and log tonight's game">
              <Lazy><SetUpTonight state={state} update={update} onCreated={open} /></Lazy>
            </Section>
            <Section id="games-section-balance" title="Balance & Predict" teaser="Even splits, matchup odds, and a full night's schedule">
              <Lazy><BalanceAndPredict state={state} update={update} onCreated={open} /></Lazy>
            </Section>
          </>
        )}
      </div>
      <Sidebar state={state} pastSeasons={pastSeasons} update={update} onOpenPlayer={onOpenPlayer} onOpenGame={open} />
    </div>
  )
}
