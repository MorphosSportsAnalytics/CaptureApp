import type {
  AthleteScheduleEventRow,
  MyProfileRow,
  MyScheduleAffiliation,
  PortalAthleteRow,
  PortalLinkedAthleteBilling,
  PortalSubscriptionResponse,
  SubscribedTeamRow,
  TeamScheduleEventRow,
} from "@morphos/portal-api-client"
import { athleteAvatarPhotoKind } from "@morphos/portal-api-client"
import {
  formatScheduleWhenLabel,
  homeCardEventWindowYmd,
  isEventHappeningNow,
  sortCardUploadEvents,
  upcomingCardEvents,
  type TimedScheduleEvent,
} from "./cardEvents"
import {
  captureParamsFromAthleteScheduleEvent,
  captureParamsFromTeamScheduleEvent,
  type CaptureRouteParams,
  serializeCaptureParams,
} from "./captureParams"
import {
  isBillingPlanDisplayedAsActive,
  isDashboardEligibleCoachTeam,
  isLinkedAthleteSubscriptionActive,
  isSelfAthleteSubscriptionActive,
} from "./subscriptionActive"
import { toSubmissionEventKind } from "@/lib/submissionEventKind"

export type HomeCardKind = "self" | "ward" | "team"

export type HomeUploadActionView = {
  id: string
  eventTitle: string
  eventKindKey: string
  whenLabel: string
  happeningNow: boolean
  isGeneric: boolean
  captureParams: CaptureRouteParams
}

export type HomeUpcomingEventView = {
  id: string
  title: string
  eventKindKey: string
  whenLabel: string
  captureParams: CaptureRouteParams
}

export type HomeCardPhoto = {
  athleteId: string
  kind: "action_shot" | "mugshot"
  updatedAt?: string | null
}

export type HomeCardViewModel = {
  id: string
  kind: HomeCardKind
  title: string
  subtitle?: string
  isSelf: boolean
  hasHappeningNow: boolean
  uploadActions: HomeUploadActionView[]
  initials: string
  positionLabel?: string
  photo?: HomeCardPhoto
  billingActive?: boolean
  scheduleAthleteId?: string
  scheduleTeamId?: string
  upcomingEvents: HomeUpcomingEventView[]
}

/** Friendly label for stored position codes (no snake_case in UX). */
export function formatAthletePositionLabel(position: unknown): string | null {
  if (position == null) return null
  const raw = String(position).trim()
  if (!raw) return null
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function athleteDisplayName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ")
}

function athleteInitials(first: string, last: string): string {
  const f = first.trim()[0] ?? "?"
  const l = last.trim()[0] ?? ""
  return `${f}${l}`.toUpperCase()
}

function resolvePhoto(
  athleteId: string,
  args: { hasActionShot?: boolean | number | null; hasMugshot?: boolean | number | null; updatedAt?: string | null },
): HomeCardPhoto | undefined {
  const kind = athleteAvatarPhotoKind({
    hasActionShot: args.hasActionShot,
    hasMugshot: args.hasMugshot,
  })
  if (!kind) return undefined
  return { athleteId, kind, updatedAt: args.updatedAt ?? null }
}

function captureParamsFromAthleteEvent(
  ev: AthleteScheduleEventRow,
  athleteId: string,
): CaptureRouteParams {
  return captureParamsFromAthleteScheduleEvent(
    ev,
    athleteId,
    toSubmissionEventKind(ev.eventKindLabel) || undefined,
  )
}

function captureParamsFromTeamEvent(ev: TeamScheduleEventRow, teamId: string): CaptureRouteParams {
  return captureParamsFromTeamScheduleEvent(
    ev,
    teamId,
    toSubmissionEventKind(ev.event_kind) || undefined,
  )
}

function uploadActionsFromTimedEvents<T extends TimedScheduleEvent & { eventKindKey: string }>(
  events: T[],
  toCaptureParams: (ev: T) => CaptureRouteParams,
  genericCaptureParams: CaptureRouteParams,
  now: Date,
  locale?: string,
): HomeUploadActionView[] {
  const sorted = sortCardUploadEvents(events, now)
  if (sorted.length === 0) {
    return [
      {
        id: "generic-upload",
        eventTitle: "",
        eventKindKey: "",
        whenLabel: "",
        happeningNow: false,
        isGeneric: true,
        captureParams: genericCaptureParams,
      },
    ]
  }
  return sorted.map((ev) => ({
    id: ev.id,
    eventTitle: ev.title,
    eventKindKey: ev.eventKindKey,
    whenLabel: formatScheduleWhenLabel(ev.startsAt, locale),
    happeningNow: isEventHappeningNow(ev, now),
    isGeneric: false,
    captureParams: toCaptureParams(ev),
  }))
}

function buildUpcomingFromAthleteEvents(
  events: AthleteScheduleEventRow[],
  athleteId: string,
  now: Date,
  locale?: string,
): HomeUpcomingEventView[] {
  const scoped = events.filter((ev) => ev.athleteId === athleteId)
  const timed = scoped.map((ev) => ({
    ...ev,
    eventKindKey: toSubmissionEventKind(ev.eventKindLabel) || "practice",
  }))
  return upcomingCardEvents(timed, now, 2, 5, locale).map((ev) => ({
    id: ev.id,
    title: ev.title,
    eventKindKey: ev.eventKindKey,
    whenLabel: ev.whenLabel,
    captureParams: captureParamsFromAthleteEvent(
      scoped.find((row) => row.id === ev.id)!,
      athleteId,
    ),
  }))
}

function buildPersonCard(args: {
  athleteId: string
  firstName: string
  lastName: string
  isSelf: boolean
  events: AthleteScheduleEventRow[]
  position?: string | null
  photo?: HomeCardPhoto
  billingActive?: boolean
  now: Date
  locale?: string
}): HomeCardViewModel {
  const scopedEvents = args.events.filter((ev) => ev.athleteId === args.athleteId)
  const timed = scopedEvents.map((ev) => ({
    ...ev,
    eventKindKey: toSubmissionEventKind(ev.eventKindLabel) || "practice",
  }))
  const uploadActions = uploadActionsFromTimedEvents(
    timed,
    (ev) => captureParamsFromAthleteEvent(ev, args.athleteId),
    { athleteId: args.athleteId },
    args.now,
    args.locale,
  )
  return {
    id: args.athleteId,
    kind: args.isSelf ? "self" : "ward",
    title: athleteDisplayName(args.firstName, args.lastName),
    isSelf: args.isSelf,
    hasHappeningNow: uploadActions.some((a) => a.happeningNow),
    uploadActions,
    initials: athleteInitials(args.firstName, args.lastName),
    positionLabel: formatAthletePositionLabel(args.position) ?? undefined,
    photo: args.photo,
    billingActive: args.billingActive,
    scheduleAthleteId: args.athleteId,
    upcomingEvents: buildUpcomingFromAthleteEvents(
      args.events,
      args.athleteId,
      args.now,
      args.locale,
    ),
  }
}

function buildTeamCard(args: {
  team: SubscribedTeamRow
  events: TeamScheduleEventRow[]
  now: Date
  locale?: string
}): HomeCardViewModel {
  const teamId = args.team.id.trim()
  const sorted = sortCardUploadEvents(
    args.events.map((ev) => ({
      id: ev.id,
      title: ev.title,
      startsAt: ev.starts_at,
      endsAt: ev.ends_at,
      status: ev.status,
    })),
    args.now,
  )
  const uploadActions: HomeUploadActionView[] =
    sorted.length === 0
      ? [
          {
            id: "generic-upload",
            eventTitle: "",
            eventKindKey: "",
            whenLabel: "",
            happeningNow: false,
            isGeneric: true,
            captureParams: { teamId },
          },
        ]
      : sorted.map((ev) => {
          const full = args.events.find((row) => row.id === ev.id)!
          return {
            id: ev.id,
            eventTitle: ev.title,
            eventKindKey: toSubmissionEventKind(full.event_kind) || "practice",
            whenLabel: formatScheduleWhenLabel(ev.startsAt, args.locale),
            happeningNow: isEventHappeningNow(ev, args.now),
            isGeneric: false,
            captureParams: captureParamsFromTeamEvent(full, teamId),
          }
        })

  const timedUpcoming = args.events
    .map((ev) => ({
      id: ev.id,
      title: ev.title,
      startsAt: ev.starts_at,
      endsAt: ev.ends_at,
      status: ev.status,
      eventKindKey: toSubmissionEventKind(ev.event_kind) || "practice",
    }))
    .filter((ev) => ev.startsAt != null)

  const upcomingEvents: HomeUpcomingEventView[] = upcomingCardEvents(
    timedUpcoming,
    args.now,
    2,
    5,
    args.locale,
  ).map((ev) => {
    const full = args.events.find((row) => row.id === ev.id)!
    return {
      id: ev.id,
      title: ev.title,
      eventKindKey: ev.eventKindKey,
      whenLabel: ev.whenLabel,
      captureParams: captureParamsFromTeamEvent(full, teamId),
    }
  })

  const seasonLabel = (args.team.seasonLabel ?? args.team.season_label ?? "").trim()
  return {
    id: teamId,
    kind: "team",
    title: args.team.name.trim() || "Team",
    subtitle: seasonLabel || undefined,
    isSelf: false,
    hasHappeningNow: uploadActions.some((a) => a.happeningNow),
    uploadActions,
    initials: (args.team.name.trim()[0] ?? "T").toUpperCase(),
    upcomingEvents,
    scheduleTeamId: teamId,
  }
}

function wardBillingById(linked: PortalLinkedAthleteBilling[]): Map<string, PortalLinkedAthleteBilling> {
  const map = new Map<string, PortalLinkedAthleteBilling>()
  for (const row of linked) map.set(row.id, row)
  return map
}

function photoFromAthleteRow(row: PortalAthleteRow): HomeCardPhoto | undefined {
  return resolvePhoto(String(row.id ?? "").trim(), {
    hasActionShot: row.has_action_shot,
    hasMugshot: row.has_mugshot,
    updatedAt: row.updated_at ?? null,
  })
}

function photoFromProfileRow(row: MyProfileRow): HomeCardPhoto | undefined {
  return resolvePhoto(String(row.id ?? "").trim(), {
    hasActionShot: row.has_action_shot,
    hasMugshot: row.has_mugshot,
    updatedAt: row.updated_at ?? null,
  })
}

export function buildHomeCards(args: {
  subscription: PortalSubscriptionResponse
  affiliation: MyScheduleAffiliation | null
  athletes: PortalAthleteRow[]
  myProfile: MyProfileRow | null
  scheduleEvents: AthleteScheduleEventRow[]
  subscribedTeams: SubscribedTeamRow[]
  teamEventsById: Record<string, TeamScheduleEventRow[]>
  now?: Date
  locale?: string
}): HomeCardViewModel[] {
  const now = args.now ?? new Date()
  const cards: HomeCardViewModel[] = []
  const billing = args.subscription.billingContexts
  const wardBilling = wardBillingById(billing?.guardian?.linkedAthletes ?? [])
  const hasGuardianLane = (billing?.guardian?.linkedAthletes?.length ?? 0) > 0

  const athleteCtx = billing?.athlete
  if (athleteCtx && isSelfAthleteSubscriptionActive(athleteCtx)) {
    const profile = args.myProfile
    const own = args.affiliation?.ownAthlete
    const firstName =
      profile?.first_name != null
        ? String(profile.first_name)
        : (own?.firstName ?? "")
    const lastName =
      profile?.last_name != null ? String(profile.last_name) : (own?.lastName ?? "")
    cards.push(
      buildPersonCard({
        athleteId: athleteCtx.athleteId,
        firstName,
        lastName,
        isSelf: true,
        events: args.scheduleEvents,
        position: profile?.position ?? null,
        photo: profile ? photoFromProfileRow(profile) : undefined,
        now,
        locale: args.locale,
      }),
    )
  }

  for (const row of args.athletes) {
    const athleteId = String(row.id ?? "").trim()
    if (!athleteId) continue
    const wardBill = wardBilling.get(athleteId)
    if (!wardBill || !isLinkedAthleteSubscriptionActive(wardBill)) continue
    if (athleteCtx?.athleteId === athleteId) continue
    const firstName = row.first_name != null ? String(row.first_name) : ""
    const lastName = row.last_name != null ? String(row.last_name) : ""
    const billingActive = hasGuardianLane
      ? isBillingPlanDisplayedAsActive(wardBill.status, wardBill.tier, wardBill.subscriptionLive)
      : undefined
    cards.push(
      buildPersonCard({
        athleteId,
        firstName,
        lastName,
        isSelf: false,
        events: args.scheduleEvents,
        position: row.position ?? null,
        photo: photoFromAthleteRow(row),
        billingActive,
        now,
        locale: args.locale,
      }),
    )
  }

  for (const team of args.subscribedTeams) {
    if (!isDashboardEligibleCoachTeam(team)) continue
    cards.push(
      buildTeamCard({
        team,
        events: args.teamEventsById[team.id] ?? [],
        now,
        locale: args.locale,
      }),
    )
  }

  const happening = cards.filter((c) => c.hasHappeningNow)
  const rest = cards.filter((c) => !c.hasHappeningNow)
  return [...happening, ...rest]
}

export function homeCardEventFetchWindow(now: Date = new Date()): { from: string; to: string } {
  return homeCardEventWindowYmd(now, 4, 2)
}

export function homeActionRouteParams(action: HomeUploadActionView): Record<string, string> {
  return serializeCaptureParams(action.captureParams)
}

export function homeUpcomingRouteParams(event: HomeUpcomingEventView): Record<string, string> {
  return serializeCaptureParams(event.captureParams)
}
