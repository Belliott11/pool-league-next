import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { setAppGames } from "@/lib/matchup"
import { AccountMenu } from "@/components/AccountMenu"
import { SyncChip } from "@/components/SyncChip"
import { WhoAmI, WhoPrompt } from "@/components/WhoAmI"
import { myPlayerId, useWho } from "@/lib/identity"
import { BottomNav } from "@/components/BottomNav"
import { Moon, Sun } from "lucide-react"
import { ColorMenu } from "@/components/ColorMenu"
import { PageSkeleton } from "@/components/PageSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { installDataViz } from "@/lib/dataViz"
import { findLiveGame } from "@/lib/live"
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
  const [tab, setTab] = useState("games")
  const [liveOpen, setLiveOpen] = useState(false)
  // On a phone, swipe sideways to move between tabs (visitors only see three of them).
  useTabSwipe(tab, readOnly ? ["games", "leaderboard", "player"] : ["games", "leaderboard", "player", "players", "export"], setTab)
  useEffect(() => installStackTables(), [])
  useEffect(() => installDataViz(), [])
  // The header shrinks once the page is scrolled, and a new tab always starts at the top.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])
  // Opens on you when you have said who you are (see WhoAmI), otherwise on the first player.
  const who = useWho()
  const me = myPlayerId(who, state.players)
  const [playerId, setPlayerId] = useState<string | null>(me ?? initial.players[0]?.id ?? null)
  useEffect(() => {
    if (me) setPlayerId(me)
  }, [me])
  const [toggles, setTogglesState] = useState<Toggles>(loadToggles)
  const setToggles = (t: Toggles) => {
    saveToggles(t)
    setTogglesState(t)
  }
  // Same deep link the classic site's Share button writes: #player=<id>.
  useEffect(() => {
    const m = location.hash.match(/^#player=(.+)$/)
    if (m) {
      setPlayerId(decodeURIComponent(m[1]))
      setTab("player")
    }
  }, [])
  // The classic panels announce "open this player" through a window event.
  useEffect(() => {
    const onPlayer = (e: Event) => {
      setPlayerId((e as CustomEvent<string>).detail)
      setTab("player")
    }
    window.addEventListener("legacy-open-player", onPlayer)
    return () => window.removeEventListener("legacy-open-player", onPlayer)
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
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-24 sm:p-6 sm:pb-6">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className={`sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 bg-background/90 px-4 backdrop-blur transition-[padding] sm:-mx-6 sm:px-6 ${scrolled ? "py-1.5" : "py-3"}`}>
        <h1 className={`font-display font-bold transition-[font-size] ${scrolled ? "text-lg" : "text-2xl"}`}>
          Poolean <span className="text-accent">Intel</span>
        </h1>
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
          onOpen={() => {
            setTab("games")
            setLiveOpen(true)
          }}
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
            liveOpen={liveOpen}
            setLiveOpen={setLiveOpen}
            onOpenPlayer={(id) => {
              setPlayerId(id)
              setTab("player")
            }}
          />
        </TabsContent>
        <TabsContent value="leaderboard">
          <Suspense fallback={<PageSkeleton label="Loading leaderboard" />}>
            <LeaderboardPage
            state={state}
            toggles={toggles}
            setToggles={setToggles}
            onOpenPlayer={(id) => {
              setPlayerId(id)
              setTab("player")
            }}
          />
          </Suspense>
        </TabsContent>
        <TabsContent value="player">
          <Suspense fallback={<PageSkeleton label="Loading player" />}>
            <PlayerDetailPage state={state} toggles={toggles} playerId={playerId} onChangePlayer={(id) => setPlayerId(id)} />
          </Suspense>
        </TabsContent>
        {!readOnly && (
          <TabsContent value="players">
            <PlayersPage
              state={state}
              update={update}
              onOpenPlayer={(id) => {
                setPlayerId(id)
                setTab("player")
              }}
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
