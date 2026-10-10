import type { LinkableUploadEvent, TeamScheduleEventRow } from "@morphos/portal-api-client"
import { isCancelledEvent } from "@/home/cardEvents"

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Same window as PortalAPI `linkableEventWindowBounds`: 30 days back, 14 days forward. */
export function linkableEventWindowYmd(anchorMs?: number | null): { from: string; to: string } {
  const now = anchorMs != null && Number.isFinite(anchorMs) ? new Date(anchorMs) : new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 30)
  const to = new Date(now)
  to.setDate(to.getDate() + 14)
  return { from: localYmd(from), to: localYmd(to) }
}

export function teamEventToLinkable(ev: TeamScheduleEventRow, teamId: string): LinkableUploadEvent {
  return {
    kind: "team",
    id: ev.id,
    title: ev.title,
    startsAt: ev.starts_at,
    endsAt: ev.ends_at,
    eventKind: ev.event_kind,
    sportArenaId: ev.sport_arena_id,
    coachKitKind: ev.coach_kit_kind,
    opponentJerseyPrimary: ev.opponent_jersey_primary,
    teamId: ev.team_id?.trim() || teamId,
    teamName: null,
    dcId: null,
  }
}

export function linkableTeamEventsFromRows(
  events: TeamScheduleEventRow[],
  teamId: string,
): LinkableUploadEvent[] {
  return events
    .filter((ev) => ev.id?.trim() && !isCancelledEvent(ev.status))
    .map((ev) => teamEventToLinkable(ev, teamId))
}
