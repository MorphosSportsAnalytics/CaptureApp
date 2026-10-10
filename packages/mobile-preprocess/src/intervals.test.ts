import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  activeCoverage,
  complementIntervals,
  coverageDelta,
  mergeOverlappingIntervals,
  totalIntervalDuration,
  trimToTierMax,
  trimWindowForTierMax,
} from "./intervals.js"

describe("intervals", () => {
  it("totalIntervalDuration sums spans", () => {
    assert.equal(totalIntervalDuration([{ start: 0, end: 10 }, { start: 20, end: 25 }]), 15)
  })

  it("mergeOverlappingIntervals merges adjacent", () => {
    const merged = mergeOverlappingIntervals([
      { start: 0, end: 5 },
      { start: 4, end: 10 },
    ])
    assert.deepEqual(merged, [{ start: 0, end: 10 }])
  })

  it("complementIntervals returns active spans", () => {
    const active = complementIntervals([{ start: 10, end: 20 }], 30)
    assert.deepEqual(active, [
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ])
  })

  it("activeCoverage computes ratio", () => {
    assert.equal(activeCoverage([{ start: 0, end: 25 }], 100), 0.75)
  })

  it("trimToTierMax caps duration", () => {
    assert.equal(trimToTierMax(400, 300), 300)
    assert.equal(trimToTierMax(0, 300), 0)
  })

  it("trimWindowForTierMax keeps earliest active content", () => {
    const { intervals, durationSeconds } = trimWindowForTierMax(
      [
        { start: 0, end: 200 },
        { start: 250, end: 400 },
      ],
      250,
    )
    assert.equal(durationSeconds, 250)
    assert.deepEqual(intervals, [{ start: 0, end: 200 }, { start: 250, end: 300 }])
  })

  it("coverageDelta is absolute difference", () => {
    assert.ok(Math.abs(coverageDelta(0.9, 0.75) - 0.15) < 1e-9)
  })
})
