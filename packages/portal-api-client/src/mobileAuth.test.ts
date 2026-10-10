import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getMobileAppleAuthConfig, getMobileGoogleAuthConfig, signInWithAppleIdentityToken, signInWithGoogleIdToken } from "./mobileAuth.js"

describe("mobileAuth client", () => {
  it("getMobileGoogleAuthConfig parses the web and iOS client ids", async () => {
    const res = await getMobileGoogleAuthConfig("https://api.example.com", async () =>
      new Response(
        JSON.stringify({
          clientId: "web.apps.googleusercontent.com",
          iosClientId: "ios.apps.googleusercontent.com",
        }),
        { status: 200 },
      ),
    )
    assert.equal(res.ok, true)
    if (res.ok) {
      assert.equal(res.data.clientId, "web.apps.googleusercontent.com")
      assert.equal(res.data.iosClientId, "ios.apps.googleusercontent.com")
    }
  })

  it("getMobileGoogleAuthConfig tolerates a missing iOS client id", async () => {
    const res = await getMobileGoogleAuthConfig("https://api.example.com", async () =>
      new Response(JSON.stringify({ clientId: "web.apps.googleusercontent.com" }), { status: 200 }),
    )
    assert.equal(res.ok, true)
    if (res.ok) assert.equal(res.data.iosClientId, null)
  })

  it("getMobileGoogleAuthConfig succeeds when AbortSignal.timeout is missing", async () => {
    const original = Object.getOwnPropertyDescriptor(AbortSignal, "timeout")
    Object.defineProperty(AbortSignal, "timeout", {
      value: undefined,
      configurable: true,
      writable: true,
    })
    try {
      const res = await getMobileGoogleAuthConfig("https://api.example.com", async () =>
        new Response(JSON.stringify({ clientId: "web.apps.googleusercontent.com" }), { status: 200 }),
      )
      assert.equal(res.ok, true)
    } finally {
      if (original) Object.defineProperty(AbortSignal, "timeout", original)
    }
  })

  it("getMobileGoogleAuthConfig returns unavailable when fetch throws", async () => {
    const res = await getMobileGoogleAuthConfig("https://api.example.com", async () => {
      throw new Error("Failed to connect")
    })
    assert.equal(res.ok, false)
    if (!res.ok) {
      assert.equal(res.status, 0)
      assert.match(res.error, /Failed to connect/)
    }
  })

  it("signInWithGoogleIdToken posts idToken", async () => {
    let body = ""
    const res = await signInWithGoogleIdToken("https://api.example.com", "id-token", async (_url, init) => {
      body = String(init?.body ?? "")
      return new Response(
        JSON.stringify({
          bearerToken: "bearer",
          expiresAt: 123,
          sessionExpSec: 86400,
          user: { id: "u1", email: "a@b.com", role: "athlete", displayName: "A" },
        }),
        { status: 200 },
      )
    })
    assert.equal(res.ok, true)
    assert.match(body, /id-token/)
  })

  it("getMobileAppleAuthConfig parses bundle id and optional Services ID", async () => {
    const res = await getMobileAppleAuthConfig("https://api.example.com", async () =>
      new Response(
        JSON.stringify({ bundleId: "com.morphosanalytics.capture", clientId: "com.morphos.web" }),
        { status: 200 },
      ),
    )
    assert.equal(res.ok, true)
    if (res.ok) {
      assert.equal(res.data.bundleId, "com.morphosanalytics.capture")
      assert.equal(res.data.clientId, "com.morphos.web")
    }
  })

  it("getMobileAppleAuthConfig treats a blank Services ID as null", async () => {
    const res = await getMobileAppleAuthConfig("https://api.example.com", async () =>
      new Response(JSON.stringify({ bundleId: "com.morphosanalytics.capture", clientId: "" }), { status: 200 }),
    )
    assert.equal(res.ok, true)
    if (res.ok) assert.equal(res.data.clientId, null)
  })

  it("signInWithAppleIdentityToken posts identityToken", async () => {
    let body = ""
    const res = await signInWithAppleIdentityToken("https://api.example.com", "apple-jwt", async (_url, init) => {
      body = String(init?.body ?? "")
      return new Response(
        JSON.stringify({
          bearerToken: "bearer",
          expiresAt: 123,
          sessionExpSec: 86400,
          user: { id: "u1", email: "a@b.com", role: "athlete", displayName: "A" },
        }),
        { status: 200 },
      )
    })
    assert.equal(res.ok, true)
    assert.match(body, /apple-jwt/)
  })

  it("getMobileAppleAuthConfig returns unavailable when fetch throws", async () => {
    const res = await getMobileAppleAuthConfig("https://api.example.com", async () => {
      throw new Error("Failed to connect")
    })
    assert.equal(res.ok, false)
    if (!res.ok) {
      assert.equal(res.status, 0)
      assert.match(res.error, /Failed to connect/)
    }
  })

  it("getMobileAppleAuthConfig rejects a response without bundle id", async () => {
    const res = await getMobileAppleAuthConfig("https://api.example.com", async () =>
      new Response(JSON.stringify({ clientId: "com.morphos.web" }), { status: 200 }),
    )
    assert.equal(res.ok, false)
  })

  it("signInWithAppleIdentityToken rejects a body without a bearer", async () => {
    const res = await signInWithAppleIdentityToken("https://api.example.com", "apple-jwt", async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    assert.equal(res.ok, false)
  })
})
