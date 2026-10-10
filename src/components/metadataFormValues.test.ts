import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyMetadataPatch,
  metadataPatchIfChanged,
  type MetadataFormValues,
} from "./metadataFormValues.js"

const base: MetadataFormValues = {
  eventKind: "practice",
  sportArenaId: "",
  jerseyColor: "",
  jerseyNumber: "",
  skillClipMode: false,
}

describe("applyMetadataPatch", () => {
  it("returns the same object when the picker fires the current values", () => {
    const next = applyMetadataPatch(base, { eventKind: "practice", sportArenaId: "" })
    assert.equal(next, base)
    assert.equal(metadataPatchIfChanged(base, { eventKind: "practice" }), null)
  })

  it("returns the same object for an empty patch and undefined fields", () => {
    assert.equal(applyMetadataPatch(base, {}), base)
    assert.equal(applyMetadataPatch(base, { jerseyColor: undefined }), base)
  })

  it("returns a new object only for fields that actually change", () => {
    const next = applyMetadataPatch(base, { eventKind: "game", jerseyNumber: "19" })
    assert.notEqual(next, base)
    assert.equal(next.eventKind, "game")
    assert.equal(next.jerseyNumber, "19")
    assert.equal(next.sportArenaId, "")
    const patch = metadataPatchIfChanged(base, { skillClipMode: true })
    assert.deepEqual(patch, { skillClipMode: true })
    const clipped = applyMetadataPatch(base, { skillClipMode: true })
    assert.equal(clipped.skillClipMode, true)
    assert.equal(applyMetadataPatch(clipped, { skillClipMode: true }), clipped)
  })

  it("does not keep allocating when the same patch is applied in a loop", () => {
    let current = base
    for (let i = 0; i < 50; i += 1) {
      current = applyMetadataPatch(current, { eventKind: "practice", sportArenaId: "" })
    }
    assert.equal(current, base)
  })
})
