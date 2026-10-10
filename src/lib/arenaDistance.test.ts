import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyNearestArenaToPicker,
  ensureArenaInList,
  filterArenasByQuery,
  nearestArenaId,
  sortArenasByDistance,
} from "./arenaDistance.js"

describe("arenaDistance", () => {
  const arenas = [
    { id: "a", name: "Far Rink", latitude: 45, longitude: -75 },
    { id: "b", name: "Near Rink", latitude: 43.65, longitude: -79.38 },
    { id: "c", name: "No Coords" },
  ]

  it("picks the nearest arena with coordinates", () => {
    const gps = { lat: 43.7, lng: -79.4 }
    assert.equal(nearestArenaId(arenas, gps), "b")
  })

  it("sorts arenas by distance then name", () => {
    const sorted = sortArenasByDistance(arenas, { lat: 43.7, lng: -79.4 })
    assert.equal(sorted[0]?.id, "b")
    assert.equal(sorted[1]?.id, "a")
    assert.equal(sorted[2]?.id, "c")
  })

  it("filters arenas by search query", () => {
    assert.equal(filterArenasByQuery(arenas, "near").length, 1)
    assert.equal(filterArenasByQuery(arenas, "rink").length, 2)
  })

  it("merges a nearest arena into the picker list", () => {
    const extra = { id: "d", name: "New Rink", latitude: 44, longitude: -79 }
    const merged = ensureArenaInList(arenas, extra)
    assert.equal(merged[0]?.id, "d")
    assert.equal(ensureArenaInList(merged, extra).length, merged.length)
    const applied = applyNearestArenaToPicker(arenas, extra)
    assert.equal(applied?.sportArenaId, "d")
    assert.equal(applyNearestArenaToPicker(arenas, null), null)
  })
})
