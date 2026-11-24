import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { lazyPage } from "@/lib/lazyPage"
import { setAppGames } from "@/lib/matchup"
import { setPaceGames } from "@/lib/per"
import { AccountMenu } from "@/components/AccountMenu"
import { StoryPublisher } from "@/components/StoryPublisher"
import { PullToRefresh } from "@/components/PullToRefresh"
import { SyncChip } from "@/components/SyncChip"
import { getClient } from "@/lib/cloud"
import { loadLabels, saveLabels, type LabelBook } from "@/lib/labelStore"
import { setPronouns } from "@/lib/pronouns"
import { APPROVED, HIDDEN, LabelsContext } from "@/lib/labelsContext"
import { lineKey, setApprovedLines, setHiddenLines, setLineNames, stripRetired } from "@/lib/labels"
import { WhoAmI, WhoPrompt } from "@/components/WhoAmI"
import { Ticker } from "@/components/Ticker"
import { headlinesBehind, headlinesFormulaStale } from "@/lib/published"
import { readsBehind, readsFormulaStale } from "@/lib/writtenReads"
import { myPlayerId, useWho } from "@/lib/identity"
import { BottomNav } from "@/components/BottomNav"
import { SiteSearch } from "@/components/SiteSearch"
import { HomeScreenTip } from "@/components/HomeScreenTip"
import { ArrowLeft, Search } from "lucide-react"
import { DEFAULT_VIEW, hashToView, sameView, viewToHash, type View } from "@/lib/nav"
import { ColorMenu } from "@/components/ColorMenu"
import { setArt } from "@/lib/emptyArt"
import { FiltersMenu } from "@/components/FiltersMenu"
import { setFilmedGames, setFilters } from "@/lib/filters"
import { PageSkeleton } from "@/components/PageSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { installDataViz } from "@/lib/dataViz"
import { adoptScorekeeperScores, findLiveGame } from "@/lib/live"
import { isOpeningNight } from "@/lib/offseason"
import { syncWinnerFlags } from "@/lib/winner"
import { useTabSwipe } from "@/lib/useSwipe"
import { ReadOnlyContext, UpdateContext } from "@/lib/mode"
import { LiveMiniBar } from "@/pages/live/LiveMiniBar"
import { useCloud, type Cloud } from "@/lib/useCloud"
import { installStackTables } from "@/lib/stackTables"
import { loadStoredToggles, resolveToggles, storeToggles, type Toggles } from "@/lib/toggles"
import { importStateFromJson, loadState, saveState } from "@/lib/state"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"
import { GamesPage } from "@/pages/Games"

const PlayersPage = lazyPage(() => import("@/pages/PlayersPage").then((m) => ({ default: m.PlayersPage })))
const ExportPage = lazyPage(() => import("@/pages/ExportPage").then((m) => ({ default: m.ExportPage })))
const PlayerDetailPage = lazyPage(() => import("@/pages/PlayerDetail").then((m) => ({ default: m.PlayerDetailPage })))
const LeaderboardPage = lazyPage(() => import("@/pages/Leaderboard").then((m) => ({ default: m.LeaderboardPage })))
// Once the first screen is up, load the other tabs' code while the page is idle.
const preloadTabs = () => void Promise.all([import("@/pages/Leaderboard"), import("@/pages/PlayerDetail"), import("@/pages/ExportPage")])

function ImportScreen({ onImported }: { onImported: (state: PooleanState) => void }) {
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    try {
      const text = await file.text()
      onImported(importStateFromJson(text))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.")
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display">Import your data</CardTitle>
          <CardDescription>
            This is a separate, in-progress build of Poolean Intel. Import the JSON backup from the
            classic site (Export &rarr; Export All Data, or Save Backup) to see your old site games here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          <Button onClick={() => fileInput.current?.click()}>Choose backup file&hellip;</Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}


// local: no cloud, this browser's own copy. viewer: the shared copy, read-only. admin: the editor,
// whose changes are saved to this browser and to the cloud.
type Mode = "local" | "viewer" | "admin"

function AppShell({ initial, mode, cloud }: { initial: PooleanState; mode: Mode; cloud?: Cloud }) {
  const readOnly = mode === "viewer"
  const [state, setState] = useState(initial)
  // The header menus: opening one closes the others, and touching anywhere outside closes the open one.
  useEffect(() => {
    const open = () => [...document.querySelectorAll<HTMLDetailsElement>("[data-header-menus] details[data-menu][open]")]
    const onToggle = (e: Event) => {
      const t = e.target
      if (t instanceof HTMLDetailsElement && t.open && t.hasAttribute("data-menu")) open().forEach((d) => d !== t && (d.open = false))
    }
    const onDown = (e: Event) => open().forEach((d) => !d.contains(e.target as Node) && (d.open = false))
    document.addEventListener("toggle", onToggle, true)
    document.addEventListener("pointerdown", onDown)
    return () => {
      document.removeEventListener("toggle", onToggle, true)
      document.removeEventListener("pointerdown", onDown)
    }
  }, [])
  setArt(state) // stills for empty panels (see emptyArt.ts); cheap when the state has not changed
  setAppGames(state.games)
  setPaceGames(state.games)
  // Private player labels: editor only, and never part of the shared league data.
  const [labels, setLabelsState] = useState<LabelBook>({})
  const labelsRef = useRef(labels)
  labelsRef.current = labels
  useEffect(() => {
    if (readOnly) return
    let dead = false
    void loadLabels(getClient()).then((stored) => {
      if (dead) return
      // Labels an earlier version saved in the shared data are moved here and removed from it.
      const legacy = (state.playerLabels ?? {}) as LabelBook
      const { book: merged, changed } = stripRetired({ ...legacy, ...stored })
      setLabelsState(merged)
      if (changed) void saveLabels(getClient(), merged)
      if (Object.keys(legacy).length) {
        void saveLabels(getClient(), merged)
        update((s) => {
          const rest = { ...s }
          delete rest.playerLabels
          return rest
        })
      }
    })
    return () => {
      dead = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])
  setLineNames(state.players.map((p) => p.name))
  setPronouns(state.players)
  setHiddenLines(labels[HIDDEN] ?? [])
  setApprovedLines(labels[APPROVED] ?? [])
  const setPlayerLabels = (id: string, fn: (cur: string[]) => string[]) => {
    const book = { ...labelsRef.current }
    const next = fn(book[id] ?? [])
    if (next.length) book[id] = next
    else delete book[id]
    labelsRef.current = book
    setLabelsState(book)
    void saveLabels(getClient(), book)
  }
  // The editor's app watches for friends' baskets while a game is live and takes only those baskets in.
  const hasLive = !!findLiveGame(state)
  useEffect(() => {
    if (mode === "admin") cloud?.setWatchLive(hasLive)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLive, mode])
  useEffect(() => {
    const ext = cloud?.external
    if (mode !== "admin" || !ext) return
    // With nothing unsent, take the cloud's copy whole (a friend may have started or finished a game);
    // with edits in flight, only take friends' baskets so the editor's own changes are never overwritten.
    const idle = cloud.sync === "idle" || cloud.sync === "saved"
    setState((s) => {
      const next = idle ? ext.state : adoptScorekeeperScores(s, ext.state)
      if (next !== s) saveState(next)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud?.external])
  // A scorekeeper's basket asks for a fresh copy right away instead of waiting for the next poll.
  useEffect(() => {
    const on = () => void cloud?.refresh()
    window.addEventListener("poolean-refresh", on)
    return () => window.removeEventListener("poolean-refresh", on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Edits made offline last time: send them now that the app is open again.
  useEffect(() => {
    if (mode === "admin" && cloud?.recoverLocal) cloud.push(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // A viewer always shows the latest shared copy; it is never written to this browser's own storage.
  useEffect(() => {
    if (readOnly) setState(initial)
  }, [readOnly, initial])
  const persist = (next: PooleanState) => {
    if (readOnly) return
    saveState(next)
    if (mode === "admin") cloud?.push(next)
  }
  // Where we are, mirrored in the address bar. Every screen change is a history entry so the browser's Back
  // button (and the arrow in the header) steps through the app instead of leaving it.
  const [view, setView] = useState<View>(() => hashToView(location.hash) ?? DEFAULT_VIEW)
  const viewRef = useRef(view)
  const tab = view.tab
  // The Leaderboard and Player pages take a moment to build, so once opened they stay built (hidden) and coming back is instant.
  const visited = useRef(new Set<string>())
  visited.current.add(tab)
  // Kept pages are only hidden, so a clip playing on one would carry on out of sight: stop every video on a switch.
  useEffect(() => {
    document.querySelectorAll("video").forEach((v) => v.pause())
    document.querySelectorAll<HTMLIFrameElement>('iframe[src*="youtube"]').forEach((f) => f.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', "*"))
  }, [tab])
  useEffect(() => {
    history.scrollRestoration = "manual"
    history.replaceState({ n: history.state?.n ?? 0, y: 0 }, "", viewToHash(viewRef.current))
    const onPop = () => {
      const v = hashToView(location.hash) ?? DEFAULT_VIEW
      const y = history.state?.y ?? 0
      viewRef.current = v
      setView(v)
      // The page for that entry is drawn on the next frames; put the scroll back where it was.
      for (const ms of [0, 60, 200]) setTimeout(() => window.scrollTo(0, y), ms)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  const go = useCallback((next: Partial<View>, replace = false) => {
    const cur = viewRef.current
    const v = { ...cur, ...next }
    if (sameView(v, cur)) return
    const n = history.state?.n ?? 0
    history.replaceState({ ...history.state, n, y: window.scrollY }, "")
    if (replace) history.replaceState({ n, y: 0 }, "", viewToHash(v))
    else history.pushState({ n: n + 1, y: 0 }, "", viewToHash(v))
    viewRef.current = v
    setView(v)
    // Again on the next frames, once the new page is drawn: on a phone the first jump can land before the page grows and be undone.
    for (const ms of [0, 60, 200]) setTimeout(() => viewRef.current === v && window.scrollTo(0, 0), ms)
  }, [])
  // Back goes to the screen before, or up one level when this page was opened directly from a link.
  const goBack = useCallback(() => {
    if ((history.state?.n ?? 0) > 0) history.back()
    else go({ tab: "games", sub: "", player: null }, true)
  }, [go])
  const setTab = (t: string) => go({ tab: t, sub: "", player: t === "player" ? playerIdRef.current : null })
  const setSub = (sub: string, replace?: boolean) => go({ tab: "games", sub, player: null }, replace)
  const liveOpen = view.tab === "games" && view.sub === "live"
  // On a phone, swipe sideways to move between tabs (visitors only see three of them).
  useTabSwipe(tab, readOnly ? ["games", "leaderboard", "player"] : ["games", "leaderboard", "player", "players", "export"], setTab)
  useEffect(() => {
    const t = setTimeout(preloadTabs, 800)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => installStackTables(), [])
  useEffect(() => installDataViz(), [])
  // The header shrinks once the page is scrolled.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  // Opens on you when you have said who you are (see WhoAmI), otherwise on the first player.
  const who = useWho()
  const me = myPlayerId(who, state.players)
  const [playerId, setPlayerIdState] = useState<string | null>(view.player ?? me ?? initial.players[0]?.id ?? null)
  const playerIdRef = useRef(playerId)
  playerIdRef.current = playerId
  const setPlayerId = (id: string | null) => {
    playerIdRef.current = id
    setPlayerIdState(id)
  }
  const [searching, setSearching] = useState(false)
  const openPlayer = (id: string) => {
    setPlayerId(id)
    go({ tab: "player", sub: "", player: id })
  }
  useEffect(() => {
    if (view.player) setPlayerId(view.player)
    else if (me && view.tab !== "player") setPlayerId(me)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.player, me])
  // The outlier default depends on how many games are filmed (filters.ts), so it is set before the filters are worked out.
  setFilmedGames(state.games.filter((g) => !g.liveInProgress && g.scoringEvents.length > 0).length)
  const [storedToggles, setStoredToggles] = useState(loadStoredToggles)
  const toggles = resolveToggles(storedToggles)
  const setToggles = (t: Toggles) => setStoredToggles(storeToggles(t))
  // Every panel and stat reads the same filters (see filters.ts). They are set here, before anything below renders, and the pages are
  // handed a fresh copy of the data whenever one changes, so cards that remember their answer work it out again.
  setFilters({ imbalanced: toggles.imbalanced, outliers: toggles.outliers })
  const shown = useMemo(() => ({ ...state }), [state, toggles.imbalanced, toggles.outliers, toggles.pastSeasons])
  // The classic panels announce "open this player" through a window event.
  useEffect(() => {
    const onPlayer = (e: Event) => {
      openPlayer((e as CustomEvent<string>).detail)
    }
    window.addEventListener("legacy-open-player", onPlayer)
    return () => window.removeEventListener("legacy-open-player", onPlayer)
  }, [])
  // The classic panels' Watch and Jump buttons: open that game on the Games tab, at that moment if given.
  const [openRequest, setOpenRequest] = useState<{ id: string; time: number | null; n: number } | null>(null)
  useEffect(() => {
    const onGame = (e: Event) => {
      const d = (e as CustomEvent<string | { id: string; time: number | null }>).detail
      const id = typeof d === "string" ? d : d.id
      const time = typeof d === "string" ? null : d.time
      setOpenRequest({ id, time, n: Date.now() })
      setSub("game:" + id)
    }
    window.addEventListener("legacy-open-game", onGame)
    return () => window.removeEventListener("legacy-open-game", onGame)
  }, [])
  // The classic review/import tools edit their own copy of the data and announce it with an event;
  // pull that copy back into React state (and save it) so the whole app sees the change.
  useEffect(() => {
    const onChanged = async () => {
      const { getLegacyState } = await import("@/lib/legacy-core")
      if (readOnly) return
      const next = structuredClone(getLegacyState()) as PooleanState
      persist(next)
      setState(next)
    }
    window.addEventListener("legacy-state-changed", onChanged)
    return () => window.removeEventListener("legacy-state-changed", onChanged)
  }, [])
  const update: Update = (fn) => {
    if (readOnly) return
    // Every edit also corrects any winner flag that contradicts a game's score (see syncWinnerFlags).
    const next = syncWinnerFlags(fn(state))
    persist(next)
    setState(next)
  }
  // The editor's copy is corrected once on opening, so the fix reaches the shared data without needing another edit.
  useEffect(() => {
    if (mode !== "admin") return
    const fixed = syncWinnerFlags(state)
    if (fixed !== state) {
      persist(fixed)
      setState(fixed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ReadOnlyContext.Provider value={readOnly}>
    <UpdateContext.Provider value={readOnly ? null : update}>
    <LabelsContext.Provider value={{ labels, setPlayerLabels, hideLine: (t) => setPlayerLabels(HIDDEN, (cur) => (cur.includes(t) ? cur : [...cur, t])), restoreHidden: () => setPlayerLabels(HIDDEN, () => []), reviewLine: (t, verdict) => { const k = lineKey(t); const drop = (cur: string[]) => cur.filter((x) => lineKey(x) !== k); setPlayerLabels(HIDDEN, (cur) => (verdict === "no" ? [...drop(cur), t] : drop(cur))); setPlayerLabels(APPROVED, (cur) => (verdict === "ok" ? [...drop(cur), t] : drop(cur))) } }}>
    {!readOnly && <StoryPublisher state={state} update={update} />}
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-6">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div data-header-menus className={`sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 bg-background/90 px-4 backdrop-blur transition-[padding] sm:-mx-6 sm:px-6 ${scrolled ? "py-1.5" : "py-3"}`}>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {(view.sub !== "" || view.tab !== "games") && (
            <Button size="icon" variant="ghost" className="-ml-2 size-9 shrink-0" aria-label="Back" onClick={goBack}>
              <ArrowLeft />
            </Button>
          )}
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className={`mr-2 shrink-0 rounded-lg transition-[width,height] max-sm:hidden ${view.sub !== "" || view.tab !== "games" ? "max-sm:hidden" : ""} ${scrolled ? "size-6" : "size-7 sm:size-8"}`} />
          <h1 className={`min-w-0 truncate font-display font-extrabold uppercase whitespace-nowrap sm:tracking-wide transition-[font-size] ${scrolled ? "text-sm sm:text-lg" : "text-base sm:text-2xl"}`}>
            Poolean <span className="text-accent">Intel</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 max-sm:gap-1.5">
          {cloud && mode === "admin" && <SyncChip cloud={cloud} />}
          <WhoAmI state={state} />
          {cloud && (
            <AccountMenu
              cloud={cloud}
              state={state}
              onRestore={(next) => {
                persist(next)
                setState(next)
              }}
            />
          )}
          <FiltersMenu toggles={toggles} setToggles={setToggles} />
          <ColorMenu />
        </div>
      </div>
      <div aria-hidden className="lane-rope -mt-2" />
      {/* Not on a shared play or Wrapped: the visitor came for that. */}
      {readOnly && cloud && <SavedCopyNote cloud={cloud} />}
      {!/^(clip|wrapped)/.test(view.sub) && <WhoPrompt state={state} />}
      {/* One prompt at a time: the home screen tip waits until "Who are you?" has been answered or put off. */}
      {view.tab === "games" && view.sub === "" && who !== null && <HomeScreenTip />}
      {mode === "admin" && cloud && cloud.sync === "conflict" && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-neg bg-card p-3 text-sm">
          <span className="min-w-0 flex-1">The cloud has newer changes, maybe from another device. Your latest edit is not saved yet.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const r = await cloud.acceptRemote()
              if (r) {
                saveState(r.state)
                setState(r.state)
              }
            }}
          >
            Use the cloud version
          </Button>
          <Button size="sm" onClick={() => void cloud.overwrite(state)}>
            Overwrite the cloud with mine
          </Button>
        </div>
      )}
      {mode === "admin" && view.sub === "" && (Math.max(headlinesBehind(state), readsBehind(state)) > 0 || readsFormulaStale() || headlinesFormulaStale()) && (
        <p className="rounded-xl border border-gold bg-card p-3 text-sm">
          {Math.max(headlinesBehind(state), readsBehind(state)) > 0 && (
            <>{Math.max(headlinesBehind(state), readsBehind(state))} filmed {Math.max(headlinesBehind(state), readsBehind(state)) === 1 ? "game" : "games"} since the written reads and headlines were last rewritten. </>
          )}
          {(readsFormulaStale() || headlinesFormulaStale()) && <>A stat formula changed since they were written, so numbers in them may be off, and the written headlines are hidden until rewritten. </>}
          Ask Claude to "rerun the reads" and "rerun the headlines". Only you see this note.
        </p>
      )}
      {mode === "admin" && cloud && cloud.loaded && !cloud.remote && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
          <span className="min-w-0 flex-1">Nothing is shared yet. Publish this data so visitors can open the link and view it.</span>
          <Button size="sm" onClick={() => void cloud.overwrite(state)}>
            Publish to the cloud
          </Button>
        </div>
      )}
      {!liveOpen && findLiveGame(state) && !(isOpeningNight(state) && view.tab === "games" && view.sub === "") && (
        <LiveMiniBar
          state={state}
          onOpen={() => setSub("live")}
        />
      )}
      {view.sub === "" && <Ticker state={shown} />}
      {cloud && <PullToRefresh onRefresh={cloud.refresh} />}
      <main id="main" tabIndex={-1} className="outline-none">
      <Tabs className="min-w-0" value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="max-sm:hidden">
          <TabsTrigger value="games">Games</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="player">Player</TabsTrigger>
          {!readOnly && <TabsTrigger value="players">Players</TabsTrigger>}
          {!readOnly && <TabsTrigger value="export">Export</TabsTrigger>}
          <button type="button" onClick={() => setSearching(true)} className="ml-1 flex items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground">
            <Search aria-hidden className="size-4" /> Search <kbd className="rounded border px-1 text-[10px]">{/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl K"}</kbd>
          </button>
        </TabsList>
        <TabsContent value="games">
          <GamesPage
            state={shown}
            pastSeasons={toggles.pastSeasons}
            update={update}
            sub={view.tab === "games" ? view.sub : ""}
            go={setSub}
            goBack={goBack}
            openRequest={openRequest}
            onOpenPlayer={openPlayer}
          />
        </TabsContent>
        <TabsContent value="leaderboard" keepMounted>
          {visited.current.has("leaderboard") && <Frozen active={tab === "leaderboard"} keys={[shown, toggles]}>
          <Suspense fallback={<PageSkeleton label="Loading leaderboard" />}>
            <LeaderboardPage
            state={shown}
            toggles={toggles}
            setToggles={setToggles}
            onOpenPlayer={openPlayer}
          />
          </Suspense>
          </Frozen>}
        </TabsContent>
        <TabsContent value="player" keepMounted>
          {visited.current.has("player") && <Frozen active={tab === "player"} keys={[shown, toggles, playerId]}>
          <Suspense fallback={<PageSkeleton label="Loading player" />}>
            <PlayerDetailPage state={shown} toggles={toggles} setToggles={setToggles} playerId={playerId} update={update} onChangePlayer={(id) => {
              setPlayerId(id)
              go({ player: id }, true)
            }} />
          </Suspense>
          </Frozen>}
        </TabsContent>
        {!readOnly && (
          <TabsContent value="players">
            <Suspense fallback={<PageSkeleton label="Loading players" />}>
              <PlayersPage
                state={state}
                update={update}
                onOpenPlayer={openPlayer}
              />
            </Suspense>
          </TabsContent>
        )}
        {!readOnly && (
          <TabsContent value="export">
            <Suspense fallback={<PageSkeleton label="Loading export tools" />}>
              <ExportPage state={state} toggles={toggles} update={update} />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
      </main>
      <BottomNav tab={tab} onChange={setTab} onSearch={() => setSearching(true)} editor={!readOnly} />
      <SiteSearch state={state} open={searching} onOpenChange={setSearching} go={go} openPlayer={openPlayer} readOnly={readOnly} />
      <p className="text-xs text-muted-foreground">
        {readOnly ? "You are viewing the shared stats. Only the league editor can make changes." : "A subset of the full site, with more stats on the classic site."}
      </p>
    </div>
    </LabelsContext.Provider>
    </UpdateContext.Provider>
    </ReadOnlyContext.Provider>
  )
}

// A page that is kept built while hidden. It skips every update while hidden, so it costs nothing while the editor logs a game or
// the data refreshes, and when shown it only rebuilds if the data it reads (`keys`) changed since it was last built. The callbacks
// passed to these pages only call setters, so an older copy of them still works.
const Frozen = memo(
  function Frozen({ children }: { active: boolean; keys: unknown[]; children: ReactNode }) {
    return <>{children}</>
  },
  (prev, next) => !next.active || (prev.active && prev.keys.every((k, i) => k === next.keys[i])),
)

// Shown to a visitor when the cloud is set up but nothing has been published yet (or it cannot be reached).
function NoSharedData({ cloud }: { cloud: Cloud }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display">{cloud.error ? "Can't load the stats" : "Nothing shared yet"}</CardTitle>
          <CardDescription>
            {cloud.error
              ? "The shared data could not be reached. Check your connection and try again."
              : "The league editor has not published any stats yet. Check back soon."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {cloud.error && (
            <Button onClick={() => void cloud.refresh()}>Try again</Button>
          )}
          <AccountMenu cloud={cloud} inline />
        </CardContent>
      </Card>
    </div>
  )
}

// Shown while the stats on screen are this phone's saved copy: at once with no signal or when the fresh copy could not be loaded, and
// after a few seconds if it is only slow, so old numbers are never taken for current ones.
function SavedCopyNote({ cloud }: { cloud: Cloud }) {
  const [slow, setSlow] = useState(false)
  const asOf = cloud.savedAsOf
  useEffect(() => {
    if (!asOf) return setSlow(false)
    const t = setTimeout(() => setSlow(true), 3000)
    return () => clearTimeout(t)
  }, [asOf])
  if (!asOf) return null
  const offline = typeof navigator !== "undefined" && !navigator.onLine
  if (!offline && !cloud.error && !slow) return null
  const when = new Date(asOf).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  return (
    <p role="status" className="rounded-xl border border-dashed bg-card px-3 py-2 text-sm">
      {offline || cloud.error ? <>No connection. Showing the stats as of {when}; they update by themselves when the signal is back.</> : <>Showing the stats as of {when} while the latest load.</>}
    </p>
  )
}

function App() {
  const cloud = useCloud()
  const [local, setLocal] = useState<PooleanState | null>(() => loadState())

  // A visitor's phone with a saved copy opens on it at once (viewerCopy.ts); the fresh copy swaps in under the same page when it arrives.
  if (cloud.early && cloud.remote) return <AppShell key="viewer" initial={cloud.remote.state} mode="viewer" cloud={cloud} />
  if (cloud.status === "loading") {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <PageSkeleton label="Loading" />
      </div>
    )
  }
  // No cloud configured: this browser's own copy, as before.
  if (cloud.status === "off") return local ? <AppShell initial={local} mode="local" /> : <ImportScreen onImported={setLocal} />
  // Everyone without an editor account sees the shared copy, read-only, with no import step.
  if (!cloud.admin) {
    if (!cloud.loaded || !cloud.remote) return <NoSharedData cloud={cloud} />
    return <AppShell key="viewer" initial={cloud.remote.state} mode="viewer" cloud={cloud} />
  }
  // The editor works on the shared copy (or this device's own data the first time, to publish it).
  // (or this device's copy when it holds edits the cloud never received, which then get sent)
  const initial = (cloud.recoverLocal && local ? local : cloud.remote?.state) ?? local
  if (!initial) return <ImportScreen onImported={setLocal} />
  return <AppShell key="admin" initial={initial} mode="admin" cloud={cloud} />
}

export default App
