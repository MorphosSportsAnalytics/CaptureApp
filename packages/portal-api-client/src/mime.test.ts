import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { guessVideoMime } from "./mime.js"

describe("portal-api-client mime", () => {
  it("prefers video/* content type", () => {
    assert.equal(guessVideoMime("clip.bin", "video/webm"), "video/webm")
  })

  it("maps common extensions", () => {
    assert.equal(guessVideoMime("game.mov"), "video/quicktime")
    assert.equal(guessVideoMime("game.webm"), "video/webm")
    assert.equal(guessVideoMime("game.mkv"), "video/x-matroska")
    assert.equal(guessVideoMime("game.mp4"), "video/mp4")
  })
})
