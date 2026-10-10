import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  captureParamsFromAthleteScheduleEvent,
  captureParamsFromTeamScheduleEvent,
  captureParamsHasUploadScope,
  parseCaptureParams,
  recordedAtMsFromParams,
  serializeCaptureParams,
} from "./captureParams.js"

describe("captureParams", () => {
  it("round-trips through serialize and parse", () => {
    const original = {
      athleteId: "a1",
      linkKind: "team" as const,
      linkId: "evt-1",
      eventKind: "game",
      eventTitle: "AA - U14 practice",
      sportArenaId: "arena-1",
      recordedAtMs: "1730000000000",
    }
    const parsed = parseCaptureParams(serializeCaptureParams(original))
    assert.equal(parsed.athleteId, original.athleteId)
    assert.equal(parsed.linkKind, original.linkKind)
    assert.equal(parsed.linkId, original.linkId)
    assert.equal(parsed.eventKind, original.eventKind)
    assert.equal(parsed.eventTitle, original.eventTitle)
    assert.equal(parsed.sportArenaId, original.sportArenaId)
    assert.equal(parsed.recordedAtMs, original.recordedAtMs)
  })

  it("detects upload scope", () => {
    assert.equal(captureParamsHasUploadScope({ athleteId: "a1" }), true)
    assert.equal(captureParamsHasUploadScope({ teamId: "t1" }), true)
    assert.equal(captureParamsHasUploadScope({}), false)
  })

  it("parses recordedAtMs", () => {
    assert.equal(recordedAtMsFromParams({ recordedAtMs: "1234.9" }), 1234)
    assert.equal(recordedAtMsFromParams({}), null)
  })

  it("maps an athlete schedule team event onto capture params including the team id", () => {
    const params = captureParamsFromAthleteScheduleEvent(
      {
        id: "evt-1",
        sourceType: "team",
        sourceId: "team-9",
        title: "AA - U14 - Athlete Farm Strength & Conditioning - OPTION",
        startsAt: "2026-08-25T22:00:00.000Z",
        sportArenaId: "arena-1",
      },
      "ath-1",
      "practice",
    )
    assert.equal(params.athleteId, "ath-1")
    assert.equal(params.teamId, "team-9")
    assert.equal(params.linkKind, "team")
    assert.equal(params.linkId, "evt-1")
    assert.equal(params.eventKind, "practice")
    assert.equal(params.eventTitle, "AA - U14 - Athlete Farm Strength & Conditioning - OPTION")
    assert.equal(params.sportArenaId, "arena-1")
    assert.ok(params.recordedAtMs)
  })

  it("maps a coach team event onto capture params", () => {
    const params = captureParamsFromTeamScheduleEvent(
      {
        id: "te-1",
        title: "Team practice",
        starts_at: "2026-08-27T22:00:00.000Z",
        event_kind: "practice",
        sport_arena_id: "arena-2",
        coach_kit_kind: "home",
        opponent_jersey_primary: "red",
      },
      "team-1",
      "practice",
    )
    assert.equal(params.teamId, "team-1")
    assert.equal(params.linkKind, "team")
    assert.equal(params.linkId, "te-1")
    assert.equal(params.eventTitle, "Team practice")
    assert.equal(params.kitKind, "home")
    assert.equal(params.opponentJerseyPrimary, "red")
  })
})
