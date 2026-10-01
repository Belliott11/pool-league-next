import { Component, type ReactNode } from "react"

// One broken panel should show a note in its own slot, not blank the whole page.
export class PanelBoundary extends Component<{ title: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`Panel "${this.props.title}" failed to render`, error)
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {this.props.title} could not be shown. Its numbers are still on the classic site.
        </div>
      )
    }
    return this.props.children
  }
}
