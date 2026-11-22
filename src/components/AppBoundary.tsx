import { Component, type ReactNode } from "react"

// The last line of defense: if a page fails to load or crashes, a note with a way back instead of a blank screen. (Single panels have
// their own PanelBoundary; a page whose code is missing after a deploy reloads once first, see lazyPage.)
export class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error("The page failed", error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    const home = () => {
      location.hash = "#/games"
      location.reload()
    }
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 p-6">
        <h1 className="font-display text-2xl font-extrabold">This page did not load</h1>
        <p className="text-muted-foreground">It may be a weak connection, or the site was just updated. Your data is safe.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="h-10 rounded-lg bg-primary px-4 font-medium text-primary-foreground" onClick={() => location.reload()}>
            Try again
          </button>
          <button type="button" className="h-10 rounded-lg border px-4 font-medium" onClick={home}>
            Back to games
          </button>
        </div>
      </main>
    )
  }
}
