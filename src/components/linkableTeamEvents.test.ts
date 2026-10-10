import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { linkableEventWindowYmd, linkableTeamEventsFromRows } from "./linkableTeamEvents.js"

describe("linkableTeamEvents", () => {
  it("builds a 30-day lookback / 14-day lookahead window around the anchor", () => {
    const window = linkableEventWindowYmd(new Date(2026, 7, 25, 14, 0, 0).getTime())
    assert.equal(window.from, "2026-07-26")
    assert.equal(window.to, "2026-09-08")
  })

  it("maps team schedule rows and drops cancelled events", () => {
    const events = linkableTeamEventsFromRows(
      [
        {
          id: "te-1",
          team_id: "team-1",
          title: "Practice",
          starts_at: "2026-08-25T22:00:00.000Z",
          ends_at: null,
          event_kind: "practice",
          status: "scheduled",
          sport_arena_id: "arena-1",
          coach_kit_kind: "home",
          opponent_jersey_primary: null,
        },
        {
          id: "te-2",
          team_id: "team-1",
          title: "Cancelled",
          starts_at: "2026-08-26T22:00:00.000Z",
          ends_at: null,
          event_kind: "game",
          status: "cancelled",
          sport_arena_id: null,
          coach_kit_kind: null,
          opponent_jersey_primary: null,
        },
      ],
      "team-1",
    )
    assert.equal(events.length, 1)
    assert.equal(events[0]?.kind, "team")
    assert.equal(events[0]?.id, "te-1")
    assert.equal(events[0]?.sportArenaId, "arena-1")
  })
})
