import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  clearCaptureOAuthInbox,
  peekCaptureOAuthUrl,
  pushCaptureOAuthUrl,
  subscribeCaptureOAuthUrl,
  takeCaptureOAuthUrl,
  waitForCaptureOAuthUrl,
} from "./captureOAuthInbox"

describe("capture OAuth inbox", () => {
  it("stores only Capture OAuth URLs and delivers them to waiters", async () => {
    clearCaptureOAuthInbox()
    assert.equal(pushCaptureOAuthUrl("https://evil.example/?code=1"), false)
    assert.equal(peekCaptureOAuthUrl(), null)
    assert.equal(pushCaptureOAuthUrl("morphoscapture://auth?code=abc"), true)
    assert.equal(peekCaptureOAuthUrl(), "morphoscapture://auth?code=abc")
    assert.equal(takeCaptureOAuthUrl(), "morphoscapture://auth?code=abc")
    assert.equal(takeCaptureOAuthUrl(), null)
  })

  it("resolves waiters when a URL arrives and times out otherwise", async () => {
    clearCaptureOAuthInbox()
    const pending = waitForCaptureOAuthUrl(200)
    assert.equal(pushCaptureOAuthUrl("morphoscapture://auth?code=xyz"), true)
    assert.equal(await pending, "morphoscapture://auth?code=xyz")

    clearCaptureOAuthInbox()
    assert.equal(await waitForCaptureOAuthUrl(20), null)

    clearCaptureOAuthInbox()
    pushCaptureOAuthUrl("morphoscapture://auth?code=ready")
    assert.equal(await waitForCaptureOAuthUrl(20), "morphoscapture://auth?code=ready")

    clearCaptureOAuthInbox()
    const seen: string[] = []
    const unsub = subscribeCaptureOAuthUrl((url) => seen.push(url))
    pushCaptureOAuthUrl("morphoscapture://auth?error=access_denied")
    unsub()
    pushCaptureOAuthUrl("morphoscapture://auth?code=after")
    assert.deepEqual(seen, ["morphoscapture://auth?error=access_denied"])
    clearCaptureOAuthInbox()
  })
})
