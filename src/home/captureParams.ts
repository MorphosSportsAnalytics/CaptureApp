export type CaptureRouteParams = {
  athleteId?: string
  teamId?: string
  linkKind?: "team" | "dc" | "athlete"
  linkId?: string
  eventKind?: string
  eventTitle?: string
  sportArenaId?: string
  kitKind?: string
  opponentJerseyPrimary?: string
  recordedAtMs?: string
}

function firstString(raw: string | string[] | undefined): string | undefined {
  if (raw == null) return undefined
  const v = Array.isArray(raw) ? raw[0] : raw
  const trimmed = String(v ?? "").trim()
  return trimmed || undefined
}

export function serializeCaptureParams(params: CaptureRouteParams): Record<string, string> {
  const out: Record<string, string> = {}
  if (params.athleteId?.trim()) out.athleteId = params.athleteId.trim()
  if (params.teamId?.trim()) out.teamId = params.teamId.trim()
  if (params.linkKind) out.linkKind = params.linkKind
  if (params.linkId?.trim()) out.linkId = params.linkId.trim()
  if (params.eventKind?.trim()) out.eventKind = params.eventKind.trim()
  if (params.eventTitle?.trim()) out.eventTitle = params.eventTitle.trim()
  if (params.sportArenaId?.trim()) out.sportArenaId = params.sportArenaId.trim()
  if (params.kitKind?.trim()) out.kitKind = params.kitKind.trim()
  if (params.opponentJerseyPrimary?.trim()) out.opponentJerseyPrimary = params.opponentJerseyPrimary.trim()
  if (params.recordedAtMs?.trim()) out.recordedAtMs = params.recordedAtMs.trim()
  return out
}

export function parseCaptureParams(
  raw: Record<string, string | string[] | undefined>,
): CaptureRouteParams {
  const linkKindRaw = firstString(raw.linkKind)
  const linkKind =
    linkKindRaw === "team" || linkKindRaw === "dc" || linkKindRaw === "athlete" ? linkKindRaw : undefined
  const out: CaptureRouteParams = {}
  const athleteId = firstString(raw.athleteId)
  if (athleteId) out.athleteId = athleteId
  const teamId = firstString(raw.teamId)
  if (teamId) out.teamId = teamId
  if (linkKind) out.linkKind = linkKind
  const linkId = firstString(raw.linkId)
  if (linkId) out.linkId = linkId
  const eventKind = firstString(raw.eventKind)
  if (eventKind) out.eventKind = eventKind
  const eventTitle = firstString(raw.eventTitle)
  if (eventTitle) out.eventTitle = eventTitle
  const sportArenaId = firstString(raw.sportArenaId)
  if (sportArenaId) out.sportArenaId = sportArenaId
  const kitKind = firstString(raw.kitKind)
  if (kitKind) out.kitKind = kitKind
  const opponentJerseyPrimary = firstString(raw.opponentJerseyPrimary)
  if (opponentJerseyPrimary) out.opponentJerseyPrimary = opponentJerseyPrimary
  const recordedAtMs = firstString(raw.recordedAtMs)
  if (recordedAtMs) out.recordedAtMs = recordedAtMs
  return out
}

export function captureParamsHasUploadScope(params: CaptureRouteParams): boolean {
  return Boolean(params.athleteId?.trim() || params.teamId?.trim())
}

export function captureParamsHasLinkedEvent(params: CaptureRouteParams): boolean {
  return Boolean(params.linkKind && params.linkId?.trim())
}

export function recordedAtMsFromParams(params: CaptureRouteParams): number | null {
  const raw = params.recordedAtMs?.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? Math.floor(n) : null
}

export function mergeCaptureParams(
  primary: CaptureRouteParams,
  fallback: CaptureRouteParams,
): CaptureRouteParams {
  const out: CaptureRouteParams = { ...fallback }
  for (const key of Object.keys(primary) as (keyof CaptureRouteParams)[]) {
    const value = primary[key]
    if (value != null && String(value).trim()) {
      ;(out[key] as string) = value
    }
  }
  return out
}

/** Prefer a linked event from either source so tab-param loss cannot drop the calendar pick. */
export function resolveCaptureParams(
  route: CaptureRouteParams,
  intent: CaptureRouteParams | null,
): CaptureRouteParams {
  if (!intent) return route
  if (captureParamsHasLinkedEvent(route)) return mergeCaptureParams(route, intent)
  if (captureParamsHasLinkedEvent(intent)) return mergeCaptureParams(intent, route)
  return mergeCaptureParams(route, intent)
}

export function recordedAtMsFromIso(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const startMs = new Date(iso).getTime()
  return Number.isFinite(startMs) ? String(Math.floor(startMs)) : undefined
}

export function captureParamsFromAthleteScheduleEvent(
  ev: {
    id: string
    sourceType: "team" | "dc" | "athlete"
    sourceId?: string | null
    title: string
    eventKindLabel?: string | null
    startsAt: string | null
    sportArenaId?: string | null
  },
  athleteId: string,
  eventKind?: string,
): CaptureRouteParams {
  const startMs = recordedAtMsFromIso(ev.startsAt)
  return {
    athleteId,
    teamId: ev.sourceType === "team" && ev.sourceId?.trim() ? ev.sourceId.trim() : undefined,
    linkKind: ev.sourceType,
    linkId: ev.id,
    eventKind,
    eventTitle: ev.title.trim() || undefined,
    sportArenaId: ev.sportArenaId?.trim() || undefined,
    recordedAtMs: startMs,
  }
}

export function captureParamsFromTeamScheduleEvent(
  ev: {
    id: string
    title: string
    starts_at?: string | null
    event_kind?: string | null
    sport_arena_id?: string | null
    coach_kit_kind?: string | null
    opponent_jersey_primary?: string | null
  },
  teamId: string,
  eventKind?: string,
): CaptureRouteParams {
  return {
    teamId,
    linkKind: "team",
    linkId: ev.id,
    eventKind,
    eventTitle: ev.title.trim() || undefined,
    sportArenaId: ev.sport_arena_id?.trim() || undefined,
    kitKind: ev.coach_kit_kind?.trim() || undefined,
    opponentJerseyPrimary: ev.opponent_jersey_primary?.trim() || undefined,
    recordedAtMs: recordedAtMsFromIso(ev.starts_at ?? null),
  }
}
