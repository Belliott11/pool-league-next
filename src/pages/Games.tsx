import { Suspense, type ReactNode } from "react"
import { PotyCard } from "./games/PlayOfYear"
import { lazyPage } from "@/lib/lazyPage"
import { Calculator, CalendarDays, Crown, Radio, Shield, Swords, Trophy } from "lucide-react"
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
import { NewSeasonPrompt } from "./games/NewSeasonPrompt"
import { MyCard } from "./games/MyCard"
import { Welcome } from "@/components/WhoAmI"
import { TopPlays } from "./games/TopPlays"
import { GameAlerts } from "@/components/GameAlerts"

// Screens opened from the game list load when first opened, so the list itself shows up faster.
const BalanceAndPredict = lazyPage(() => import("./games/BalanceAndPredict").then((m) => ({ default: m.BalanceAndPredict })))
const GamePage = lazyPage(() => import("./games/GamePage").then((m) => ({ default: m.GamePage })))
const LiveGamePage = lazyPage(() => import("./live/LiveGamePage").then((m) => ({ default: m.LiveGamePage })))
// The live screens and the editor's Set Up Tonight load only when opened, so a visitor's first load stays smaller.
const LiveWatch = lazyPage(() => import("./live/LiveWatch").then((m) => ({ default: m.LiveWatch })))
const SetUpTonight = lazyPage(() => import("./games/SetUpTonight").then((m) => ({ default: m.SetUpTonight })))
const SeasonTeamsPage = lazyPage(() => import("./games/SeasonTeams").then((m) => ({ default: m.SeasonTeamsPage })))
const HowItWorks = lazyPage(() => import("./games/HowItWorks").then((m) => ({ default: m.HowItWorks })))
const NightRecap = lazyPage(() => import("./games/NightRecap").then((m) => ({ default: m.NightRecap })))
const StatEntryPage = lazyPage(() => import("./statentry/StatEntryPage").then((m) => ({ default: m.StatEntryPage })))
const HallOfFame = lazyPage(() => import("./games/HallOfFame").then((m) => ({ default: m.HallOfFame })))
const Wrapped = lazyPage(() => import("./games/Wrapped").then((m) => ({ default: m.Wrapped })))
const FilmPlayPage = lazyPage(() => import("./games/FilmPlayPage").then((m) => ({ default: m.FilmPlayPage })))
const PlayOfYearPage = lazyPage(() => import("./games/PlayOfYear").then((m) => ({ default: m.PlayOfYearPage })))
const HeadToHeadPage = lazyPage(() => import("./games/HeadToHeadPage").then((m) => ({ default: m.HeadToHeadPage })))
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

  if (kind === "h2h") {
    return <Lazy><HeadToHeadPage state={state} ids={arg} onBack={goBack} onOpenGame={open} onOpenPlayer={onOpenPlayer} onPick={(ids) => go("h2h:" + ids, true)} /></Lazy>
  }

  if (kind === "teams") {
    return <Lazy><SeasonTeamsPage state={state} update={update} onBack={goBack} onOpenPlayer={onOpenPlayer} onOpenGame={open} link={arg || undefined} onLinked={() => go("teams", true)} /></Lazy>
  }

  if (kind === "film") {
    return <Lazy><FilmPlayPage state={state} arg={arg} onBack={goBack} onOpenGame={(id) => go("game:" + id)} /></Lazy>
  }

  if (kind === "poty") {
    return <Lazy><PlayOfYearPage state={state} update={update} onBack={goBack} /></Lazy>
  }

  if (kind === "how") {
    return <Lazy><HowItWorks state={state} onBack={goBack} onOpenGame={(id) => go("game:" + id)} /></Lazy>
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
        {!readOnly && <NewSeasonPrompt state={state} update={update} />}
        {(!readOnly || (!findLiveGame(state) && getClient())) && (
          <Button className="self-start" variant={readOnly ? "outline" : "default"} onClick={() => go("live")}>
            <Radio />
            {findLiveGame(state) ? "Resume live game" : "Start a live game"}
          </Button>
        )}
        <Welcome state={state} />
        <MyCard state={state} onOpenPlayer={onOpenPlayer} go={go} />
        <Explore
          tiles={[
            state.games.length > 0 && { key: "recap", Icon: CalendarDays, title: "Night recap", text: "Every game from the last night, the player of the night and the plays.", onClick: () => showRecap() },
            ((state.seasonTeamSets ?? []).length > 0 || !readOnly) && { key: "teams", Icon: Shield, title: "Season teams", text: "The teams for the season, the standings and trades.", onClick: () => go("teams") },
            ((state.playOfYear ?? []).length > 0 || !readOnly) && { key: "poty", Icon: Trophy, title: "Play of the Year", text: "The best plays in a bracket, voted on together.", onClick: () => go("poty") },
            state.players.length > 1 && { key: "h2h", Icon: Swords, title: "Settle it", text: "Any two players head to head: the record and the tale of the tape.", onClick: () => go("h2h") },
            state.games.length > 0 && { key: "hall", Icon: Crown, title: "Hall of fame", text: "Records, champions and the best games ever played.", onClick: () => go("hall") },
            state.games.some((g) => g.scoringEvents.length > 0) && { key: "how", Icon: Calculator, title: "How the numbers work", text: "The odds, runs and Two-Way explained on real moments.", onClick: () => go("how") },
          ]}
        />
        <PotyCard state={state} onOpen={() => go("poty")} />
        <TopPlays state={state} />
        {showHub(state) && <div id="offseason-hub" className="scroll-mt-24"><OffseasonHub state={state} onWrapped={() => go("wrapped")} onOpenPlayer={onOpenPlayer} onLive={() => go("live")} onOpenGame={open} /></div>}
        <GameAlerts />
        <div id="pickem-card" className="scroll-mt-24">
          <PickEmCard state={state} />
        </div>
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

interface Tile {
  key: string
  Icon: typeof Trophy
  title: string
  text: string
  onClick: () => void
}

// The rest of the Games section, each with a line on what it is, so nobody has to open one to find out.
function Explore({ tiles }: { tiles: (Tile | false)[] }) {
  const shown = tiles.filter((t): t is Tile => !!t)
  if (!shown.length) return null
  return (
    <section aria-labelledby="explore-h" className="flex flex-col gap-2">
      <h2 id="explore-h" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Explore
      </h2>
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {shown.map(({ key, Icon, title, text, onClick }) => (
          <li key={key}>
            <button type="button" onClick={onClick} className="flex h-full w-full flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-muted/40">
              <Icon aria-hidden className="size-5 text-primary" />
              <span className="font-semibold">{title}</span>
              <span className="text-xs text-muted-foreground">{text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
