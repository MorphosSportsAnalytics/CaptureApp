import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { validateClientPreprocessSidecar } from "./schema.js"

describe("validateClientPreprocessSidecar", () => {
  const valid = {
    preprocessVersion: 1,
    sourceDurationSeconds: 120,
    outputDurationSeconds: 90,
    deadAirIntervals: [{ start: 0, end: 30 }],
    activeCoverage: 0.75,
    qc: {
      blur: 0.2,
      shake: 0.1,
      darkness: 0.3,
      subjectVisibleRatio: 0.8,
      jerseyVisibleRatio: 0.6,
      passed: true,
    },
    transcode: { codec: "h264", width: 1920, height: 1080, fps: 30, bitrateKbps: 5000 },
  }

  it("accepts valid sidecar", () => {
    const r = validateClientPreprocessSidecar(valid)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.sidecar.outputDurationSeconds, 90)
  })

  it("accepts skill-clip 60fps transcode profile", () => {
    const r = validateClientPreprocessSidecar({
      ...valid,
      transcode: { codec: "h264", width: 1920, height: 1080, fps: 60, bitrateKbps: 5000 },
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.sidecar.transcode.fps, 60)
  })

  it("rejects wrong version", () => {
    const r = validateClientPreprocessSidecar({ ...valid, preprocessVersion: 2 })
    assert.equal(r.ok, false)
  })

  it("rejects output longer than source", () => {
    const r = validateClientPreprocessSidecar({ ...valid, outputDurationSeconds: 200 })
    assert.equal(r.ok, false)
  })

  it("rejects overlapping dead air", () => {
    const r = validateClientPreprocessSidecar({
      ...valid,
      deadAirIntervals: [
        { start: 0, end: 20 },
        { start: 15, end: 30 },
      ],
    })
    assert.equal(r.ok, false)
  })
})
