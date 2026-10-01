import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { importStateFromJson, loadState, saveState } from "@/lib/state"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"
import { GamesPage } from "@/pages/Games"
import { LeaderboardPage } from "@/pages/Leaderboard"
import { PlayerDetailPage } from "@/pages/PlayerDetail"

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

function AppShell({ initial }: { initial: PooleanState }) {
  const [state, setState] = useState(initial)
  const [tab, setTab] = useState("games")
  const [playerId, setPlayerId] = useState<string | null>(initial.players[0]?.id ?? null)
  const update: Update = (fn) => {
    const next = fn(state)
    saveState(next)
    setState(next)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <h1 className="font-display text-2xl font-bold">
        Poolean <span className="text-accent">Intel</span>
      </h1>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="games">Games</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="player">Player</TabsTrigger>
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
          <LeaderboardPage state={state} />
        </TabsContent>
        <TabsContent value="player">
          <PlayerDetailPage
            state={state}
            playerId={playerId}
            onChangePlayer={(id) => setPlayerId(id)}
          />
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        A subset of the full site &mdash; more stats on the classic site.
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
