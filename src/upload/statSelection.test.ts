import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { athleteUploadSelectionReady } from "./statSelection.js"

describe("athleteUploadSelectionReady", () => {
  it("requires the server pick count on an athlete upload", () => {
    assert.equal(athleteUploadSelectionReady("athlete_pick", 3, ["a", "b"]), false)
    assert.equal(athleteUploadSelectionReady("athlete_pick", 5, ["a", "b", "c", "d", "e"]), true)
    assert.equal(athleteUploadSelectionReady("athlete_pick", 7, ["a"]), false)
    assert.equal(athleteUploadSelectionReady("athlete_pick", null, ["a", "b", "c"]), false)
  })

  it("does not require a pick for team games", () => {
    assert.equal(athleteUploadSelectionReady("team_full", null, []), true)
    assert.equal(athleteUploadSelectionReady("team_starter", null, []), true)
    assert.equal(athleteUploadSelectionReady("none", null, []), true)
  })
})
