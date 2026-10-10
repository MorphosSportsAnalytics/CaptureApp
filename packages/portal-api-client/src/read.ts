import type { PortalApiClientConfig } from "./fetch.js"
import { portalJson } from "./fetch.js"
import { PortalApiError } from "./errors.js"
import { RECOMMENDED_OUTPUT_PROFILE } from "@morphos/mobile-preprocess"

export type UploadLimitsResponse = {
  maxDurationSeconds: number
  /** False when the athlete, ward, or team has no live subscription, courtesy, or bypass. */
  hasSubscription: boolean
  recommendedOutputProfile: typeof RECOMMENDED_OUTPUT_PROFILE
  quotaPools: unknown[]
}

export type MyProfileRow = {
  id: string
  first_name?: string
  last_name?: string
  position?: string | null
  has_mugshot?: boolean | number
  has_action_shot?: boolean | number
  updated_at?: string | null
}

export type MyProfileResponse = {
  row: MyProfileRow | null
}

export type MyVideosResponse = {
  rows: Record<string, unknown>[]
  canSubmitVideos?: boolean
  canManageYoutubeFeed?: boolean
  uploadSubscriptionActive?: boolean
  athleteHasGuardian?: boolean
  policy?: Record<string, unknown>
}

export type VideoUploadAccess = {
  canSubmitVideos: boolean
  canManageYoutubeFeed: boolean
  uploadSubscriptionActive: boolean
  athleteHasGuardian: boolean
  /** True only when the API explicitly allows athlete self-upload. */
  canPickVideos: boolean
  /** Unsubscribed athlete (not guardian-managed) should open the website to subscribe. */
  subscribeOnWebsite: boolean
}

export function videoUploadAccessFromMyVideos(data: MyVideosResponse): VideoUploadAccess {
  const athleteHasGuardian = data.athleteHasGuardian === true
  const canManageYoutubeFeed = data.canManageYoutubeFeed !== false
  const uploadSubscriptionActive = data.uploadSubscriptionActive === true
  const canSubmitVideos = data.canSubmitVideos === true
  const canPickVideos = canSubmitVideos
  const subscribeOnWebsite = !canPickVideos && !athleteHasGuardian
  return {
    canSubmitVideos,
    canManageYoutubeFeed,
    uploadSubscriptionActive,
    athleteHasGuardian,
    canPickVideos,
    subscribeOnWebsite,
  }
}

export type NotificationsResponse = {
  notifications: Record<string, unknown>[]
}

export type StatProgressResponse = Record<string, unknown>

export type SportArenaOption = {
  id: string
  name: string
  latitude?: number | null
  longitude?: number | null
}

export function uploadLimitsHasSubscription(limits: Pick<UploadLimitsResponse, "maxDurationSeconds" | "hasSubscription">): boolean {
  return limits.hasSubscription === true && limits.maxDurationSeconds > 0
}

export async function getUploadLimits(
  cfg: PortalApiClientConfig,
  args: { athleteId?: string; teamId?: string } = {},
): Promise<UploadLimitsResponse> {
  const q = new URLSearchParams()
  if (args.athleteId?.trim()) q.set("athleteId", args.athleteId.trim())
  if (args.teamId?.trim()) q.set("teamId", args.teamId.trim())
  const suffix = q.size > 0 ? `?${q.toString()}` : ""
  const res = await portalJson<UploadLimitsResponse>(cfg, `/v1/portal/upload-limits${suffix}`)
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

export async function getMyProfile(cfg: PortalApiClientConfig): Promise<MyProfileResponse> {
  const res = await portalJson<MyProfileResponse>(cfg, "/v1/portal/my-profile")
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

export type MyShareInviteReferralCode = {
  code: string
  status: string
  label: string | null
}

export type MyShareInviteResponse = {
  peerInvite: { code: string; inviteUrl: string } | null
  referralCodes: MyShareInviteReferralCode[]
}

export function hasMyShareInviteContent(data: MyShareInviteResponse): boolean {
  return data.peerInvite != null || data.referralCodes.length > 0
}

export function primaryShareInviteQrUrl(
  data: MyShareInviteResponse,
  portalWebUrl: string,
): string | null {
  if (data.peerInvite?.inviteUrl) return data.peerInvite.inviteUrl
  const active = data.referralCodes.find((row) => row.status === "active")
  const code = active?.code ?? data.referralCodes[0]?.code
  if (!code) return null
  const base = portalWebUrl.trim().replace(/\/+$/, "")
  return `${base}/referral/${encodeURIComponent(code)}`
}

type DashboardShareInvitePayload = {
  peerInvite?: { code?: string; inviteUrl?: string } | null
  referralCodes?: Array<{ code?: string; status?: string; label?: string | null }> | null
}

export function myShareInviteFromDashboardPayload(
  payload: DashboardShareInvitePayload,
): MyShareInviteResponse {
  const peer = payload.peerInvite
  const peerInvite =
    peer?.code && peer.inviteUrl
      ? { code: String(peer.code), inviteUrl: String(peer.inviteUrl) }
      : null
  const referralCodes = (payload.referralCodes ?? [])
    .map((row) => ({
      code: row.code != null ? String(row.code) : "",
      status: row.status != null ? String(row.status) : "inactive",
      label: row.label != null ? String(row.label) : null,
    }))
    .filter((row) => row.code.length > 0)
  return { peerInvite, referralCodes }
}

export async function getMyShareInvite(cfg: PortalApiClientConfig): Promise<MyShareInviteResponse> {
  const res = await portalJson<MyShareInviteResponse>(cfg, "/v1/portal/my-share-invite")
  if (res.ok) return res.data
  if (res.status === 404) {
    const dash = await portalJson<DashboardShareInvitePayload>(cfg, "/v1/portal/dashboard")
    if (!dash.ok) {
      throw new PortalApiError(dash.status, dash.data as Record<string, unknown>, dash.error)
    }
    return myShareInviteFromDashboardPayload(dash.data)
  }
  throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
}

export async function getMyVideos(cfg: PortalApiClientConfig): Promise<MyVideosResponse> {
  const res = await portalJson<MyVideosResponse>(cfg, "/v1/portal/my-videos")
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

export async function getMyVideoUploadAccess(cfg: PortalApiClientConfig): Promise<VideoUploadAccess> {
  const data = await getMyVideos(cfg)
  return videoUploadAccessFromMyVideos(data)
}

export async function getVideoQuotas(cfg: PortalApiClientConfig): Promise<{ pools: unknown[]; retention?: unknown }> {
  const res = await portalJson<{ pools: unknown[]; retention?: unknown }>(cfg, "/v1/portal/video-quotas")
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

export async function getNotifications(
  cfg: PortalApiClientConfig,
  args: { unread?: boolean } = {},
): Promise<NotificationsResponse> {
  const suffix = args.unread ? "?unread=1" : ""
  const res = await portalJson<NotificationsResponse>(cfg, `/v1/portal/notifications${suffix}`)
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

export async function markNotificationsRead(
  cfg: PortalApiClientConfig,
  notificationIds: string[],
): Promise<void> {
  const ids = notificationIds.map((id) => id.trim()).filter(Boolean)
  if (ids.length === 0) return
  const res = await portalJson(cfg, "/v1/portal/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
}

export type NearestSportArenaResponse = {
  arena: SportArenaOption | null
  distanceMeters: number | null
}

function asCoord(raw: unknown): number | null {
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export async function getNearestSportArena(
  cfg: PortalApiClientConfig,
  args: { lat: number; lng: number },
): Promise<SportArenaOption | null> {
  const q = new URLSearchParams()
  q.set("lat", String(args.lat))
  q.set("lng", String(args.lng))
  const res = await portalJson<{
    arena?: { id?: unknown; name?: unknown; latitude?: unknown; longitude?: unknown } | null
    distance_meters?: unknown
  }>(cfg, `/v1/sport-arenas/nearest?${q.toString()}`)
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  const raw = res.data.arena
  const id = typeof raw?.id === "string" ? raw.id.trim() : ""
  if (!id) return null
  return {
    id,
    name: typeof raw?.name === "string" ? raw.name : "",
    latitude: asCoord(raw?.latitude),
    longitude: asCoord(raw?.longitude),
  }
}

export async function getStatProgress(
  cfg: PortalApiClientConfig,
  submissionId: string,
): Promise<StatProgressResponse> {
  const res = await portalJson<StatProgressResponse>(
    cfg,
    `/v1/portal/video-submissions/${encodeURIComponent(submissionId)}/stat-progress`,
  )
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

export async function getSportArenasForSubmit(
  cfg: PortalApiClientConfig,
  args: { teamId?: string; allRegions?: boolean } = {},
): Promise<SportArenaOption[]> {
  const q = new URLSearchParams()
  if (args.teamId?.trim()) q.set("teamId", args.teamId.trim())
  if (args.allRegions) q.set("allRegions", "1")
  const suffix = q.size > 0 ? `?${q.toString()}` : ""
  const res = await portalJson<{ arenas?: SportArenaOption[] }>(cfg, `/v1/sport-arenas/for-submit${suffix}`)
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data.arenas ?? []
}

export type LinkableUploadEvent = {
  kind: "team" | "dc" | "athlete"
  id: string
  title: string
  startsAt: string | null
  endsAt?: string | null
  eventKind: string | null
  sportArenaId: string | null
  coachKitKind: string | null
  opponentJerseyPrimary?: string | null
  teamId: string | null
  teamName: string | null
  dcId: string | null
}

export type CalendarEventSuggestion = LinkableUploadEvent & {
  matchReason?: string
  confidence?: "high" | "medium" | "low"
  score?: number
}

export type LinkableUploadEventsResponse = {
  events: LinkableUploadEvent[]
  suggestions: CalendarEventSuggestion[]
}

export async function getLinkableUploadEvents(
  cfg: PortalApiClientConfig,
  args: { athleteId?: string; anchorAt?: string; submissionId?: string } = {},
): Promise<LinkableUploadEventsResponse> {
  const q = new URLSearchParams()
  if (args.athleteId?.trim()) q.set("athleteId", args.athleteId.trim())
  if (args.anchorAt?.trim()) q.set("anchorAt", args.anchorAt.trim())
  if (args.submissionId?.trim()) q.set("submissionId", args.submissionId.trim())
  const suffix = q.size > 0 ? `?${q.toString()}` : ""
  const res = await portalJson<LinkableUploadEventsResponse>(
    cfg,
    `/v1/portal/video-upload/linkable-events${suffix}`,
  )
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return {
    events: Array.isArray(res.data.events) ? res.data.events : [],
    suggestions: Array.isArray(res.data.suggestions) ? res.data.suggestions : [],
  }
}

export type MyScheduleWard = {
  athleteId: string
  firstName: string
  lastName: string
  hasAffiliation: boolean
}

export type MyScheduleAffiliation = {
  visible?: boolean
  wards?: MyScheduleWard[]
  ownAthlete?: {
    athleteId: string
    firstName: string
    lastName: string
  } | null
}

export type AthleteScheduleEventRow = {
  id: string
  sourceType: "team" | "dc" | "athlete"
  sourceId: string
  sourceName: string
  athleteId: string
  athleteName: string
  title: string
  startsAt: string | null
  endsAt: string | null
  eventKindLabel: string
  status: string
  locationLabel: string | null
  athleteVideoCount: number
  sportArenaId?: string | null
}

export type MyScheduleEventsResponse = {
  events: AthleteScheduleEventRow[]
  filterOptions?: {
    teams: { id: string; name: string; athleteId: string }[]
    dcs: { id: string; name: string; athleteId: string }[]
  }
}

export type PortalAthleteRow = {
  id: string
  first_name?: string
  last_name?: string
  position?: string | null
  has_mugshot?: boolean | number
  has_action_shot?: boolean | number
  updated_at?: string | null
}

export type PortalAthletesResponse = {
  athletes: PortalAthleteRow[]
}

export type PortalLinkedAthleteBilling = {
  id: string
  name: string
  tier: string | null
  status: string | null
  subscriptionLive: boolean
}

export type PortalSubscriptionResponse = {
  billingContexts?: {
    athlete?: {
      athleteId: string
      athleteSub: { tier?: string | null; status?: string | null } | null
      billingManagedByGuardian: boolean
    }
    guardian?: {
      linkedAthletes: PortalLinkedAthleteBilling[]
    }
    coach?: {
      coachTeams: Record<string, unknown>[]
    }
  }
}

export type SubscribedTeamRow = {
  id: string
  name: string
  season_label?: string | null
  seasonLabel?: string | null
  seasonSlot?: "current" | "next" | null
  subscriptionActive?: boolean
  lifecycle?: string
  /** True when Support staff granted an active video-processing bypass for this team or coach. */
  bypassActive?: boolean
  /** True when an active courtesy quota window covers this team. */
  courtesyActive?: boolean
}

export type SubscribedTeamsResponse = {
  teams: SubscribedTeamRow[]
}

/**
 * Dashboard / Home team cards: current-season paid teams, plus Support bypass
 * or courtesy even when the team is not on the current season pointer.
 */
export function isDashboardEligibleCoachTeam(team: SubscribedTeamRow): boolean {
  if (!team.id?.trim()) return false
  if (team.lifecycle === "needs_subscription" || team.lifecycle === "browse_only") return false
  const live = team.subscriptionActive === true || team.lifecycle === "writable"
  if (!live) return false
  if (team.bypassActive === true || team.courtesyActive === true) return true
  return team.seasonSlot === "current"
}

export type TeamScheduleEventRow = {
  id: string
  team_id: string
  title: string
  starts_at: string | null
  ends_at: string | null
  event_kind: string
  status: string
  sport_arena_id: string | null
  coach_kit_kind: string | null
  opponent_jersey_primary: string | null
}

export type TeamEventsResponse = {
  events: TeamScheduleEventRow[]
}

/** Returns null when the caller lacks schedule hub access (403). */
export async function getMyScheduleAffiliation(
  cfg: PortalApiClientConfig,
): Promise<MyScheduleAffiliation | null> {
  const res = await portalJson<MyScheduleAffiliation>(cfg, "/v1/portal/my-schedule/affiliation")
  if (res.status === 403) return null
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

/** Returns null when the caller lacks schedule hub access (403). */
export async function getMyScheduleEvents(
  cfg: PortalApiClientConfig,
  args: { from: string; to: string; athleteId?: string },
): Promise<MyScheduleEventsResponse | null> {
  const from = args.from.trim()
  const to = args.to.trim()
  if (!from || !to) throw new Error("from and to are required")
  const q = new URLSearchParams({ from, to })
  const athleteId = args.athleteId?.trim()
  if (athleteId) q.set("athleteId", athleteId)
  const res = await portalJson<MyScheduleEventsResponse>(
    cfg,
    `/v1/portal/my-schedule/events?${q.toString()}`,
  )
  if (res.status === 403) return null
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return {
    events: Array.isArray(res.data.events) ? res.data.events : [],
    filterOptions: res.data.filterOptions,
  }
}

export async function getPortalAthletes(cfg: PortalApiClientConfig): Promise<PortalAthletesResponse> {
  const res = await portalJson<PortalAthletesResponse>(cfg, "/v1/portal/athletes")
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return { athletes: Array.isArray(res.data.athletes) ? res.data.athletes : [] }
}

export async function getPortalSubscription(cfg: PortalApiClientConfig): Promise<PortalSubscriptionResponse> {
  const res = await portalJson<PortalSubscriptionResponse>(cfg, "/v1/portal/subscription")
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

/** Returns null when the caller lacks coach lane access (403). */
export async function getSubscribedTeams(cfg: PortalApiClientConfig): Promise<SubscribedTeamsResponse | null> {
  const res = await portalJson<SubscribedTeamsResponse>(cfg, "/v1/portal/teams?bucket=subscribed")
  if (res.status === 403) return null
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return { teams: Array.isArray(res.data.teams) ? res.data.teams : [] }
}

/** Returns null when the caller lacks team access (403). */
export async function getTeamEvents(
  cfg: PortalApiClientConfig,
  teamId: string,
  args: { from: string; to: string },
): Promise<TeamEventsResponse | null> {
  const id = teamId.trim()
  if (!id) throw new Error("teamId is required")
  const from = args.from.trim()
  const to = args.to.trim()
  if (!from || !to) throw new Error("from and to are required")
  const q = new URLSearchParams({ from, to })
  const res = await portalJson<TeamEventsResponse>(
    cfg,
    `/v1/portal/teams/${encodeURIComponent(id)}/events?${q.toString()}`,
  )
  if (res.status === 403) return null
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return { events: Array.isArray(res.data.events) ? res.data.events : [] }
}
