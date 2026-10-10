import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildQcMetrics, evaluateQc } from "./qc.js"

describe("qc", () => {
  it("evaluateQc fails low subject visibility", () => {
    const r = evaluateQc({
      blur: 0.1,
      shake: 0.1,
      darkness: 0.1,
      subjectVisibleRatio: 0.2,
      jerseyVisibleRatio: 0.8,
    })
    assert.equal(r.passed, false)
    assert.ok(r.failures.includes("subject_not_visible"))
  })

  it("buildQcMetrics sets passed flag", () => {
    const qc = buildQcMetrics({
      blur: 0.1,
      shake: 0.1,
      darkness: 0.1,
      subjectVisibleRatio: 0.9,
      jerseyVisibleRatio: 0.8,
    })
    assert.equal(qc.passed, true)
  })
})
