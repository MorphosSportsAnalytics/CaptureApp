import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  bucketAthleteScheduleEvents,
  mobileScheduleFetchWindowYmd,
} from "./scheduleBuckets.js"

describe("mobileScheduleFetchWindowYmd", () => {
  it("returns a 90-day lookback and 60-day lookahead", () => {
    const now = new Date(2026, 7, 25, 12, 0, 0)
    const win = mobileScheduleFetchWindowYmd(now)
    assert.equal(win.from, "2026-05-27")
    assert.equal(win.to, "2026-10-24")
  })
})

describe("bucketAthleteScheduleEvents", () => {
  it("splits events into earlier, focus, and upcoming buckets", () => {
    const now = new Date(2026, 7, 25, 12, 0, 0)
    const earlier = {
      id: "e1",
      startsAt: new Date(2026, 7, 10, 18, 0, 0).toISOString(),
    }
    const focus = {
      id: "e2",
      startsAt: new Date(2026, 7, 24, 18, 0, 0).toISOString(),
    }
    const upcoming = {
      id: "e3",
      startsAt: new Date(2026, 8, 2, 18, 0, 0).toISOString(),
    }
    const buckets = bucketAthleteScheduleEvents([upcoming, earlier, focus], now)
    assert.deepEqual(
      {
        earlier: buckets.earlier.map((ev) => ev.id),
        focus: buckets.focus.map((ev) => ev.id),
        upcoming: buckets.upcoming.map((ev) => ev.id),
      },
      { earlier: ["e1"], focus: ["e2"], upcoming: ["e3"] },
    )
  })
})
