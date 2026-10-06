import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/EmptyState"
import { useState } from "react"
import { HeadlineReview } from "@/components/HeadlineReview"
import { PlayerLabels } from "@/components/PlayerLabels"
import { isOwnLine, labelName } from "@/lib/labels"
import { HIDDEN, useLabels } from "@/lib/labelsContext"
import { useReadOnly } from "@/lib/mode"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { BUILD_LABELS, EFFORT_LABELS, getPlayerPhysicalData, PHYSICAL_ROLE_LABELS, type PhysicalData } from "@/lib/balance"
import { uid } from "@/lib/format"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"
import { nativeSelect } from "./games/GameLog"

function ProfileEditor({
  phys,
  hasOverride,
  onSave,
  onCancel,
  onReset,
}: {
  phys: PhysicalData | undefined
  hasOverride: boolean
  onSave: (p: PhysicalData) => void
  onCancel: () => void
  onReset: () => void
}) {
  const [ft, setFt] = useState(phys ? Math.floor(phys.heightIn / 12) : 5)
  const [inches, setInches] = useState(phys ? phys.heightIn % 12 : 10)
  const [build, setBuild] = useState(phys?.build ?? 3)
  const [effort, setEffort] = useState(phys?.effort ?? 2)
  const [roles, setRoles] = useState<string[]>(phys?.roles ?? [])
  const [note, setNote] = useState(phys?.note ?? "")

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Height
          <span className="flex items-center gap-1">
            <Input type="number" min={3} max={8} className="w-16" value={ft} onChange={(e) => setFt(parseInt(e.target.value, 10) || 0)} /> ft
            <Input type="number" min={0} max={11} className="w-16" value={inches} onChange={(e) => setInches(parseInt(e.target.value, 10) || 0)} /> in
          </span>
        </label>
        <label className="flex flex-col gap-1">
          Build
          <select className={nativeSelect} value={build} onChange={(e) => setBuild(parseInt(e.target.value, 10))}>
            {Object.entries(BUILD_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Effort
          <select className={nativeSelect} value={effort} onChange={(e) => setEffort(parseInt(e.target.value, 10))}>
            {Object.entries(EFFORT_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          Note
          <Input value={note} placeholder="e.g. Lockdown defender on top opponent" onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {Object.entries(PHYSICAL_ROLE_LABELS).map(([key, label]) => (
          <label key={key} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={roles.includes(key)}
              onChange={(e) => setRoles(e.target.checked ? [...roles, key] : roles.filter((r) => r !== key))}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave({ heightIn: ft * 12 + inches, build, effort, roles, note: note.trim() })}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {hasOverride && (
          <Button size="sm" variant="ghost" onClick={onReset}>
            Reset to Default
          </Button>
        )}
      </div>
    </div>
  )
}

export function PlayersPage({
  state,
  update,
  onOpenPlayer,
}: {
  state: PooleanState
  update: Update
  onOpenPlayer: (id: string) => void
}) {
  const readOnly = useReadOnly()
  const [name, setName] = useState("")
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [labelFor, setLabelFor] = useState<string | null>(null)
  const { labels, restoreHidden } = useLabels()
  const hiddenCount = (labels[HIDDEN] ?? []).length

  const sorted = [...state.players].sort((a, b) => a.name.localeCompare(b.name))
  const visible =
    roleFilter.length === 0
      ? sorted
      : sorted.filter((p) => (getPlayerPhysicalData(state, p.id)?.roles || []).some((r) => roleFilter.includes(r)))
  const overrides = (state.playerPhysicalOverrides ?? {}) as Record<string, PhysicalData>

  function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    update((s) => ({ ...s, players: [...s.players, { id: uid("player"), name: trimmed }] }))
    setName("")
  }

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && (
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Add Player</CardTitle>
          <p className="text-sm text-muted-foreground">
            One roster for the whole league. You&apos;ll split players into two teams per game, since teams change each time.
          </p>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={addPlayer}>
            <Input required placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit">Add Player</Button>
          </form>
        </CardContent>
      </Card>
      )}

      {!readOnly && <HeadlineReview state={state} />}
      {!readOnly && hiddenCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {hiddenCount} headline{hiddenCount === 1 ? "" : "s"} removed.{" "}
          <button type="button" className="font-medium text-accent hover:underline" onClick={restoreHidden}>
            Bring them back
          </button>
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Roster ({state.players.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(PHYSICAL_ROLE_LABELS).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={roleFilter.includes(key) ? "default" : "outline"}
                onClick={() => setRoleFilter(roleFilter.includes(key) ? roleFilter.filter((r) => r !== key) : [...roleFilter, key])}
              >
                {label}
              </Button>
            ))}
          </div>
          {state.players.length === 0 ? (
            <EmptyState title="No players yet" hint="Add your first player above to get started." />
          ) : visible.length === 0 ? (
            <EmptyState title="No players with that role" hint="Pick a different role filter to see more players." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map((p) => {
                const phys = getPlayerPhysicalData(state, p.id)
                const note = phys?.effort !== undefined ? `Effort: ${EFFORT_LABELS[phys.effort]}${phys.note ? ` (${phys.note})` : ""}` : phys?.note
                const build = phys ? BUILD_LABELS[phys.build] : null
                return (
                  <div key={p.id} className={`flex flex-col gap-3 ${editing === p.id ? "sm:col-span-2" : ""}`}>
                    <div className="tile flex flex-col gap-3 rounded-xl border p-3">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar id={p.id} name={p.name} size="lg" />
                        <div className="min-w-0">
                          <button type="button" className="font-display block truncate text-left text-lg font-bold hover:underline" onClick={() => onOpenPlayer(p.id)}>
                            {p.name}
                          </button>
                          {phys && (
                            <div className="text-sm text-muted-foreground">
                              {Math.floor(phys.heightIn / 12)}&apos;{phys.heightIn % 12}&quot;{build ? ` - ${build}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      {(phys?.roles ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(phys?.roles ?? []).map((r) => (
                            <Badge key={r} variant="secondary">
                              {PHYSICAL_ROLE_LABELS[r]}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {!readOnly && (
                        <div className="flex items-center gap-1.5" role="group" aria-label={`Pronouns for ${p.name}`}>
                          <span className="text-xs text-muted-foreground">Headlines say</span>
                          {([["they", "They"], ["he", "He"], ["she", "She"]] as const).map(([v, label]) => {
                            const on = (p.pronouns ?? "they") === v
                            return (
                              <button
                                key={v}
                                type="button"
                                aria-pressed={on}
                                onClick={() => update((s) => ({ ...s, players: s.players.map((x) => (x.id === p.id ? { ...x, pronouns: v === "they" ? undefined : v } : x)) }))}
                                className={cn("min-h-8 rounded-lg border px-2.5 text-xs font-medium", on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {(labels[p.id] ?? []).filter((k) => !isOwnLine(k)).length > 0 && (
                        <div className="flex flex-wrap gap-1.5" aria-label="Labels">
                          {(labels[p.id] ?? []).filter((k) => !isOwnLine(k)).map((k) => (
                            <Badge key={k} className="bg-accent/15 text-accent">
                              {labelName(k)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {note && <p className="text-xs text-muted-foreground">{note}</p>}
                      {!readOnly && (
                      <div className="flex gap-2 border-t border-dashed pt-3">
                        <Button size="sm" variant="outline" onClick={() => setEditing(editing === p.id ? null : p.id)}>
                          {editing === p.id ? "Close" : "Edit Tags"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setLabelFor(labelFor === p.id ? null : p.id)}>
                          Labels
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto text-destructive"
                          onClick={() => {
                            if (!confirm(`Remove ${p.name} from the roster? Their recorded stats stay in past games.`)) return
                            update((s) => ({ ...s, players: s.players.filter((x) => x.id !== p.id) }))
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                      )}
                    </div>
                    {labelFor === p.id && !readOnly && <PlayerLabels playerId={p.id} onClose={() => setLabelFor(null)} />}
                    {editing === p.id && (
                      <ProfileEditor
                        key={p.id}
                        phys={phys}
                        hasOverride={!!overrides[p.id]}
                        onCancel={() => setEditing(null)}
                        onSave={(next) => {
                          update((s) => ({ ...s, playerPhysicalOverrides: { ...((s.playerPhysicalOverrides ?? {}) as object), [p.id]: next } }))
                          setEditing(null)
                        }}
                        onReset={() => {
                          update((s) => {
                            const rest = { ...((s.playerPhysicalOverrides ?? {}) as Record<string, PhysicalData>) }
                            delete rest[p.id]
                            return { ...s, playerPhysicalOverrides: rest }
                          })
                          setEditing(null)
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
