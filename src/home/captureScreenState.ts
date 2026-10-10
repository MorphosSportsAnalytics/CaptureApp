import type { EventLinkSelection } from "@/components/eventLinkSelection"
import { eventLinksEqual } from "@/components/eventLinkSelection"
import { applyMetadataPatch, type MetadataFormValues } from "@/components/metadataFormValues"
import { toSubmissionEventKind } from "@/lib/submissionEventKind"
import {
  parseCaptureParams,
  recordedAtMsFromParams,
  serializeCaptureParams,
  type CaptureRouteParams,
} from "./captureParams"

export function captureParamsKey(raw: Record<string, string | string[] | undefined>): string {
  return JSON.stringify(serializeCaptureParams(parseCaptureParams(raw)))
}

export function eventLinkFromParams(params: CaptureRouteParams): EventLinkSelection {
  if (!params.linkKind || !params.linkId) return { mode: "manual" }
  return {
    mode: "linked",
    kind: params.linkKind,
    id: params.linkId,
    eventKind: params.eventKind ? toSubmissionEventKind(params.eventKind) || params.eventKind : null,
    sportArenaId: params.sportArenaId ?? null,
  }
}

export function metadataFromParams(params: CaptureRouteParams): Partial<MetadataFormValues> {
  const patch: Partial<MetadataFormValues> = {}
  const kind = params.eventKind ? toSubmissionEventKind(params.eventKind) : ""
  if (kind) patch.eventKind = kind
  if (params.sportArenaId) patch.sportArenaId = params.sportArenaId
  return patch
}

export type CaptureSyncedFields = {
  athleteId: string | undefined
  teamId: string | undefined
  kitKind: string | undefined
  opponentJerseyPrimary: string | undefined
  eventLink: EventLinkSelection
  recordedAtMs: number | null
  meta: MetadataFormValues
}

/**
 * Apply Capture deep-link params onto screen state. Returns `current` when nothing
 * changed so callers can skip setState and avoid a React update-depth loop.
 */
export function applyCaptureRouteSync(
  current: CaptureSyncedFields,
  params: CaptureRouteParams,
): CaptureSyncedFields {
  const eventLinkNext = eventLinkFromParams(params)
  const next: CaptureSyncedFields = {
    athleteId: params.athleteId,
    teamId: params.teamId,
    kitKind: params.kitKind,
    opponentJerseyPrimary: params.opponentJerseyPrimary,
    eventLink: eventLinksEqual(current.eventLink, eventLinkNext) ? current.eventLink : eventLinkNext,
    recordedAtMs: recordedAtMsFromParams(params),
    meta: applyMetadataPatch(current.meta, metadataFromParams(params)),
  }
  if (
    next.athleteId === current.athleteId &&
    next.teamId === current.teamId &&
    next.kitKind === current.kitKind &&
    next.opponentJerseyPrimary === current.opponentJerseyPrimary &&
    next.eventLink === current.eventLink &&
    next.recordedAtMs === current.recordedAtMs &&
    next.meta === current.meta
  ) {
    return current
  }
  return next
}
