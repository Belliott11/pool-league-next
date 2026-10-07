import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import { setAppGames } from "@/lib/matchup"
import { AccountMenu } from "@/components/AccountMenu"
import { StoryPublisher } from "@/components/StoryPublisher"
import { SyncChip } from "@/components/SyncChip"
import { getClient } from "@/lib/cloud"
import { loadLabels, saveLabels, type LabelBook } from "@/lib/labelStore"
import { setPronouns } from "@/lib/pronouns"
import { APPROVED, HIDDEN, LabelsContext } from "@/lib/labelsContext"
import { lineKey, setApprovedLines, setHiddenLines, setLineNames, stripRetired } from "@/lib/labels"
import { WhoAmI, WhoPrompt } from "@/components/WhoAmI"
import { myPlayerId, useWho } from "@/lib/identity"
import { BottomNav } from "@/components/BottomNav"
import { ArrowLeft, Moon, Sun } from "lucide-react"
import { DEFAULT_VIEW, hashToView, sameView, viewToHash, type View } from "@/lib/nav"
import { ColorMenu } from "@/components/ColorMenu"
import { PageSkeleton } from "@/components/PageSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { installDataViz } from "@/lib/dataViz"
import { adoptScorekeeperScores, findLiveGame } from "@/lib/live"
import { useTabSwipe } from "@/lib/useSwipe"
import { ReadOnlyContext } from "@/lib/mode"
import { LiveMiniBar } from "@/pages/live/LiveMiniBar"
import { useCloud, type Cloud } from "@/lib/useCloud"
import { installStackTables } from "@/lib/stackTables"
import { loadToggles, saveToggles, type Toggles } from "@/lib/toggles"
import { importStateFromJson, loadState, saveState } from "@/lib/state"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"
import { GamesPage } from "@/pages/Games"
import { PlayersPage } from "@/pages/PlayersPage"

const ExportPage = lazy(() => import("@/pages/ExportPage").then((m) => ({ default: m.ExportPage })))
const PlayerDetailPage = lazy(() => import("@/pages/PlayerDetail").then((m) => ({ default: m.PlayerDetailPage })))
const LeaderboardPage = lazy(() => import("@/pages/Leaderboard").then((m) => ({ default: m.LeaderboardPage })))
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
            classic site (Export &rarr; Export All Data, or Save Backup) to see your real games here.
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

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))
  return (
    <Button
      size="sm"
      variant="outline"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        const next = !dark
        document.documentElement.classList.toggle("dark", next)
        try {
          localStorage.setItem("pooleanIntelTheme", next ? "dark" : "light")
        } catch {
          /* private mode: the choice just won't persist */
        }
        setDark(next)
      }}
    >
      {dark ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
      <span className="max-sm:sr-only">{dark ? "Light" : "Dark"}</span>
    </Button>
  )
}

// local: no cloud, this browser's own copy. viewer: the shared copy, read-only. admin: the editor,
// whose changes are saved to this browser and to the cloud.
type Mode = "local" | "viewer" | "admin"

function AppShell({ initial, mode, cloud }: { initial: PooleanState; mode: Mode; cloud?: Cloud }) {
  const readOnly = mode === "viewer"
  const [state, setState] = useState(initial)
  setAppGames(state.games)
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
    window.scrollTo(0, 0)
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
  const openPlayer = (id: string) => {
    setPlayerId(id)
    go({ tab: "player", sub: "", player: id })
  }
  useEffect(() => {
    if (view.player) setPlayerId(view.player)
    else if (me && view.tab !== "player") setPlayerId(me)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.player, me])
  const [toggles, setTogglesState] = useState<Toggles>(loadToggles)
  const setToggles = (t: Toggles) => {
    saveToggles(t)
    setTogglesState(t)
  }
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
    const next = fn(state)
    persist(next)
    setState(next)
  }

  return (
    <ReadOnlyContext.Provider value={readOnly}>
    <LabelsContext.Provider value={{ labels, setPlayerLabels, hideLine: (t) => setPlayerLabels(HIDDEN, (cur) => (cur.includes(t) ? cur : [...cur, t])), restoreHidden: () => setPlayerLabels(HIDDEN, () => []), reviewLine: (t, verdict) => { const k = lineKey(t); const drop = (cur: string[]) => cur.filter((x) => lineKey(x) !== k); setPlayerLabels(HIDDEN, (cur) => (verdict === "no" ? [...drop(cur), t] : drop(cur))); setPlayerLabels(APPROVED, (cur) => (verdict === "ok" ? [...drop(cur), t] : drop(cur))) } }}>
    {!readOnly && <StoryPublisher state={state} update={update} />}
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-24 sm:p-6 sm:pb-6">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className={`sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 bg-background/90 px-4 backdrop-blur transition-[padding] sm:-mx-6 sm:px-6 ${scrolled ? "py-1.5" : "py-3"}`}>
        <div className="flex min-w-0 items-center gap-1">
          {(view.sub !== "" || view.tab !== "games") && (
            <Button size="icon" variant="ghost" className="-ml-2 size-9 shrink-0" aria-label="Back" onClick={goBack}>
              <ArrowLeft />
            </Button>
          )}
          <h1 className={`font-display font-bold transition-[font-size] ${scrolled ? "text-lg" : "text-2xl"}`}>
            Poolean <span className="text-accent">Intel</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
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
          <ColorMenu />
          <ThemeToggle />
        </div>
      </div>
      <WhoPrompt state={state} />
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
      {mode === "admin" && cloud && cloud.loaded && !cloud.remote && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
          <span className="min-w-0 flex-1">Nothing is shared yet. Publish this data so friends can open the link and view it.</span>
          <Button size="sm" onClick={() => void cloud.overwrite(state)}>
            Publish to the cloud
          </Button>
        </div>
      )}
      {!liveOpen && findLiveGame(state) && (
        <LiveMiniBar
          state={state}
          onOpen={() => setSub("live")}
        />
      )}
      <main id="main" tabIndex={-1} className="outline-none">
      <Tabs className="min-w-0" value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="max-sm:hidden">
          <TabsTrigger value="games">Games</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="player">Player</TabsTrigger>
          {!readOnly && <TabsTrigger value="players">Players</TabsTrigger>}
          {!readOnly && <TabsTrigger value="export">Export</TabsTrigger>}
        </TabsList>
        <TabsContent value="games">
          <GamesPage
            state={state}
            update={update}
            sub={view.tab === "games" ? view.sub : ""}
            go={setSub}
            goBack={goBack}
            openRequest={openRequest}
            onOpenPlayer={openPlayer}
          />
        </TabsContent>
        <TabsContent value="leaderboard">
          <Suspense fallback={<PageSkeleton label="Loading leaderboard" />}>
            <LeaderboardPage
            state={state}
            toggles={toggles}
            setToggles={setToggles}
            onOpenPlayer={openPlayer}
          />
          </Suspense>
        </TabsContent>
        <TabsContent value="player">
          <Suspense fallback={<PageSkeleton label="Loading player" />}>
            <PlayerDetailPage state={state} toggles={toggles} playerId={playerId} onChangePlayer={(id) => {
              setPlayerId(id)
              go({ player: id }, true)
            }} />
          </Suspense>
        </TabsContent>
        {!readOnly && (
          <TabsContent value="players">
            <PlayersPage
              state={state}
              update={update}
              onOpenPlayer={openPlayer}
            />
          </TabsContent>
        )}
        {!readOnly && (
          <TabsContent value="export">
            <Suspense fallback={<PageSkeleton label="Loading export tools" />}>
              <ExportPage state={state} toggles={toggles} />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
      </main>
      <BottomNav tab={tab} onChange={setTab} editor={!readOnly} />
      <p className="text-xs text-muted-foreground">
        {readOnly ? "You are viewing the shared stats. Only the league editor can make changes." : "A subset of the full site, with more stats on the classic site."}
      </p>
    </div>
    </LabelsContext.Provider>
    </ReadOnlyContext.Provider>
  )
}

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

function App() {
  const cloud = useCloud()
  const [local, setLocal] = useState<PooleanState | null>(() => loadState())

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
