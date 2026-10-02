import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { BottomNav } from "@/components/BottomNav"
import { ColorMenu } from "@/components/ColorMenu"
import { PageSkeleton } from "@/components/PageSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
      {dark ? "Light" : "Dark"}
    </Button>
  )
}

function AppShell({ initial }: { initial: PooleanState }) {
  const [state, setState] = useState(initial)
  const [tab, setTab] = useState("games")
  useEffect(() => installStackTables(), [])
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
  const [playerId, setPlayerId] = useState<string | null>(initial.players[0]?.id ?? null)
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
      const next = structuredClone(getLegacyState()) as PooleanState
      saveState(next)
      setState(next)
    }
    window.addEventListener("legacy-state-changed", onChanged)
    return () => window.removeEventListener("legacy-state-changed", onChanged)
  }, [])
  const update: Update = (fn) => {
    const next = fn(state)
    saveState(next)
    setState(next)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-24 sm:p-6 sm:pb-6">
      <div className={`sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 bg-background/90 px-4 backdrop-blur transition-[padding] sm:-mx-6 sm:px-6 ${scrolled ? "py-1.5" : "py-3"}`}>
        <h1 className={`font-display font-bold transition-[font-size] ${scrolled ? "text-lg" : "text-2xl"}`}>
          Poolean <span className="text-accent">Intel</span>
        </h1>
        <div className="flex items-center gap-2">
          <ColorMenu />
          <ThemeToggle />
        </div>
      </div>
      <Tabs className="min-w-0" value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="max-sm:hidden">
          <TabsTrigger value="games">Games</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="player">Player</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>
        <TabsContent value="games">
          <GamesPage
            state={state}
            update={update}
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
        <TabsContent value="export">
          <Suspense fallback={<PageSkeleton label="Loading export tools" />}>
            <ExportPage state={state} toggles={toggles} />
          </Suspense>
        </TabsContent>
      </Tabs>
      <BottomNav tab={tab} onChange={setTab} />
      <p className="text-xs text-muted-foreground">
        A subset of the full site, with more stats on the classic site.
      </p>
    </div>
  )
}

function App() {
  const [state, setState] = useState<PooleanState | null>(() => loadState())

  if (!state) return <ImportScreen onImported={setState} />
  return <AppShell initial={state} />
}

export default App
