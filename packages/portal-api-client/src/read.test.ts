import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getLinkableUploadEvents,
  getMyProfile,
  getMyShareInvite,
  getMyScheduleAffiliation,
  getMyScheduleEvents,
  getMyVideoUploadAccess,
  hasMyShareInviteContent,
  myShareInviteFromDashboardPayload,
  primaryShareInviteQrUrl,
  getNearestSportArena,
  getNotifications,
  getPortalAthletes,
  getPortalSubscription,
  getSportArenasForSubmit,
  getSubscribedTeams,
  getTeamEvents,
  getUploadLimits,
  uploadLimitsHasSubscription,
  isDashboardEligibleCoachTeam,
  markNotificationsRead,
  videoUploadAccessFromMyVideos,
} from "./read.js"

async function withMissingAbortSignalTimeout(fn: () => Promise<void>): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(AbortSignal, "timeout")
  Object.defineProperty(AbortSignal, "timeout", {
    value: undefined,
    configurable: true,
    writable: true,
  })
  try {
    await fn()
  } finally {
    if (original) Object.defineProperty(AbortSignal, "timeout", original)
  }
}

describe("getLinkableUploadEvents", () => {
  it("calls linkable-events with athleteId and anchorAt", async () => {
    let url = ""
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      url = String(input)
      return new Response(
        JSON.stringify({
          events: [{ id: "e1", kind: "team", title: "Game", startsAt: null }],
          suggestions: [{ id: "e1", kind: "team", title: "Game", startsAt: null, score: 1000 }],
        }),
        { status: 200 },
      )
    }
    const data = await getLinkableUploadEvents(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      { athleteId: "ath-1", anchorAt: "2026-08-21T18:00:00.000Z" },
    )
    assert.match(url, /\/v1\/portal\/video-upload\/linkable-events\?/)
    assert.match(url, /athleteId=ath-1/)
    assert.match(url, /anchorAt=2026-08-21T18%3A00%3A00.000Z/)
    assert.equal(data.events[0]?.id, "e1")
    assert.equal(data.suggestions[0]?.score, 1000)
  })

  it("loads calendar events when AbortSignal.timeout is missing (Hermes)", async () => {
    await withMissingAbortSignalTimeout(async () => {
      const fetchImpl = async (): Promise<Response> =>
        new Response(JSON.stringify({ events: [], suggestions: [] }), { status: 200 })
      const data = await getLinkableUploadEvents(
        { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
        {},
      )
      assert.deepEqual(data.events, [])
      assert.deepEqual(data.suggestions, [])
    })
  })
})

describe("getUploadLimits", () => {
  it("forwards athleteId and teamId so duration follows the upload target", async () => {
    let url = ""
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      url = String(input)
      return new Response(
        JSON.stringify({
          maxDurationSeconds: 300,
          hasSubscription: true,
          recommendedOutputProfile: {},
          quotaPools: [],
        }),
        {
        status: 200,
      })
    }
    const data = await getUploadLimits(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      { athleteId: "ath-1", teamId: "team-9" },
    )
    assert.match(url, /\/v1\/portal\/upload-limits\?/)
    assert.match(url, /athleteId=ath-1/)
    assert.match(url, /teamId=team-9/)
    assert.equal(data.maxDurationSeconds, 300)
    assert.equal(data.hasSubscription, true)
  })

  it("treats a missing or zero-duration subscription as unreachable", () => {
    assert.equal(uploadLimitsHasSubscription({ maxDurationSeconds: 0, hasSubscription: false }), false)
    assert.equal(uploadLimitsHasSubscription({ maxDurationSeconds: 300, hasSubscription: false }), false)
    assert.equal(uploadLimitsHasSubscription({ maxDurationSeconds: 300, hasSubscription: true }), true)
  })
})

describe("getSportArenasForSubmit", () => {
  it("loads venues when AbortSignal.timeout is missing (Hermes)", async () => {
    await withMissingAbortSignalTimeout(async () => {
      const fetchImpl = async (): Promise<Response> =>
        new Response(JSON.stringify({ arenas: [{ id: "a1", name: "Rink" }] }), { status: 200 })
      const arenas = await getSportArenasForSubmit(
        { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
        {},
      )
      assert.equal(arenas[0]?.id, "a1")
    })
  })

  it("requests allRegions when expanding the venue list", async () => {
    let url = ""
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      url = String(input)
      return new Response(JSON.stringify({ arenas: [{ id: "a1", name: "Rink" }] }), { status: 200 })
    }
    const arenas = await getSportArenasForSubmit(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      { allRegions: true },
    )
    assert.match(url, /allRegions=1/)
    assert.equal(arenas[0]?.id, "a1")
  })
})

describe("getNearestSportArena", () => {
  it("requests nearest arena with lat and lng", async () => {
    let url = ""
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      url = String(input)
      return new Response(
        JSON.stringify({ arena: { id: "near", name: "Rink", latitude: 43.65, longitude: -79.38 }, distance_meters: 12 }),
        { status: 200 },
      )
    }
    const arena = await getNearestSportArena(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      { lat: 43.7, lng: -79.4 },
    )
    assert.match(url, /\/v1\/sport-arenas\/nearest\?/)
    assert.match(url, /lat=43.7/)
    assert.match(url, /lng=-79.4/)
    assert.equal(arena?.id, "near")
    assert.equal(arena?.latitude, 43.65)
  })

  it("returns null when the API has no geocoded arena", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ arena: null, distance_meters: null }), { status: 200 })
    const arena = await getNearestSportArena(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      { lat: 1, lng: 2 },
    )
    assert.equal(arena, null)
  })

  it("ignores arenas without an id", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ arena: { id: "  ", name: "X", latitude: 1, longitude: 1 } }), { status: 200 })
    const arena = await getNearestSportArena(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      { lat: 1, lng: 2 },
    )
    assert.equal(arena, null)
  })

  it("keeps only finite coordinates", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ arena: { id: "a1", name: "Rink", latitude: "nope", longitude: 12 } }), {
        status: 200,
      })
    const arena = await getNearestSportArena(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      { lat: 1, lng: 2 },
    )
    assert.equal(arena?.id, "a1")
    assert.equal(arena?.latitude, null)
    assert.equal(arena?.longitude, 12)
  })

  it("throws when nearest lookup fails", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    await assert.rejects(
      () =>
        getNearestSportArena({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl }, { lat: 1, lng: 2 }),
      /Unauthorized/,
    )
  })
})

describe("getNotifications", () => {
  it("requests unread notifications when asked", async () => {
    let url = ""
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      url = String(input)
      return new Response(JSON.stringify({ notifications: [{ id: "n1" }] }), { status: 200 })
    }
    const data = await getNotifications(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      { unread: true },
    )
    assert.match(url, /\/v1\/portal\/notifications\?unread=1/)
    assert.equal(data.notifications[0]?.id, "n1")
  })

  it("lists all notifications when unread is not requested", async () => {
    let url = ""
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      url = String(input)
      return new Response(JSON.stringify({ notifications: [] }), { status: 200 })
    }
    await getNotifications({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl })
    assert.match(url, /\/v1\/portal\/notifications$/)
  })

  it("throws when listing notifications fails", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    await assert.rejects(
      () => getNotifications({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl }),
      /Unauthorized/,
    )
  })
})

describe("markNotificationsRead", () => {
  it("posts { ids } so PortalAPI persists shared read state", async () => {
    let body = ""
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      body = String(init?.body ?? "")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    await markNotificationsRead({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl }, [" n1 ", "n2"])
    assert.deepEqual(JSON.parse(body), { ids: ["n1", "n2"] })
  })

  it("does not call the API when there are no ids", async () => {
    let called = false
    const fetchImpl = async (): Promise<Response> => {
      called = true
      return new Response("{}", { status: 200 })
    }
    await markNotificationsRead({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl }, ["", "  "])
    assert.equal(called, false)
  })

  it("throws when marking read fails", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: "ids required" }), { status: 400 })
    await assert.rejects(
      () => markNotificationsRead({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl }, ["n1"]),
      /ids required/,
    )
  })
})

describe("videoUploadAccessFromMyVideos", () => {
  it("allows pick only when canSubmitVideos is true", () => {
    const allowed = videoUploadAccessFromMyVideos({
      rows: [],
      canSubmitVideos: true,
      uploadSubscriptionActive: true,
      canManageYoutubeFeed: true,
      athleteHasGuardian: false,
    })
    assert.equal(allowed.canPickVideos, true)
    assert.equal(allowed.subscribeOnWebsite, false)

    const missing = videoUploadAccessFromMyVideos({ rows: [] })
    assert.equal(missing.canPickVideos, false)
    assert.equal(missing.subscribeOnWebsite, true)
  })

  it("sends unsubscribed athletes to the website, not guardian-managed ones", () => {
    const unsubscribed = videoUploadAccessFromMyVideos({
      rows: [],
      canSubmitVideos: false,
      uploadSubscriptionActive: false,
      athleteHasGuardian: false,
    })
    assert.equal(unsubscribed.canPickVideos, false)
    assert.equal(unsubscribed.subscribeOnWebsite, true)

    const guardian = videoUploadAccessFromMyVideos({
      rows: [],
      canSubmitVideos: false,
      uploadSubscriptionActive: false,
      athleteHasGuardian: true,
      canManageYoutubeFeed: false,
    })
    assert.equal(guardian.canPickVideos, false)
    assert.equal(guardian.subscribeOnWebsite, false)
    assert.equal(guardian.athleteHasGuardian, true)
  })
})

describe("getMyVideoUploadAccess", () => {
  it("maps my-videos policy fields", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          rows: [],
          canSubmitVideos: false,
          uploadSubscriptionActive: false,
          athleteHasGuardian: false,
          canManageYoutubeFeed: true,
        }),
        { status: 200 },
      )
    const access = await getMyVideoUploadAccess({
      baseUrl: "http://localhost:3002",
      bearerToken: "t",
      fetchImpl,
    })
    assert.equal(access.canPickVideos, false)
    assert.equal(access.subscribeOnWebsite, true)
  })
})

describe("getMyScheduleAffiliation", () => {
  it("returns null on 403", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
    const data = await getMyScheduleAffiliation({
      baseUrl: "http://localhost:3002",
      bearerToken: "t",
      fetchImpl,
    })
    assert.equal(data, null)
  })

  it("loads affiliation when allowed", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ visible: true, ownAthlete: { athleteId: "a1", firstName: "A", lastName: "B" } }), {
        status: 200,
      })
    const data = await getMyScheduleAffiliation({
      baseUrl: "http://localhost:3002",
      bearerToken: "t",
      fetchImpl,
    })
    assert.equal(data?.ownAthlete?.athleteId, "a1")
  })
})

describe("getMyScheduleEvents", () => {
  it("requests from and to query params", async () => {
    let url = ""
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      url = String(input)
      return new Response(JSON.stringify({ events: [] }), { status: 200 })
    }
    await getMyScheduleEvents(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      { from: "2026-08-21", to: "2026-08-25" },
    )
    assert.match(url, /from=2026-08-21/)
    assert.match(url, /to=2026-08-25/)
  })

  it("forwards athleteId when provided", async () => {
    let url = ""
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      url = String(input)
      return new Response(JSON.stringify({ events: [] }), { status: 200 })
    }
    await getMyScheduleEvents(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      { from: "2026-08-21", to: "2026-08-25", athleteId: "ath-9" },
    )
    assert.match(url, /athleteId=ath-9/)
  })
})

describe("getPortalAthletes", () => {
  it("loads athlete rows", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ athletes: [{ id: "w1", first_name: "Ward" }] }), { status: 200 })
    const data = await getPortalAthletes({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl })
    assert.equal(data.athletes[0]?.id, "w1")
  })
})

describe("getPortalSubscription", () => {
  it("loads billing contexts", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          billingContexts: {
            guardian: { linkedAthletes: [{ id: "w1", name: "Ward", tier: "starter", status: "active", subscriptionLive: true }] },
          },
        }),
        { status: 200 },
      )
    const data = await getPortalSubscription({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl })
    assert.equal(data.billingContexts?.guardian?.linkedAthletes[0]?.id, "w1")
  })
})

describe("getSubscribedTeams", () => {
  it("returns null on 403", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
    const data = await getSubscribedTeams({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl })
    assert.equal(data, null)
  })
})

describe("isDashboardEligibleCoachTeam", () => {
  it("keeps current-season subscribed teams", () => {
    assert.equal(
      isDashboardEligibleCoachTeam({
        id: "t1",
        name: "U14",
        seasonSlot: "current",
        subscriptionActive: true,
        lifecycle: "writable",
      }),
      true,
    )
  })

  it("excludes next-season Stripe teams without support bypass", () => {
    assert.equal(
      isDashboardEligibleCoachTeam({
        id: "t2",
        name: "Next",
        seasonSlot: "next",
        subscriptionActive: true,
        lifecycle: "writable",
      }),
      false,
    )
  })

  it("includes Support-bypassed teams even without a current season slot", () => {
    assert.equal(
      isDashboardEligibleCoachTeam({
        id: "t-bypass",
        name: "Bypassed",
        seasonSlot: null,
        subscriptionActive: true,
        lifecycle: "writable",
        bypassActive: true,
      }),
      true,
    )
    assert.equal(
      isDashboardEligibleCoachTeam({
        id: "t-next-bypass",
        name: "Next bypass",
        seasonSlot: "next",
        subscriptionActive: true,
        lifecycle: "writable",
        bypassActive: true,
      }),
      true,
    )
  })

  it("includes courtesy teams the same way as Support bypass", () => {
    assert.equal(
      isDashboardEligibleCoachTeam({
        id: "t-courtesy",
        name: "Courtesy",
        seasonSlot: null,
        subscriptionActive: true,
        lifecycle: "writable",
        courtesyActive: true,
      }),
      true,
    )
  })

  it("excludes unpaid and browse-only teams", () => {
    assert.equal(
      isDashboardEligibleCoachTeam({
        id: "t3",
        name: "Unpaid",
        seasonSlot: "current",
        subscriptionActive: false,
        lifecycle: "needs_subscription",
      }),
      false,
    )
    assert.equal(
      isDashboardEligibleCoachTeam({
        id: "t4",
        name: "Cold",
        seasonSlot: null,
        subscriptionActive: false,
        lifecycle: "browse_only",
      }),
      false,
    )
  })
})

describe("getTeamEvents", () => {
  it("requests team events with date range", async () => {
    let url = ""
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      url = String(input)
      return new Response(JSON.stringify({ events: [{ id: "e1", team_id: "t1", title: "Game" }] }), { status: 200 })
    }
    const data = await getTeamEvents(
      { baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl },
      "t1",
      { from: "2026-08-21", to: "2026-08-25" },
    )
    assert.match(url, /\/teams\/t1\/events\?/)
    assert.equal(data?.events[0]?.id, "e1")
  })
})

describe("getMyShareInvite", () => {
  it("loads share invite payload", async () => {
    let url = ""
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      url = String(input)
      return new Response(
        JSON.stringify({
          peerInvite: { code: "INV123", inviteUrl: "https://portal.example/invite/INV123" },
          referralCodes: [],
        }),
        { status: 200 },
      )
    }
    const data = await getMyShareInvite({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl })
    assert.match(url, /\/v1\/portal\/my-share-invite$/)
    assert.equal(data.peerInvite?.code, "INV123")
    assert.equal(hasMyShareInviteContent(data), true)
  })

  it("falls back to dashboard when my-share-invite is missing", async () => {
    const urls: string[] = []
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      urls.push(url)
      if (url.includes("/my-share-invite")) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
      }
      return new Response(
        JSON.stringify({
          peerInvite: { code: "INV999", inviteUrl: "https://portal.example/invite/INV999" },
          referralCodes: [{ code: "AGENT1", status: "active", label: null }],
        }),
        { status: 200 },
      )
    }
    const data = await getMyShareInvite({ baseUrl: "http://localhost:3002", bearerToken: "t", fetchImpl })
    assert.equal(urls.length, 2)
    assert.match(urls[0]!, /\/my-share-invite$/)
    assert.match(urls[1]!, /\/dashboard$/)
    assert.equal(data.peerInvite?.code, "INV999")
    assert.equal(data.referralCodes[0]?.code, "AGENT1")
  })
})

describe("myShareInviteFromDashboardPayload", () => {
  it("maps dashboard peer invite fields", () => {
    const data = myShareInviteFromDashboardPayload({
      peerInvite: { code: "INV1", inviteUrl: "https://portal.example/invite/INV1" },
      referralCodes: [{ code: "REF1", status: "active", label: "Primary" }],
    })
    assert.equal(data.peerInvite?.code, "INV1")
    assert.equal(data.referralCodes[0]?.label, "Primary")
  })
})

describe("primaryShareInviteQrUrl", () => {
  it("prefers peer invite URL", () => {
    const url = primaryShareInviteQrUrl(
      {
        peerInvite: { code: "INV", inviteUrl: "https://portal.example/invite/INV" },
        referralCodes: [{ code: "AGENT", status: "active", label: null }],
      },
      "https://portal.example",
    )
    assert.equal(url, "https://portal.example/invite/INV")
  })
})
