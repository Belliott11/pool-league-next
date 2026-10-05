import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CONTEST_LEVELS, TAGGABLE_SHOT_TYPES, TURNOVER_TYPES, parseVideoTimeInput } from "@/lib/legacy-core"
import { playerName } from "@/lib/players"
import { addShot, addTagged, editShot, editTagged, timeToInput, type TagKind } from "@/lib/statEntry"
import type { Game, PooleanState, ScoringEvent, TurnoverEvent } from "@/lib/types"
import { Chip, Field, HalfCourt } from "./parts"

export type Edit = { kind: "shot"; ev: ScoringEvent } | { kind: TagKind; ev: TurnoverEvent }
export type Draft = { kind: "shot" | TagKind; edit?: Edit }
export type Apply = (fn: (g: Game) => Game) => void

interface Props {
  state: PooleanState
  game: Game
  draft: Draft
  // Current video time (already backed up by the lead), or null when there is no readable video.
  captureTime: () => number | null
  hasVideo: boolean
  onSave: Apply
  // again = true reopens a blank form of the same kind, for logging a run of events from film.
  onClose: (again?: boolean) => void
}

const TITLES = { shot: "Shot", tov: "Turnover", stl: "Steal", pf: "Foul" }

export function EventForm(props: Props) {
  const { state, game, draft, captureTime, hasVideo, onSave, onClose } = props
  const editing = draft.edit?.ev
  const [timeStr, setTimeStr] = useState(() => timeToInput(editing ? editing.videoTime : captureTime()))
  const time = parseVideoTimeInput(timeStr)
  const timeBad = timeStr.trim() !== "" && time === null

  const timeField = (
    <Field label="Time" hint={hasVideo ? "Captured from the video, backed up a few seconds. Edit if needed." : "No readable video. Enter the time as m:ss (optional)."}>
      <Input
        value={timeStr}
        onChange={(e) => setTimeStr(e.target.value)}
        inputMode="decimal"
        placeholder="m:ss"
        aria-label="Video time"
        aria-invalid={timeBad}
        className="h-11 w-28"
      />
      {hasVideo && (
        <Button type="button" variant="outline" className="h-11 px-3" onClick={() => setTimeStr(timeToInput(captureTime()))}>
          <Clock /> Use video time
        </Button>
      )}
    </Field>
  )

  const body =
    draft.kind === "shot" ? (
      <ShotFields state={state} game={game} edit={draft.edit?.kind === "shot" ? draft.edit.ev : undefined} time={time} timeBad={timeBad} timeField={timeField} onSave={onSave} onClose={onClose} />
    ) : (
      <TagFields state={state} game={game} kind={draft.kind} edit={draft.edit && draft.edit.kind !== "shot" ? draft.edit.ev : undefined} time={time} timeBad={timeBad} timeField={timeField} onSave={onSave} onClose={onClose} />
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">
          {editing ? "Edit" : "Add"} {TITLES[draft.kind]}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{body}</CardContent>
    </Card>
  )
}

interface FieldsProps {
  state: PooleanState
  game: Game
  time: number | null
  timeBad: boolean
  timeField: React.ReactNode
  onSave: Apply
  onClose: (again?: boolean) => void
}

function Actions({ canSave, label, onSave, onClose, again }: { canSave: boolean; label: string; onSave: (again?: boolean) => void; onClose: () => void; again?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button type="button" className="h-11 flex-1 text-base" disabled={!canSave} onClick={() => onSave()}>
          {label}
        </Button>
        <Button type="button" variant="outline" className="h-11 px-4" onClick={() => onClose()}>
          Cancel
        </Button>
      </div>
      {again && (
        <Button type="button" variant="outline" className="h-11 text-base" disabled={!canSave} onClick={() => onSave(true)}>
          {label} and log the next
        </Button>
      )}
    </div>
  )
}

// Remembers the last shot logged in each game, so a run of shots by the same player starts with their
// name, value and result already chosen.
const lastShot: Record<string, { scorerId: string; points: 1 | 2 | 3; made: boolean }> = {}

function teamsOf(game: Game, id: string | null) {
  const onA = id ? game.teamA.includes(id) : false
  const mine = id ? (onA ? game.teamA : game.teamB) : []
  const opps = id ? (onA ? game.teamB : game.teamA) : []
  return { mates: mine.filter((p) => p !== id), opps }
}

function ShotFields({ state, game, edit, time, timeBad, timeField, onSave, onClose }: FieldsProps & { edit?: ScoringEvent }) {
  const last = edit ? undefined : lastShot[game.id]
  const [scorerId, setScorerId] = useState<string | null>(edit?.scorerId ?? last?.scorerId ?? null)
  const [points, setPoints] = useState<1 | 2 | 3>(edit?.points ?? last?.points ?? 2)
  const [made, setMade] = useState(edit ? edit.made !== false : (last?.made ?? true))
  const [assistId, setAssistId] = useState<string | null>(edit?.assistId ?? null)
  const [passerId, setPasserId] = useState<string | null>(edit?.passerId ?? null)
  const [rebounderId, setRebounderId] = useState<string | null>(edit?.rebounderId ?? null)
  const [contesterIds, setContesterIds] = useState<string[]>(edit?.reboundContesterIds ?? [])
  const [noContest, setNoContest] = useState(edit?.reboundNoContest === true)
  // Contesters are the rebounder's opponents, so a different rebounder clears them.
  useEffect(() => {
    setContesterIds((c) => (rebounderId ? c.filter((id) => teamsOf(game, rebounderId).opps.includes(id)) : []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebounderId])
  const [blockerId, setBlockerId] = useState<string | null>(edit?.blockerId ?? null)
  const [defenderIds, setDefenderIds] = useState<string[]>(edit?.defenderIds ?? [])
  const [contestLevel, setContestLevel] = useState<ScoringEvent["contestLevel"]>(edit?.contestLevel ?? null)
  const [shotType, setShotType] = useState<string | null>(edit?.shotType ?? null)
  const [dunk, setDunk] = useState(edit?.dunk === true)
  const [loc, setLoc] = useState<{ x: number; y: number } | null>(edit?.shotLocation ?? null)
  const [oob, setOob] = useState(false)
  const name = (id: string) => playerName(state, id)
  const { mates, opps } = teamsOf(game, scorerId)
  const fg = points !== 1
  const lockedOob = !!edit?.turnoverEventId

  const pickScorer = (id: string) => {
    setScorerId(id)
    setAssistId(null)
    setPasserId(null)
    setRebounderId(null)
    setBlockerId(null)
    setDefenderIds([])
    setContestLevel(null)
  }
  const toggleDef = (id: string) => setDefenderIds((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))
  const one = (cur: string | null, set: (v: string | null) => void, id: string) => set(cur === id ? null : id)

  const save = (again?: boolean) => {
    if (!scorerId) return
    const common = { assistId, passerId, rebounderId, reboundContesterIds: contesterIds, reboundNoContest: noContest, blockerId, defenderIds, contestLevel, shotType, dunk, shotLocation: loc, videoTime: time }
    if (edit) onSave((g) => editShot(g, edit.id, common))
    else {
      onSave((g) => addShot(g, { scorerId, points, made, outOfBounds: oob, ...common }))
      lastShot[game.id] = { scorerId, points, made }
    }
    onClose(again)
  }

  return (
    <>
      {edit ? (
        <p className="text-sm text-muted-foreground">
          {name(edit.scorerId)}, {edit.points} pt {made ? "make" : "miss"}. Scorer, points and make or miss can't change here; delete and re-log to fix those.
        </p>
      ) : (
        <>
          <Field label="Scorer">
            {[game.teamA, game.teamB].map((team, i) => (
              <div key={i} className="flex w-full flex-wrap items-center gap-2">
                <span className="w-12 text-xs text-muted-foreground">Team {i ? "B" : "A"}</span>
                {team.map((id) => (
                  <Chip key={id} selected={scorerId === id} onClick={() => pickScorer(id)}>
                    {name(id)}
                  </Chip>
                ))}
              </div>
            ))}
          </Field>
          <Field label="Value">
            {([1, 2, 3] as const).map((p) => (
              <Chip key={p} selected={points === p} onClick={() => setPoints(p)}>
                {p === 1 ? "1 (free throw)" : `${p} pts`}
              </Chip>
            ))}
          </Field>
          <Field label="Result">
            <Chip selected={made} onClick={() => setMade(true)}>Made</Chip>
            <Chip selected={!made} onClick={() => setMade(false)}>Missed</Chip>
          </Field>
        </>
      )}

      {scorerId && (
        <>
          <Field label="Defender(s)" hint="Tag whoever was contesting. Pick two for a double team.">
            <Chip selected={defenderIds.length === 0} onClick={() => { setDefenderIds([]); setContestLevel(null) }}>No defender</Chip>
            {opps.map((id) => (
              <Chip key={id} selected={defenderIds.includes(id)} onClick={() => toggleDef(id)}>{name(id)}</Chip>
            ))}
          </Field>
          {defenderIds.length > 0 && (
            <Field label="Contest level">
              {CONTEST_LEVELS.map((c: { key: string; label: string }) => (
                <Chip key={c.key} selected={contestLevel === c.key} onClick={() => setContestLevel(contestLevel === c.key ? null : (c.key as ScoringEvent["contestLevel"]))}>
                  {c.label}
                </Chip>
              ))}
            </Field>
          )}
          {made ? (
            <Field label="Assisted by" hint="No assist counts as self-created.">
              <Chip selected={!assistId} onClick={() => setAssistId(null)}>No assist</Chip>
              {mates.map((id) => (
                <Chip key={id} selected={assistId === id} onClick={() => one(assistId, setAssistId, id)}>{name(id)}</Chip>
              ))}
            </Field>
          ) : (
            <>
              <Field label="Blocked by">
                <Chip selected={!blockerId} onClick={() => setBlockerId(null)}>No block</Chip>
                {opps.map((id) => (
                  <Chip key={id} selected={blockerId === id} onClick={() => one(blockerId, setBlockerId, id)}>{name(id)}</Chip>
                ))}
              </Field>
              {!edit && (
                <Field label="Where did it end up">
                  <Chip selected={!oob} onClick={() => setOob(false)}>Live ball</Chip>
                  <Chip selected={oob} onClick={() => { setOob(true); setRebounderId(null) }}>Out of bounds (turnover)</Chip>
                </Field>
              )}
              {lockedOob && <p className="text-xs text-muted-foreground">Marked out of bounds, so no rebounder. Delete and re-log to change that.</p>}
              {!oob && !lockedOob && (
                <Field label="Rebounded by">
                  <Chip selected={!rebounderId} onClick={() => setRebounderId(null)}>No rebound tracked</Chip>
                  <Chip selected={rebounderId === scorerId} onClick={() => one(rebounderId, setRebounderId, scorerId)}>{name(scorerId)} (self)</Chip>
                  {mates.map((id) => (
                    <Chip key={id} selected={rebounderId === id} onClick={() => one(rebounderId, setRebounderId, id)}>{name(id)}</Chip>
                  ))}
                  {opps.map((id) => (
                    <Chip key={id} selected={rebounderId === id} onClick={() => one(rebounderId, setRebounderId, id)}>{name(id)} (opp)</Chip>
                  ))}
                </Field>
              )}
              {!oob && !lockedOob && rebounderId && (
                <Field label="Contesting the rebound" hint="Who was matched up on the rebounder. Pick nobody contested if the rebound was free.">
                  <Chip selected={noContest} onClick={() => { setNoContest(!noContest); setContesterIds([]) }}>Nobody contested</Chip>
                  {teamsOf(game, rebounderId).opps.map((id) => (
                    <Chip
                      key={id}
                      selected={contesterIds.includes(id)}
                      onClick={() => {
                        setNoContest(false)
                        setContesterIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
                      }}
                    >
                      {name(id)}
                    </Chip>
                  ))}
                </Field>
              )}
              <Field label="Passed by" hint="Optional on a miss. Self-created means nobody passed to the shooter.">
                <Chip selected={passerId === null} onClick={() => setPasserId(null)}>Not set</Chip>
                <Chip selected={passerId === "none"} onClick={() => setPasserId("none")}>Self-created</Chip>
                {mates.map((id) => (
                  <Chip key={id} selected={passerId === id} onClick={() => one(passerId, setPasserId, id)}>{name(id)}</Chip>
                ))}
              </Field>
            </>
          )}
          {fg && (
            <>
              <Field label="Shot">
                <Chip selected={dunk} onClick={() => setDunk(!dunk)}>{dunk ? "Dunk" : "Not a dunk"}</Chip>
                {!dunk &&
                  TAGGABLE_SHOT_TYPES.map((t: { key: string; label: string }) => (
                    <Chip key={t.key} selected={shotType === t.key} onClick={() => setShotType(shotType === t.key ? null : t.key)}>
                      {t.label}
                    </Chip>
                  ))}
              </Field>
              <Field label="Location">
                <HalfCourt value={loc} onChange={setLoc} />
              </Field>
            </>
          )}
        </>
      )}
      {timeField}
      {timeBad && <p role="alert" className="text-sm text-neg">Time must look like 1:23 or 83.</p>}
      <Actions canSave={!!scorerId && !timeBad} label={edit ? "Save changes" : `Add ${made ? "make" : "miss"}`} onSave={save} onClose={() => onClose()} again={!edit} />
    </>
  )
}

function TagFields({ state, game, kind, edit, time, timeBad, timeField, onSave, onClose }: FieldsProps & { kind: TagKind; edit?: TurnoverEvent }) {
  const [playerId, setPlayerId] = useState<string | null>(edit?.playerId ?? null)
  const [opponentId, setOpponentId] = useState<string | null>(edit?.opponentId ?? null)
  const [type, setType] = useState<string | null>(edit?.turnoverType ?? null)
  const name = (id: string) => playerName(state, id)
  // A turnover born from a steal or an out-of-bounds miss keeps its players (the link defines them).
  const linked = kind === "tov" && !!(edit?.stealEventId || edit?.missEventId)
  const { opps } = teamsOf(game, playerId)
  const who = { tov: "Who turned it over", stl: "Who got the steal", pf: "Who committed the foul" }[kind]
  const other = { tov: "Who forced or recovered it", stl: "Who did they steal it from", pf: "Who was fouled" }[kind]
  const needOpp = kind === "stl"

  const save = (again?: boolean) => {
    if (!playerId) return
    if (edit) onSave((g) => editTagged(g, kind, edit.id, { playerId, opponentId, videoTime: time, ...(kind === "tov" ? { turnoverType: type } : {}) }))
    else onSave((g) => addTagged(g, kind, playerId, opponentId, time, type))
    onClose(again)
  }

  return (
    <>
      {linked ? (
        <p className="text-sm text-muted-foreground">
          {name(edit!.playerId)} turnover, linked to a {edit!.stealEventId ? "steal" : "missed shot out of bounds"}. Only the type and time can change here.
        </p>
      ) : (
        <>
          <Field label={who}>
            {[game.teamA, game.teamB].map((team, i) => (
              <div key={i} className="flex w-full flex-wrap items-center gap-2">
                <span className="w-12 text-xs text-muted-foreground">Team {i ? "B" : "A"}</span>
                {team.map((id) => (
                  <Chip key={id} selected={playerId === id} onClick={() => { setPlayerId(id); setOpponentId(null) }}>{name(id)}</Chip>
                ))}
              </div>
            ))}
          </Field>
          {playerId && (
            <Field label={other}>
              {!needOpp && <Chip selected={!opponentId} onClick={() => setOpponentId(null)}>No one tagged</Chip>}
              {opps.map((id) => (
                <Chip key={id} selected={opponentId === id} onClick={() => setOpponentId(opponentId === id && !needOpp ? null : id)}>{name(id)}</Chip>
              ))}
            </Field>
          )}
        </>
      )}
      {kind === "tov" && (
        <Field label="Turnover type" hint="Optional.">
          {TURNOVER_TYPES.map((t: { key: string; label: string }) => (
            <Chip key={t.key} selected={type === t.key} onClick={() => setType(type === t.key ? null : t.key)}>{t.label}</Chip>
          ))}
        </Field>
      )}
      {timeField}
      {timeBad && <p role="alert" className="text-sm text-neg">Time must look like 1:23 or 83.</p>}
      <Actions canSave={!!playerId && (!needOpp || !!opponentId) && !timeBad} label={edit ? "Save changes" : `Add ${TITLES[kind].toLowerCase()}`} onSave={save} onClose={() => onClose()} again={!edit} />
    </>
  )
}
