import { useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Cloud } from "@/lib/useCloud"
import type { PooleanState } from "@/lib/types"

const SYNC_LABEL: Record<Cloud["sync"], string> = {
  idle: "Up to date",
  saving: "Saving to the cloud",
  saved: "Saved to the cloud",
  error: "Could not save, will retry on the next change",
  conflict: "Newer data exists in the cloud",
}

// Header control for the shared data. Everyone else sees the stats read-only; an editor signs in here.
export function AccountMenu({ cloud, state }: { cloud: Cloud; state?: PooleanState }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (cloud.status !== "ready") return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(await cloud.signIn(email.trim(), password))
    setBusy(false)
    setPassword("")
  }

  return (
    <details className="relative">
      <summary className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer list-none gap-2 [&::-webkit-details-marker]:hidden`}>
        {cloud.admin && (
          <span
            aria-hidden
            className={`size-2 rounded-full ${cloud.sync === "error" || cloud.sync === "conflict" ? "bg-neg" : cloud.sync === "saving" ? "bg-gold" : "bg-pos"}`}
          />
        )}
        {cloud.admin ? "Editing" : "Editor sign-in"}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
        {cloud.admin ? (
          <div className="flex flex-col gap-3">
            <div>
              <div className="font-semibold">Signed in as an editor</div>
              <div className="break-all text-xs text-muted-foreground">{cloud.email}</div>
            </div>
            <div className="text-xs text-muted-foreground" aria-live="polite">
              {SYNC_LABEL[cloud.sync]}
              {cloud.syncMessage ? `: ${cloud.syncMessage}` : ""}
            </div>
            {state && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm("Replace the shared data in the cloud with this device's copy? Everyone who views the link will see it.")) void cloud.overwrite(state)
                }}
              >
                Publish this device&apos;s data
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => void cloud.signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <form className="flex flex-col gap-2" onSubmit={submit}>
            <div className="font-semibold">Editor sign-in</div>
            <p className="text-xs text-muted-foreground">Only the league editor needs this. Everyone else can just look around.</p>
            <Input type="email" required autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input type="password" required autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && (
              <p role="alert" className="text-xs text-neg">
                {error}
              </p>
            )}
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Signing in" : "Sign in"}
            </Button>
          </form>
        )}
      </div>
    </details>
  )
}
