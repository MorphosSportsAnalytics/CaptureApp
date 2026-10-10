import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  friendlyMicrosoftSignInError,
  interpolateRedirectMessage,
  isMicrosoftRedirectUriError,
  microsoftApiScopes,
  microsoftCodeExchangeBody,
  microsoftDiscovery,
  microsoftPromptErrorMessage,
  microsoftRefreshBody,
  microsoftScopes,
  microsoftSignInScopes,
  parseMicrosoftTokenJson,
  postMicrosoftToken,
  redirectUriFromAuthorizeUrl,
} from "./microsoftToken"

describe("microsoft token helpers", () => {
  it("builds Entra v2 discovery URLs and scopes", () => {
    assert.deepEqual(microsoftDiscovery("common"), {
      authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    })
    assert.deepEqual(microsoftSignInScopes(), ["openid", "profile", "email", "offline_access"])
    assert.deepEqual(microsoftScopes(), ["openid", "profile", "email", "offline_access"])
    assert.deepEqual(microsoftApiScopes("api://portal/portal.read"), [
      "openid",
      "profile",
      "email",
      "offline_access",
      "api://portal/portal.read",
    ])
  })

  it("builds authorization-code and refresh token bodies", () => {
    const code = microsoftCodeExchangeBody({
      clientId: "client",
      code: "abc",
      redirectUri: "morphoscapture://auth",
      codeVerifier: "pkce",
    })
    assert.equal(code.get("grant_type"), "authorization_code")
    assert.equal(code.get("code_verifier"), "pkce")
    assert.equal(code.get("redirect_uri"), "morphoscapture://auth")

    const refresh = microsoftRefreshBody({
      clientId: "client",
      refreshToken: "rt",
      scope: microsoftApiScopes("api://portal/portal.read").join(" "),
    })
    assert.equal(refresh.get("grant_type"), "refresh_token")
    assert.equal(refresh.get("refresh_token"), "rt")
    assert.equal(refresh.get("scope"), "openid profile email offline_access api://portal/portal.read")
  })

  it("maps Microsoft redirect_uri failures to the Capture copy", () => {
    assert.equal(
      isMicrosoftRedirectUriError(
        "invalid_request: The provided value for the input parameter 'redirect_uri' is not valid.",
      ),
      true,
    )
    assert.equal(
      friendlyMicrosoftSignInError(
        new Error("invalid_request: The provided value for the input parameter 'redirect_uri' is not valid."),
        "Sign-in failed.",
        "Capture redirect is not registered.",
      ),
      "Capture redirect is not registered.",
    )
    assert.equal(microsoftPromptErrorMessage({ type: "cancel" }), "Sign-in was cancelled.")
    assert.equal(
      microsoftPromptErrorMessage({
        type: "error",
        params: {
          error: "invalid_request",
          error_description: "The provided value for the input parameter 'redirect_uri' is not valid.",
        },
      }),
      "invalid_request: The provided value for the input parameter 'redirect_uri' is not valid.",
    )
    assert.equal(
      redirectUriFromAuthorizeUrl(
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?redirect_uri=morphoscapture%3A%2F%2Fauth",
        "fallback://x",
      ),
      "morphoscapture://auth",
    )
    assert.equal(
      interpolateRedirectMessage("Register {uri} in Entra.", "morphoscapture://auth"),
      "Register morphoscapture://auth in Entra.",
    )
  })

  it("parses access and refresh tokens and computes expiry", () => {
    const tokens = parseMicrosoftTokenJson({
      access_token: " at ",
      refresh_token: " rt ",
      expires_in: 3600,
    })
    assert.equal(tokens.accessToken, "at")
    assert.equal(tokens.refreshToken, "rt")
    assert.ok(tokens.expiresAt && tokens.expiresAt > Math.floor(Date.now() / 1000) + 3500)
  })

  it("rejects a token payload without access_token", () => {
    assert.throws(() => parseMicrosoftTokenJson({ token_type: "Bearer" }), /No access token/)
    assert.throws(() => parseMicrosoftTokenJson(null), /No access token/)
  })

  it("posts a token request and parses a successful JSON body", async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const tokens = await postMicrosoftToken(
      "https://login.example/token",
      new URLSearchParams({ grant_type: "refresh_token" }),
      (async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} })
        return {
          ok: true,
          json: async () => ({ access_token: "tok", refresh_token: "rt2", expires_in: 60 }),
        } as Response
      }) as typeof fetch,
    )
    assert.equal(tokens.accessToken, "tok")
    assert.equal(tokens.refreshToken, "rt2")
    assert.equal(calls[0]?.url, "https://login.example/token")
    assert.equal(calls[0]?.init.method, "POST")
  })

  it("throws when the token endpoint is not ok", async () => {
    await assert.rejects(
      () =>
        postMicrosoftToken(
          "https://login.example/token",
          new URLSearchParams(),
          (async () => ({ ok: false, json: async () => ({ error: "invalid_grant" }) }) as Response) as typeof fetch,
        ),
      /No access token/,
    )
  })
})
