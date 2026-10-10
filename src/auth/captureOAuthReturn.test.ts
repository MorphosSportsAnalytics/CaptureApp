import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  authSessionSuccessUrl,
  captureOAuthUrlFromRouteParams,
  mergeOAuthReturnParams,
  oauthParamsFromSearch,
  oauthReturnHasResult,
  oauthReturnMatchesState,
  parseCaptureOAuthReturn,
  resolveInteractiveOAuthReturn,
  routeParamsToHrefParams,
} from "./captureOAuthReturn"

describe("capture OAuth return", () => {
  it("parses the Capture scheme and sign-in paths used by Microsoft sign-in", () => {
    assert.deepEqual(parseCaptureOAuthReturn("morphoscapture://auth?code=abc&state=s1"), {
      code: "abc",
      idToken: null,
      state: "s1",
      error: null,
      errorDescription: null,
    })
    assert.equal(parseCaptureOAuthReturn("/sign-in?code=abc")?.code, "abc")
    assert.equal(parseCaptureOAuthReturn("https://evil.example/?code=abc"), null)
    assert.equal(parseCaptureOAuthReturn("morphoscapture://auth"), null)
    assert.equal(
      parseCaptureOAuthReturn("https://portal.morphosanalytics.com/capture/auth#id_token=apple-jwt&state=s")?.idToken,
      "apple-jwt",
    )
  })

  it("reads OAuth keys from search params and route params", () => {
    assert.equal(oauthReturnHasResult(oauthParamsFromSearch(new URLSearchParams({ code: " x " }))), true)
    assert.equal(
      captureOAuthUrlFromRouteParams({ code: ["abc"], other: "drop" }),
      "morphoscapture://auth?code=abc",
    )
    assert.deepEqual(routeParamsToHrefParams({ code: ["a"], empty: "  ", skip: undefined }), { code: "a" })
  })

  it("merges prompt params with the deep-link return and recovers dismiss", () => {
    const merged = mergeOAuthReturnParams(
      oauthParamsFromSearch({ state: "s" }),
      parseCaptureOAuthReturn("morphoscapture://auth?code=abc&state=s"),
    )
    assert.equal(merged?.code, "abc")
    assert.equal(oauthReturnMatchesState(merged!, "s"), true)

    const recovered = resolveInteractiveOAuthReturn({
      promptType: "dismiss",
      returnUrl: "morphoscapture://auth?code=abc&state=s",
      expectedState: "s",
      cancelledMessage: "cancelled",
      failedMessage: "failed",
    })
    assert.deepEqual(recovered, { ok: true, code: "abc", idToken: null })

    assert.equal(
      authSessionSuccessUrl({ type: "success", url: " morphoscapture://auth?code=abc " }),
      "morphoscapture://auth?code=abc",
    )
    assert.equal(authSessionSuccessUrl({ type: "dismiss", url: "morphoscapture://auth?code=abc" }), null)
  })
})
