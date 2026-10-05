import { Download, History, LockKeyhole, PencilLine } from "lucide-react"
import { useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchVersion, getClient, listVersions, snapshotCurrent, type VersionInfo } from "@/lib/cloud"
import { formatDateDisplay } from "@/lib/format"
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
function downloadBackup(state: PooleanState) {
  const blob = new Blob([JSON.stringify(state)], { type: "application/json" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `poolean-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const when = (iso: string) => {
  const d = new Date(iso)
  return `${formatDateDisplay(iso.slice(0, 10))}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
}

export function AccountMenu({ cloud, state, inline = false, onRestore }: { cloud: Cloud; state?: PooleanState; inline?: boolean; onRestore?: (s: PooleanState) => void }) {
  const [versions, setVersions] = useState<VersionInfo[] | null>(null)
  const [histBusy, setHistBusy] = useState(false)
  const [histMsg, setHistMsg] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (cloud.status !== "ready") return null

  async function openVersions() {
    const c = getClient()
    if (!c) return
    setHistMsg("")
    setVersions(await listVersions(c))
  }

  async function restore(v: VersionInfo) {
    const c = getClient()
    if (!c || !onRestore) return
    if (!confirm(`Go back to the version from ${when(v.versionAt)} (${v.games} games)? The data as it is now is kept in this list so you can undo it.`)) return
    setHistBusy(true)
    setHistMsg("")
    try {
      if (!(await snapshotCurrent(c))) throw new Error("Could not keep the current version first, so nothing was changed.")
      const data = await fetchVersion(c, v.id)
      if (!data) throw new Error("That version could not be loaded.")
      onRestore(data)
      setVersions(null)
    } catch (e) {
      setHistMsg(e instanceof Error ? e.message : "Could not restore that version.")
    } finally {
      setHistBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(await cloud.signIn(email.trim(), password))
    setBusy(false)
    setPassword("")
  }

  const signInForm = (
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
  )

  // On a plain page (no dropdown room) the form is shown directly.
  if (inline && !cloud.admin) return <div className="w-full max-w-sm">{signInForm}</div>

  return (
    <details className="relative">
      <summary className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer list-none gap-2 [&::-webkit-details-marker]:hidden`}>
        {cloud.admin && (
          <span
            aria-hidden
            className={`size-2 rounded-full ${cloud.sync === "error" || cloud.sync === "conflict" ? "bg-neg" : cloud.sync === "saving" ? "bg-gold" : "bg-pos"}`}
          />
        )}
        {cloud.admin ? <PencilLine aria-hidden className="size-4" /> : <LockKeyhole aria-hidden className="size-4" />}
        <span className="max-sm:sr-only">{cloud.admin ? "Editing" : "Editor sign-in"}</span>
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
            {state && (
              <Button size="sm" variant="outline" onClick={() => downloadBackup(state)}>
                <Download aria-hidden /> Download a backup
              </Button>
            )}
            {onRestore && (
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="outline" onClick={() => void (versions ? setVersions(null) : openVersions())}>
                  <History aria-hidden /> {versions ? "Hide past versions" : "Past versions"}
                </Button>
                {versions && versions.length === 0 && <p className="text-xs text-muted-foreground">No past versions yet. They appear once the history is set up (see docs/cloud-setup.md) and you have saved a few changes.</p>}
                {versions && versions.length > 0 && (
                  <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {versions.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
                        <span>
                          {when(v.versionAt)}
                          <span className="block text-muted-foreground">{v.games} games, {v.players} players</span>
                        </span>
                        <Button size="sm" variant="outline" disabled={histBusy} onClick={() => void restore(v)}>
                          Restore
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {histMsg && (
                  <p role="alert" className="text-xs text-neg">
                    {histMsg}
                  </p>
                )}
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={() => void cloud.signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          signInForm
        )}
      </div>
    </details>
  )
}
