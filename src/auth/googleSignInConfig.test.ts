import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  clientIdsFromConfig,
  fetchGoogleSignInConfig,
  friendlyGoogleSignInError,
  interpolatePlatformMessage,
  isGoogleClientConfigError,
  mergeGoogleSignInIds,
  resolveGoogleSignInIds,
} from "./googleSignInConfig"

const baked = {
  googleWebClientId: "baked-web.apps.googleusercontent.com",
  googleIosClientId: "baked-ios.apps.googleusercontent.com",
}

describe("clientIdsFromConfig", () => {
  it("maps google-config onto the web and iOS client ids", () => {
    assert.deepEqual(
      clientIdsFromConfig({
        clientId: " web.apps.googleusercontent.com ",
        iosClientId: " ios.apps.googleusercontent.com ",
      }),
      {
        googleWebClientId: "web.apps.googleusercontent.com",
        googleIosClientId: "ios.apps.googleusercontent.com",
      },
    )
  })
})

describe("mergeGoogleSignInIds", () => {
  it("prefers Portal API values and keeps baked ids for anything missing", () => {
    assert.deepEqual(mergeGoogleSignInIds(baked, { googleWebClientId: "live-web.apps.googleusercontent.com" }), {
      googleWebClientId: "live-web.apps.googleusercontent.com",
      googleIosClientId: "baked-ios.apps.googleusercontent.com",
    })
    assert.deepEqual(mergeGoogleSignInIds(baked, null), baked)
  })
})

describe("resolveGoogleSignInIds", () => {
  it("is ready per platform only when that platform's client id resolves", () => {
    const androidOnly = { googleWebClientId: "web.apps.googleusercontent.com" }
    assert.equal(resolveGoogleSignInIds({ platform: "android", fallback: androidOnly, fetched: null }).status, "ready")
    assert.equal(
      resolveGoogleSignInIds({ platform: "ios", fallback: androidOnly, fetched: null }).status,
      "unavailable",
    )
    assert.equal(resolveGoogleSignInIds({ platform: "ios", fallback: baked, fetched: null }).status, "ready")
  })
})

describe("fetchGoogleSignInConfig", () => {
  it("uses Portal API ids when reachable", async () => {
    const state = await fetchGoogleSignInConfig("https://api.example.com", "ios", baked, async () => ({
      ok: true as const,
      data: {
        clientId: "web.apps.googleusercontent.com",
        androidClientId: null,
        iosClientId: "live-ios.apps.googleusercontent.com",
      },
    }))
    assert.deepEqual(state, {
      status: "ready",
      ids: {
        googleWebClientId: "web.apps.googleusercontent.com",
        googleIosClientId: "live-ios.apps.googleusercontent.com",
      },
    })
  })

  it("falls back to baked ids when Portal API is unreachable", async () => {
    const state = await fetchGoogleSignInConfig("https://api.example.com", "android", baked, async () => {
      throw new Error("offline")
    })
    assert.deepEqual(state, { status: "ready", ids: baked })
  })

  it("is unavailable when neither source has the platform client id", async () => {
    const state = await fetchGoogleSignInConfig("https://api.example.com", "ios", {}, async () => ({
      ok: false as const,
      error: "not configured",
      status: 503,
    }))
    assert.deepEqual(state, { status: "unavailable" })
  })
})

describe("interpolatePlatformMessage", () => {
  it("substitutes a user-facing OS name on both platforms, leaving no placeholder behind", () => {
    const template = "Verify the Morphos Capture {platform} OAuth client ({platform})."
    assert.equal(
      interpolatePlatformMessage(template, "android"),
      "Verify the Morphos Capture Android OAuth client (Android).",
    )
    assert.equal(interpolatePlatformMessage(template, "ios"), "Verify the Morphos Capture iOS OAuth client (iOS).")
    assert.equal(interpolatePlatformMessage(template, "ios").includes("{platform}"), false)
  })
})

describe("friendlyGoogleSignInError", () => {
  it("maps Android DEVELOPER_ERROR and audience rejections to the misconfiguration copy", () => {
    assert.equal(isGoogleClientConfigError("DEVELOPER_ERROR"), true)
    assert.equal(isGoogleClientConfigError("Invalid Google sign-in token"), true)
    assert.equal(
      friendlyGoogleSignInError(new Error("DEVELOPER_ERROR"), "Sign-in failed.", "Check the SHA-1 fingerprint."),
      "Check the SHA-1 fingerprint.",
    )
    assert.equal(friendlyGoogleSignInError(new Error("Network request failed"), "Sign-in failed.", "misconfig"), "Network request failed")
    assert.equal(friendlyGoogleSignInError(new Error("  "), "Sign-in failed.", "misconfig"), "Sign-in failed.")
  })
})
