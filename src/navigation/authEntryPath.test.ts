import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveAuthEntryPath } from "./authEntryPath.js"

describe("resolveAuthEntryPath", () => {
  it("sends signed-out users to sign-in", () => {
    assert.equal(resolveAuthEntryPath(false), "/sign-in")
  })

  it("sends signed-in users to home", () => {
    assert.equal(resolveAuthEntryPath(true), "/home")
  })
})
