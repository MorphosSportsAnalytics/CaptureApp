import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  GOOGLE_SIGN_IN_CANCELLED,
  GOOGLE_SIGN_IN_FAILED,
  GOOGLE_SIGN_IN_UNCONFIGURED,
  acquireGoogleIdToken,
  googleConfigureParams,
  googleSignInAvailable,
  idTokenFromSignInResult,
  restoreGoogleIdToken,
  signOutGoogleSession,
  type GoogleSignInBridge,
  type GoogleSignInResult,
} from "./googleSignInCore"

const ids = {
  googleWebClientId: "web.apps.googleusercontent.com",
  googleIosClientId: "ios.apps.googleusercontent.com",
}

function fakeBridge(overrides: Partial<GoogleSignInBridge> = {}) {
  const calls: { configured: unknown[]; playServices: number; signedOut: number } = {
    configured: [],
    playServices: 0,
    signedOut: 0,
  }
  const bridge: GoogleSignInBridge = {
    configure: (params) => {
      calls.configured.push(params)
    },
    hasPlayServices: async () => {
      calls.playServices += 1
      return true
    },
    signIn: async () => ({ type: "success", data: { idToken: "jwt" } }) as GoogleSignInResult,
    signInSilently: async () => ({ type: "success", data: { idToken: "silent-jwt" } }) as GoogleSignInResult,
    signOut: async () => {
      calls.signedOut += 1
      return null
    },
    isCancelledError: () => false,
    ...overrides,
  }
  return { bridge, calls }
}

describe("googleConfigureParams", () => {
  it("configures Android with the web client id and iOS with the iOS client id", () => {
    assert.deepEqual(googleConfigureParams("android", ids), {
      webClientId: "web.apps.googleusercontent.com",
      offlineAccess: false,
    })
    assert.deepEqual(googleConfigureParams("ios", ids), {
      iosClientId: "ios.apps.googleusercontent.com",
      webClientId: "web.apps.googleusercontent.com",
      offlineAccess: false,
    })
  })

  it("reports unavailable per platform when that platform's client id is missing", () => {
    assert.equal(googleConfigureParams("android", { googleIosClientId: ids.googleIosClientId }), null)
    assert.equal(googleConfigureParams("ios", { googleWebClientId: ids.googleWebClientId }), null)
    assert.equal(googleSignInAvailable("android", ids), true)
    assert.equal(googleSignInAvailable("ios", ids), true)
    assert.equal(googleSignInAvailable("ios", { googleWebClientId: ids.googleWebClientId }), false)
  })
})

describe("idTokenFromSignInResult", () => {
  it("reads and trims the ID token, rejecting blanks", () => {
    assert.equal(idTokenFromSignInResult({ type: "success", data: { idToken: " jwt " } }), "jwt")
    assert.equal(idTokenFromSignInResult({ type: "success", data: { idToken: null } }), null)
    assert.equal(idTokenFromSignInResult({ type: "cancelled", data: null }), null)
    assert.equal(idTokenFromSignInResult(null), null)
  })
})

describe("acquireGoogleIdToken", () => {
  it("checks Play Services on Android only and returns the ID token", async () => {
    const android = fakeBridge()
    assert.equal(await acquireGoogleIdToken(android.bridge, "android", ids), "jwt")
    assert.equal(android.calls.playServices, 1)
    assert.deepEqual(android.calls.configured, [{ webClientId: ids.googleWebClientId, offlineAccess: false }])

    const ios = fakeBridge()
    assert.equal(await acquireGoogleIdToken(ios.bridge, "ios", ids), "jwt")
    assert.equal(ios.calls.playServices, 0)
  })

  it("maps a cancelled response and a cancelled error to the same message", async () => {
    const cancelledResponse = fakeBridge({ signIn: async () => ({ type: "cancelled", data: null }) })
    await assert.rejects(() => acquireGoogleIdToken(cancelledResponse.bridge, "android", ids), {
      message: GOOGLE_SIGN_IN_CANCELLED,
    })

    const cancelledError = fakeBridge({
      signIn: async () => {
        throw new Error("user cancelled")
      },
      isCancelledError: () => true,
    })
    await assert.rejects(() => acquireGoogleIdToken(cancelledError.bridge, "ios", ids), {
      message: GOOGLE_SIGN_IN_CANCELLED,
    })
  })

  it("fails when the SDK returns no ID token and when the platform is unconfigured", async () => {
    const noToken = fakeBridge({ signIn: async () => ({ type: "success", data: { idToken: null } }) })
    await assert.rejects(() => acquireGoogleIdToken(noToken.bridge, "android", ids), {
      message: GOOGLE_SIGN_IN_FAILED,
    })

    const unconfigured = fakeBridge()
    await assert.rejects(() => acquireGoogleIdToken(unconfigured.bridge, "ios", { googleWebClientId: "web" }), {
      message: GOOGLE_SIGN_IN_UNCONFIGURED,
    })
  })

  it("propagates non-cancellation failures", async () => {
    const failing = fakeBridge({
      signIn: async () => {
        throw new Error("DEVELOPER_ERROR")
      },
    })
    await assert.rejects(() => acquireGoogleIdToken(failing.bridge, "android", ids), {
      message: "DEVELOPER_ERROR",
    })
  })
})

describe("restoreGoogleIdToken", () => {
  it("returns a silently restored token on both platforms", async () => {
    assert.equal(await restoreGoogleIdToken(fakeBridge().bridge, "android", ids), "silent-jwt")
    assert.equal(await restoreGoogleIdToken(fakeBridge().bridge, "ios", ids), "silent-jwt")
  })

  it("returns null when nothing is saved, the SDK throws, or the platform is unconfigured", async () => {
    const noCredential = fakeBridge({ signInSilently: async () => ({ type: "noSavedCredentialFound", data: null }) })
    assert.equal(await restoreGoogleIdToken(noCredential.bridge, "android", ids), null)

    const throwing = fakeBridge({
      signInSilently: async () => {
        throw new Error("offline")
      },
    })
    assert.equal(await restoreGoogleIdToken(throwing.bridge, "android", ids), null)
    assert.equal(await restoreGoogleIdToken(fakeBridge().bridge, "ios", {}), null)
  })
})

describe("signOutGoogleSession", () => {
  it("signs out on both platforms and swallows SDK failures", async () => {
    const android = fakeBridge()
    await signOutGoogleSession(android.bridge, "android", ids)
    assert.equal(android.calls.signedOut, 1)

    const ios = fakeBridge()
    await signOutGoogleSession(ios.bridge, "ios", ids)
    assert.equal(ios.calls.signedOut, 1)

    const throwing = fakeBridge({
      signOut: async () => {
        throw new Error("network")
      },
    })
    await signOutGoogleSession(throwing.bridge, "android", ids)
  })
})
