import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveSystemPath } from "./resolveSystemPath.js"

describe("resolveSystemPath", () => {
  it("maps custom scheme auth to sign-in", () => {
    assert.equal(resolveSystemPath("auth?code=abc"), "/sign-in?code=abc")
  })

  it("maps https app link capture/auth to sign-in", () => {
    assert.equal(resolveSystemPath("/capture/auth?code=abc"), "/sign-in?code=abc")
    assert.equal(resolveSystemPath("capture/auth?state=1"), "/sign-in?state=1")
  })

  it("maps empty path to home", () => {
    assert.equal(resolveSystemPath("/"), "/home")
  })
})
