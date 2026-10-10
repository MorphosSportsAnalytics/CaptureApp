import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatScheduleWhenLabel,
  homeCardEventWindowYmd,
  isEventHappeningNow,
  sortCardUploadEvents,
  upcomingCardEvents,
} from "./cardEvents.js"

describe("homeCardEventWindowYmd", () => {
  it("returns a four-day lookback through two days ahead", () => {
    const now = new Date(2026, 7, 25, 15, 0, 0)
    const win = homeCardEventWindowYmd(now, 4, 2)
    assert.equal(win.to, "2026-08-27")
    assert.equal(win.from, "2026-08-21")
  })
})

describe("isEventHappeningNow", () => {
  it("uses a two-hour default when endsAt is missing", () => {
    const now = new Date("2026-08-25T19:30:00.000Z")
    const ev = { id: "e1", title: "Game", startsAt: "2026-08-25T18:00:00.000Z", endsAt: null }
    assert.equal(isEventHappeningNow(ev, now), true)
  })
})

describe("sortCardUploadEvents", () => {
  it("orders happening-now before recent past events", () => {
    const now = new Date(2026, 7, 25, 15, 0, 0)
    const live = {
      id: "live",
      title: "Live game",
      startsAt: new Date(2026, 7, 25, 14, 30, 0).toISOString(),
      endsAt: new Date(2026, 7, 25, 16, 30, 0).toISOString(),
      status: "scheduled",
    }
    const yesterday = {
      id: "y",
      title: "Yesterday",
      startsAt: new Date(2026, 7, 24, 18, 0, 0).toISOString(),
      endsAt: new Date(2026, 7, 24, 20, 0, 0).toISOString(),
      status: "scheduled",
    }
    const older = {
      id: "o",
      title: "Older",
      startsAt: new Date(2026, 7, 22, 18, 0, 0).toISOString(),
      endsAt: new Date(2026, 7, 22, 20, 0, 0).toISOString(),
      status: "scheduled",
    }
    const sorted = sortCardUploadEvents([older, yesterday, live], now)
    assert.deepEqual(sorted.map((e) => e.id), ["live", "y", "o"])
  })

  it("drops cancelled and future events", () => {
    const now = new Date(2026, 7, 25, 12, 0, 0)
    const cancelled = {
      id: "c",
      title: "Cancelled",
      startsAt: new Date(2026, 7, 24, 18, 0, 0).toISOString(),
      endsAt: null,
      status: "cancelled",
    }
    const future = {
      id: "f",
      title: "Future",
      startsAt: new Date(2026, 7, 26, 18, 0, 0).toISOString(),
      endsAt: null,
      status: "scheduled",
    }
    const sorted = sortCardUploadEvents([cancelled, future], now)
    assert.equal(sorted.length, 0)
  })
})

describe("upcomingCardEvents", () => {
  it("returns future events within the horizon sorted ascending", () => {
    const now = new Date(2026, 7, 25, 12, 0, 0)
    const tomorrow = {
      id: "t1",
      title: "Tomorrow practice",
      startsAt: new Date(2026, 7, 26, 18, 0, 0).toISOString(),
      endsAt: null,
      status: "scheduled",
      eventKindKey: "practice",
    }
    const dayAfter = {
      id: "t2",
      title: "Day after game",
      startsAt: new Date(2026, 7, 27, 18, 0, 0).toISOString(),
      endsAt: null,
      status: "scheduled",
      eventKindKey: "game",
    }
    const past = {
      id: "p",
      title: "Past",
      startsAt: new Date(2026, 7, 24, 18, 0, 0).toISOString(),
      endsAt: null,
      status: "scheduled",
      eventKindKey: "practice",
    }
    const farFuture = {
      id: "f",
      title: "Far",
      startsAt: new Date(2026, 7, 30, 18, 0, 0).toISOString(),
      endsAt: null,
      status: "scheduled",
      eventKindKey: "practice",
    }
    const upcoming = upcomingCardEvents([dayAfter, past, tomorrow, farFuture], now)
    assert.deepEqual(upcoming.map((ev) => ev.id), ["t1", "t2"])
  })
})

describe("formatScheduleWhenLabel", () => {
  it("returns empty for invalid dates", () => {
    assert.equal(formatScheduleWhenLabel(null), "")
    assert.equal(formatScheduleWhenLabel("not-a-date"), "")
  })
})
