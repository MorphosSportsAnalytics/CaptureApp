import {
  getMyProfile,
  getMyScheduleAffiliation,
  getMyScheduleEvents,
  getMyShareInvite,
  getPortalAthletes,
  getPortalSubscription,
  getSubscribedTeams,
  getTeamEvents,
  type MyShareInviteResponse,
  type PortalApiClientConfig,
  type TeamScheduleEventRow,
} from "@morphos/portal-api-client"
import { buildHomeCards, homeCardEventFetchWindow, type HomeCardViewModel } from "./buildHomeCards"

export type HomeCardsLoadResult = {
  cards: HomeCardViewModel[]
  myProfileAthleteId?: string
  shareInvite: MyShareInviteResponse | null
}

export async function loadHomeCards(
  cfg: PortalApiClientConfig,
  locale?: string,
): Promise<HomeCardsLoadResult> {
  const { from, to } = homeCardEventFetchWindow()
  let shareInvite: MyShareInviteResponse | null = null

  const [subscription, affiliation, athletesResult, scheduleResult, teamsResult, profileResult] =
    await Promise.all([
      getPortalSubscription(cfg),
      getMyScheduleAffiliation(cfg),
      getPortalAthletes(cfg).catch(() => ({ athletes: [] })),
      getMyScheduleEvents(cfg, { from, to }),
      getSubscribedTeams(cfg),
      getMyProfile(cfg).catch(() => ({ row: null })),
    ])

  try {
    shareInvite = await getMyShareInvite(cfg)
  } catch {
    shareInvite = null
  }

  const scheduleEvents = scheduleResult?.events ?? []
  const subscribedTeams = teamsResult?.teams ?? []
  const eligibleTeams = subscribedTeams.filter((team) => team.id?.trim())

  const teamEventsEntries = await Promise.all(
    eligibleTeams.map(async (team) => {
      const data = await getTeamEvents(cfg, team.id, { from, to })
      return [team.id, data?.events ?? []] as const
    }),
  )
  const teamEventsById: Record<string, TeamScheduleEventRow[]> = {}
  for (const [teamId, events] of teamEventsEntries) {
    teamEventsById[teamId] = events
  }

  const cards = buildHomeCards({
    subscription,
    affiliation,
    athletes: athletesResult.athletes,
    myProfile: profileResult.row,
    scheduleEvents,
    subscribedTeams,
    teamEventsById,
    locale,
  })

  const myProfileAthleteId =
    typeof profileResult.row?.id === "string" ? profileResult.row.id : undefined

  return { cards, myProfileAthleteId, shareInvite }
}
