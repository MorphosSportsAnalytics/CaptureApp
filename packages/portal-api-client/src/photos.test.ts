import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { athleteAvatarPhotoKind, athletePhotoRequest } from "./photos.js"

describe("athletePhotoRequest", () => {
  it("builds a versioned portal photo URL with auth headers", () => {
    const req = athletePhotoRequest(
      { baseUrl: "http://localhost:3002/", bearerToken: "tok" },
      "ath-1",
      "action_shot",
      "2026-08-25T10:00:00.000Z",
    )
    assert.match(req.uri, /\/v1\/portal\/athletes\/ath-1\/photos\/action_shot\?v=/)
    assert.equal(req.headers.Authorization, "Bearer tok")
    assert.equal(req.headers["x-morphos-portal-user-bearer"], "tok")
  })

  it("omits cache bust when updatedAt is missing", () => {
    const req = athletePhotoRequest(
      { baseUrl: "http://localhost:3002", bearerToken: "tok" },
      "ath-1",
      "mugshot",
    )
    assert.equal(req.uri, "http://localhost:3002/v1/portal/athletes/ath-1/photos/mugshot")
  })
})

describe("athleteAvatarPhotoKind", () => {
  it("prefers action shot over mugshot", () => {
    assert.equal(athleteAvatarPhotoKind({ hasActionShot: true, hasMugshot: true }), "action_shot")
    assert.equal(athleteAvatarPhotoKind({ hasActionShot: false, hasMugshot: true }), "mugshot")
    assert.equal(athleteAvatarPhotoKind({ hasActionShot: false, hasMugshot: false }), null)
  })

  it("accepts MySQL tinyint photo flags (1)", () => {
    assert.equal(athleteAvatarPhotoKind({ hasActionShot: 1, hasMugshot: 0 }), "action_shot")
    assert.equal(athleteAvatarPhotoKind({ hasActionShot: 0, hasMugshot: 1 }), "mugshot")
  })
})
