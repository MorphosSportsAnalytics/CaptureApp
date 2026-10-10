import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { MetadataFormValues } from "../components/metadataFormValues.js"
import type { EventLinkSelection } from "../components/eventLinkSelection.js"
import {
  applyCaptureRouteSync,
  captureParamsKey,
  eventLinkFromParams,
  metadataFromParams,
  type CaptureSyncedFields,
} from "./captureScreenState.js"

const blankMeta: MetadataFormValues = {
  eventKind: "practice",
  sportArenaId: "",
  jerseyColor: "white",
  jerseyNumber: "19",
  skillClipMode: false,
}

function blankState(over: Partial<CaptureSyncedFields> = {}): CaptureSyncedFields {
  return {
    athleteId: undefined,
    teamId: undefined,
    kitKind: undefined,
    opponentJerseyPrimary: undefined,
    eventLink: { mode: "manual" },
    recordedAtMs: null,
    meta: blankMeta,
    ...over,
  }
}

describe("captureScreenState", () => {
  it("fingerprints equivalent search-param objects the same way", () => {
    const a = captureParamsKey({ athleteId: "a1", ignored: "x" })
    const b = captureParamsKey({ athleteId: ["a1"], extra: ["y"] })
    assert.equal(a, b)
    assert.notEqual(captureParamsKey({ athleteId: "a1" }), captureParamsKey({ athleteId: "a2" }))
    assert.equal(captureParamsKey({}), JSON.stringify({}))
  })

  it("maps route params onto event-link and metadata patches", () => {
    assert.deepEqual(eventLinkFromParams({}), { mode: "manual" })
    assert.deepEqual(eventLinkFromParams({ linkKind: "team" }), { mode: "manual" })
    assert.deepEqual(eventLinkFromParams({ linkId: "evt-1" }), { mode: "manual" })
    const linked = eventLinkFromParams({
      linkKind: "team",
      linkId: "evt-1",
      eventKind: "group_large",
      sportArenaId: "arena-1",
    })
    assert.deepEqual(linked, {
      mode: "linked",
      kind: "team",
      id: "evt-1",
      eventKind: "practice",
      sportArenaId: "arena-1",
    })
    const unknownKind = eventLinkFromParams({
      linkKind: "dc",
      linkId: "dc-1",
      eventKind: "scrimmage",
    })
    assert.equal(unknownKind.mode, "linked")
    if (unknownKind.mode === "linked") {
      assert.equal(unknownKind.eventKind, "scrimmage")
      assert.equal(unknownKind.sportArenaId, null)
    }
    assert.deepEqual(metadataFromParams({}), {})
    assert.deepEqual(metadataFromParams({ eventKind: "unknown" }), {})
    assert.deepEqual(metadataFromParams({ eventKind: "game", sportArenaId: "arena-1" }), {
      eventKind: "game",
      sportArenaId: "arena-1",
    })
  })

  it("returns the same state object when route params are applied twice", () => {
    const params = {
      athleteId: "a1",
      eventKind: "practice",
      recordedAtMs: "1730000000000",
    }
    const once = applyCaptureRouteSync(blankState(), params)
    assert.equal(once.athleteId, "a1")
    assert.equal(once.recordedAtMs, 1730000000000)
    assert.equal(once.meta, blankMeta)
    const twice = applyCaptureRouteSync(once, params)
    assert.equal(twice, once)
    let current = once
    for (let i = 0; i < 50; i += 1) {
      current = applyCaptureRouteSync(current, params)
    }
    assert.equal(current, once)
  })

  it("preserves jersey fields and only updates linked event metadata when params change", () => {
    const withJersey = blankState({
      meta: { ...blankMeta, jerseyColor: "black", jerseyNumber: "7" },
    })
    const synced = applyCaptureRouteSync(withJersey, {
      athleteId: "a1",
      linkKind: "athlete",
      linkId: "ae-1",
      eventKind: "game",
      sportArenaId: "arena-9",
      teamId: "t1",
      kitKind: "home",
      opponentJerseyPrimary: "red",
    })
    assert.notEqual(synced, withJersey)
    assert.equal(synced.meta.jerseyColor, "black")
    assert.equal(synced.meta.jerseyNumber, "7")
    assert.equal(synced.meta.eventKind, "game")
    assert.equal(synced.meta.sportArenaId, "arena-9")
    assert.equal(synced.teamId, "t1")
    assert.equal(synced.kitKind, "home")
    assert.equal(synced.opponentJerseyPrimary, "red")
    const linked: EventLinkSelection = {
      mode: "linked",
      kind: "athlete",
      id: "ae-1",
      eventKind: "game",
      sportArenaId: "arena-9",
    }
    assert.deepEqual(synced.eventLink, linked)
    assert.equal(applyCaptureRouteSync(synced, {
      athleteId: "a1",
      linkKind: "athlete",
      linkId: "ae-1",
      eventKind: "game",
      sportArenaId: "arena-9",
      teamId: "t1",
      kitKind: "home",
      opponentJerseyPrimary: "red",
    }), synced)
  })
})
