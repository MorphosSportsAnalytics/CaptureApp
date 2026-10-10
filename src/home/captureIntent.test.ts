import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  clearCaptureIntent,
  consumeCaptureIntent,
  getCaptureIntentRevision,
  peekCaptureIntent,
  setCaptureIntent,
  subscribeCaptureIntent,
} from "./captureIntent.js"
import { mergeCaptureParams, resolveCaptureParams } from "./captureParams.js"

describe("captureIntent", () => {
  it("stores, peeks, and consumes the pending capture params", () => {
    clearCaptureIntent()
    setCaptureIntent({ athleteId: "a1", linkKind: "team", linkId: "evt-1" })
    assert.deepEqual(peekCaptureIntent(), { athleteId: "a1", linkKind: "team", linkId: "evt-1" })
    assert.deepEqual(consumeCaptureIntent(), { athleteId: "a1", linkKind: "team", linkId: "evt-1" })
    assert.equal(peekCaptureIntent(), null)
    assert.equal(consumeCaptureIntent(), null)
  })

  it("notifies subscribers when the pending event changes", () => {
    clearCaptureIntent()
    const start = getCaptureIntentRevision()
    let ticks = 0
    const stop = subscribeCaptureIntent(() => {
      ticks += 1
    })
    setCaptureIntent({ athleteId: "a1", linkId: "evt-1", linkKind: "team" })
    assert.ok(getCaptureIntentRevision() > start)
    assert.equal(ticks, 1)
    clearCaptureIntent()
    assert.equal(ticks, 2)
    stop()
  })
})

describe("resolveCaptureParams", () => {
  it("keeps a linked event from intent when the tab route dropped it", () => {
    const resolved = resolveCaptureParams(
      { athleteId: "a1" },
      { athleteId: "a1", linkKind: "team", linkId: "evt-1", eventTitle: "Practice" },
    )
    assert.equal(resolved.linkKind, "team")
    assert.equal(resolved.linkId, "evt-1")
    assert.equal(resolved.eventTitle, "Practice")
  })

  it("prefers a linked event from the route when both are present", () => {
    const resolved = resolveCaptureParams(
      { athleteId: "a1", linkKind: "athlete", linkId: "ae-2" },
      { athleteId: "a1", linkKind: "team", linkId: "evt-1" },
    )
    assert.equal(resolved.linkKind, "athlete")
    assert.equal(resolved.linkId, "ae-2")
  })

  it("merges missing extras from the fallback", () => {
    const merged = mergeCaptureParams(
      { athleteId: "a1", linkKind: "team", linkId: "evt-1" },
      { athleteId: "a1", eventTitle: "Farm S&C", sportArenaId: "arena-1" },
    )
    assert.equal(merged.eventTitle, "Farm S&C")
    assert.equal(merged.sportArenaId, "arena-1")
    assert.equal(merged.linkId, "evt-1")
  })
})
