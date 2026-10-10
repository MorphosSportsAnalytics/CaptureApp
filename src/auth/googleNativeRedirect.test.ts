import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { googleNativeUrlScheme } from "./googleNativeRedirect"

describe("googleNativeUrlScheme", () => {
  it("derives the reverse-DNS scheme for an iOS client id", () => {
    assert.equal(
      googleNativeUrlScheme("987654321098-zyxwvutsrqponmlk.apps.googleusercontent.com"),
      "com.googleusercontent.apps.987654321098-zyxwvutsrqponmlk",
    )
  })

  it("rejects blank and non-Google client ids", () => {
    assert.equal(googleNativeUrlScheme(""), null)
    assert.equal(googleNativeUrlScheme("  "), null)
    assert.equal(googleNativeUrlScheme("not-a-google-client"), null)
    assert.equal(googleNativeUrlScheme(".apps.googleusercontent.com"), null)
  })
})
