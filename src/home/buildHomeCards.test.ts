import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildHomeCards } from "./buildHomeCards.js"
import {
  isBillingPlanDisplayedAsActive,
  isDashboardEligibleCoachTeam,
  isLinkedAthleteSubscriptionActive,
  isSelfAthleteSubscriptionActive,
} from "./subscriptionActive.js"

describe("subscriptionActive", () => {
  it("treats subscriptionLive as active", () => {
    assert.equal(isBillingPlanDisplayedAsActive("canceled", "starter", true), true)
  })

  it("requires active status and tier otherwise", () => {
    assert.equal(isBillingPlanDisplayedAsActive("active", "starter"), true)
    assert.equal(isBillingPlanDisplayedAsActive("active", null), false)
  })

  it("hides self athlete when guardian-managed", () => {
    assert.equal(
      isSelfAthleteSubscriptionActive({
        billingManagedByGuardian: true,
        athleteSub: { tier: "starter", status: "active" },
      }),
      false,
    )
  })

  it("filters coach teams like the web dashboard", () => {
    assert.equal(
      isDashboardEligibleCoachTeam({
        id: "t1",
        name: "Team",
        seasonSlot: "current",
        subscriptionActive: true,
        lifecycle: "writable",
      }),
      true,
    )
    assert.equal(
      isDashboardEligibleCoachTeam({
        id: "t2",
        name: "Team",
        seasonSlot: "next",
        subscriptionActive: true,
      }),
      false,
    )
    assert.equal(
      isDashboardEligibleCoachTeam({
        id: "t-bypass",
        name: "Support team",
        seasonSlot: null,
        subscriptionActive: true,
        lifecycle: "writable",
        bypassActive: true,
      }),
      true,
    )
  })

  it("accepts linked ward billing rows", () => {
    assert.equal(
      isLinkedAthleteSubscriptionActive({
        id: "w1",
        name: "Ward",
        tier: "starter",
        status: "active",
        subscriptionLive: false,
      }),
      true,
    )
  })
})

describe("buildHomeCards", () => {
  const now = new Date(2026, 7, 25, 15, 0, 0)

  it("includes only subscribed athletes and teams", () => {
    const cards = buildHomeCards({
      subscription: {
        billingContexts: {
          athlete: {
            athleteId: "self-1",
            athleteSub: { tier: "starter", status: "active" },
            billingManagedByGuardian: false,
          },
          guardian: {
            linkedAthletes: [
              { id: "ward-paid", name: "Paid Ward", tier: "starter", status: "active", subscriptionLive: true },
              { id: "ward-unpaid", name: "Unpaid", tier: null, status: null, subscriptionLive: false },
            ],
          },
        },
      },
      affiliation: {
        visible: true,
        ownAthlete: { athleteId: "self-1", firstName: "Self", lastName: "Athlete" },
      },
      myProfile: {
        id: "self-1",
        first_name: "Self",
        last_name: "Athlete",
        position: "forward",
        has_action_shot: true,
        updated_at: "2026-08-01",
      },
      athletes: [
        {
          id: "ward-paid",
          first_name: "Paid",
          last_name: "Ward",
          position: "center",
          has_mugshot: true,
        },
      ],
      scheduleEvents: [],
      subscribedTeams: [
        {
          id: "team-1",
          name: "Current team",
          seasonSlot: "current",
          subscriptionActive: true,
          lifecycle: "writable",
        },
        {
          id: "team-bypass",
          name: "Support bypass team",
          seasonSlot: null,
          subscriptionActive: true,
          lifecycle: "writable",
          bypassActive: true,
        },
      ],
      teamEventsById: {},
      now,
    })
    assert.deepEqual(
      cards.map((c) => c.id).sort(),
      ["self-1", "team-1", "team-bypass", "ward-paid"].sort(),
    )
    const self = cards.find((c) => c.id === "self-1")
    assert.equal(self?.positionLabel, "Forward")
    assert.equal(self?.photo?.kind, "action_shot")
    const ward = cards.find((c) => c.id === "ward-paid")
    assert.equal(ward?.billingActive, true)
    assert.equal(ward?.positionLabel, "Center")
    const team = cards.find((c) => c.id === "team-1")
    assert.equal(team?.kind, "team")
    assert.equal(team?.title, "Current team")
    assert.equal(team?.scheduleTeamId, "team-1")
  })

  it("treats MySQL tinyint photo flags as present", () => {
    const cards = buildHomeCards({
      subscription: {
        billingContexts: {
          guardian: {
            linkedAthletes: [
              { id: "ward-1", name: "Ward", tier: "starter", status: "active", subscriptionLive: true },
            ],
          },
        },
      },
      affiliation: null,
      myProfile: null,
      athletes: [
        {
          id: "ward-1",
          first_name: "Jane",
          last_name: "Smith",
          has_action_shot: 1,
          has_mugshot: 0,
        },
      ],
      scheduleEvents: [],
      subscribedTeams: [],
      teamEventsById: {},
      now,
    })
    assert.equal(cards[0]?.photo?.kind, "action_shot")
  })

  it("puts cards with happening-now events first", () => {
    const cards = buildHomeCards({
      subscription: {
        billingContexts: {
          athlete: {
            athleteId: "self-1",
            athleteSub: { tier: "starter", status: "active" },
            billingManagedByGuardian: false,
          },
        },
      },
      affiliation: {
        visible: true,
        ownAthlete: { athleteId: "self-1", firstName: "Self", lastName: "Athlete" },
      },
      myProfile: null,
      athletes: [],
      scheduleEvents: [
        {
          id: "live",
          sourceType: "team",
          sourceId: "t1",
          sourceName: "Team",
          athleteId: "self-1",
          athleteName: "Self Athlete",
          title: "Live game",
          startsAt: new Date(2026, 7, 25, 14, 30, 0).toISOString(),
          endsAt: new Date(2026, 7, 25, 16, 30, 0).toISOString(),
          eventKindLabel: "Game",
          status: "scheduled",
          locationLabel: null,
          athleteVideoCount: 0,
        },
      ],
      subscribedTeams: [
        {
          id: "team-1",
          name: "Team",
          seasonSlot: "current",
          subscriptionActive: true,
          lifecycle: "writable",
        },
      ],
      teamEventsById: { "team-1": [] },
      now,
    })
    assert.equal(cards[0]?.id, "self-1")
    assert.equal(cards[0]?.hasHappeningNow, true)
    const action = cards[0]?.uploadActions[0]
    assert.equal(action?.captureParams.linkId, "live")
    assert.equal(action?.captureParams.linkKind, "team")
    assert.equal(action?.captureParams.teamId, "t1")
    assert.equal(action?.captureParams.eventTitle, "Live game")
  })
})
