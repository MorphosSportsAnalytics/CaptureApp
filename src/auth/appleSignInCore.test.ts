import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  APPLE_SIGN_IN_CANCELLED,
  APPLE_SIGN_IN_FAILED,
  APPLE_SIGN_IN_UNAVAILABLE,
  acquireAppleIdentityToken,
  appleWebAuthorizeUrl,
  friendlyAppleSignInError,
  identityTokenFromAppleResult,
  type AppleSignInBridge,
} from "./appleSignInCore"

function fakeBridge(overrides: Partial<AppleSignInBridge> = {}) {
  const calls: { native: number; web: string[] } = { native: 0, web: [] }
  const bridge: AppleSignInBridge = {
    isNativeAvailable: async () => true,
    signInNative: async () => {
      calls.native += 1
      return { identityToken: "apple-jwt" }
    },
    openWebAuthSession: async (authorizeUrl) => {
      calls.web.push(authorizeUrl)
      return { type: "success", url: "https://portal.morphosanalytics.com/capture/auth#id_token=web-jwt" }
    },
    isCancelledError: () => false,
    randomState: () => "state-1",
    ...overrides,
  }
  return { bridge, calls }
}

describe("appleWebAuthorizeUrl", () => {
  it("builds Apple's authorize URL without name or email scope so fragment mode is allowed", () => {
    const url = appleWebAuthorizeUrl({
      clientId: "com.morphos.web",
      redirectUri: "https://portal.morphosanalytics.com/capture/auth",
      state: "abc",
    })
    assert.match(url, /^https:\/\/appleid\.apple\.com\/auth\/authorize\?/)
    assert.match(url, /client_id=com\.morphos\.web/)
    assert.match(url, /response_type=id_token/)
    assert.match(url, /response_mode=fragment/)
    assert.doesNotMatch(url, /scope=/)
  })
})

describe("identityTokenFromAppleResult", () => {
  it("trims the identity token and rejects blanks", () => {
    assert.equal(identityTokenFromAppleResult({ identityToken: " jwt " }), "jwt")
    assert.equal(identityTokenFromAppleResult({ identityToken: null }), null)
    assert.equal(identityTokenFromAppleResult({ identityToken: "  " }), null)
  })
})

describe("acquireAppleIdentityToken", () => {
  it("uses native Sign in with Apple when the OS API is available", async () => {
    const { bridge, calls } = fakeBridge()
    const token = await acquireAppleIdentityToken(bridge, {
      webClientId: "com.morphos.web",
      redirectUri: "https://portal.example/capture/auth",
      parseIdentityTokenFromUrl: () => "should-not-use",
    })
    assert.equal(token, "apple-jwt")
    assert.equal(calls.native, 1)
    assert.equal(calls.web.length, 0)
  })

  it("falls back to Apple web OAuth when native Sign in with Apple is unavailable", async () => {
    const { bridge, calls } = fakeBridge({
      isNativeAvailable: async () => false,
    })
    const token = await acquireAppleIdentityToken(bridge, {
      webClientId: "com.morphos.web",
      redirectUri: "https://portal.morphosanalytics.com/capture/auth",
      parseIdentityTokenFromUrl: (url) => {
        assert.match(url, /id_token=web-jwt/)
        return "web-jwt"
      },
    })
    assert.equal(token, "web-jwt")
    assert.equal(calls.native, 0)
    assert.equal(calls.web.length, 1)
    assert.match(calls.web[0] ?? "", /client_id=com\.morphos\.web/)
  })

  it("maps native cancel, web cancel, and cancelled errors", async () => {
    await assert.rejects(
      () =>
        acquireAppleIdentityToken(fakeBridge({ signInNative: async () => ({ identityToken: null, cancelled: true }) }).bridge, {
          redirectUri: "https://portal.example/capture/auth",
          parseIdentityTokenFromUrl: () => null,
        }),
      { message: APPLE_SIGN_IN_CANCELLED },
    )

    await assert.rejects(
      () =>
        acquireAppleIdentityToken(
          fakeBridge({
            isNativeAvailable: async () => false,
            openWebAuthSession: async () => ({ type: "cancel" }),
          }).bridge,
          {
            webClientId: "com.morphos.web",
            redirectUri: "https://portal.example/capture/auth",
            parseIdentityTokenFromUrl: () => null,
          },
        ),
      { message: APPLE_SIGN_IN_CANCELLED },
    )

    await assert.rejects(
      () =>
        acquireAppleIdentityToken(
          fakeBridge({
            signInNative: async () => {
              throw new Error("ERR_REQUEST_CANCELED")
            },
            isCancelledError: () => true,
          }).bridge,
          {
            redirectUri: "https://portal.example/capture/auth",
            parseIdentityTokenFromUrl: () => null,
          },
        ),
      { message: APPLE_SIGN_IN_CANCELLED },
    )
  })

  it("fails when native returns no token, web has no Services ID, or the return URL has no token", async () => {
    await assert.rejects(
      () =>
        acquireAppleIdentityToken(fakeBridge({ signInNative: async () => ({ identityToken: null }) }).bridge, {
          redirectUri: "https://portal.example/capture/auth",
          parseIdentityTokenFromUrl: () => null,
        }),
      { message: APPLE_SIGN_IN_FAILED },
    )

    await assert.rejects(
      () =>
        acquireAppleIdentityToken(fakeBridge({ isNativeAvailable: async () => false }).bridge, {
          webClientId: "  ",
          redirectUri: "https://portal.example/capture/auth",
          parseIdentityTokenFromUrl: () => null,
        }),
      { message: APPLE_SIGN_IN_UNAVAILABLE },
    )

    await assert.rejects(
      () =>
        acquireAppleIdentityToken(fakeBridge({ isNativeAvailable: async () => false }).bridge, {
          webClientId: "com.morphos.web",
          redirectUri: "https://portal.example/capture/auth",
          parseIdentityTokenFromUrl: () => null,
        }),
      { message: APPLE_SIGN_IN_FAILED },
    )
  })
})

describe("friendlyAppleSignInError", () => {
  it("maps the unavailable sentinel and empty errors", () => {
    assert.equal(friendlyAppleSignInError(new Error(APPLE_SIGN_IN_UNAVAILABLE), "fallback", "unavailable"), "unavailable")
    assert.equal(friendlyAppleSignInError("", "fallback", "unavailable"), "fallback")
    assert.equal(friendlyAppleSignInError(new Error("network"), "fallback", "unavailable"), "network")
  })
})
