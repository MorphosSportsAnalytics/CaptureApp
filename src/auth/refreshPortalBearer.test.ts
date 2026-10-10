import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createRefreshPortalBearer,
  refreshPortalBearerOnce,
  type RefreshPortalBearerDeps,
} from "./refreshPortalBearer.js"

function deps(overrides: Partial<RefreshPortalBearerDeps> = {}): RefreshPortalBearerDeps {
  return {
    loadAuthMethod: async () => "google",
    persistGoogleSession: async () => undefined,
    persistMicrosoftSession: async () => undefined,
    persistAppleSession: async () => undefined,
    restoreGoogleIdToken: async () => "id-token",
    acquireMicrosoftSilent: async () => null,
    exchangeGoogleIdToken: async () => ({ bearerToken: "fresh-bearer", expiresAt: 99 }),
    ...overrides,
  }
}

describe("refreshPortalBearerOnce", () => {
  it("exchanges a Google ID token for a new Portal bearer", async () => {
    const persisted: Array<{ bearerToken: string; expiresAt: number }> = []
    const token = await refreshPortalBearerOnce(
      deps({
        persistGoogleSession: async (params) => {
          persisted.push(params)
        },
      }),
    )
    assert.equal(token, "fresh-bearer")
    assert.deepEqual(persisted, [{ bearerToken: "fresh-bearer", expiresAt: 99 }])
  })

  it("returns null when Google restore or exchange fails", async () => {
    assert.equal(await refreshPortalBearerOnce(deps({ restoreGoogleIdToken: async () => null })), null)
    assert.equal(await refreshPortalBearerOnce(deps({ exchangeGoogleIdToken: async () => null })), null)
  })

  it("refreshes a Microsoft access token", async () => {
    const persisted: Array<{ accessToken: string }> = []
    const token = await refreshPortalBearerOnce(
      deps({
        loadAuthMethod: async () => "microsoft",
        acquireMicrosoftSilent: async () => ({ accessToken: "ms-access", refreshToken: "r", expiresAt: 1 }),
        persistMicrosoftSession: async (params) => {
          persisted.push({ accessToken: params.accessToken })
        },
      }),
    )
    assert.equal(token, "ms-access")
    assert.deepEqual(persisted, [{ accessToken: "ms-access" }])
  })

  it("does not silently remint Apple sessions (Apple has no silent identity token)", async () => {
    assert.equal(await refreshPortalBearerOnce(deps({ loadAuthMethod: async () => "apple" })), null)
  })
})

describe("createRefreshPortalBearer", () => {
  it("single-flights concurrent remints", async () => {
    let exchanges = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const refresh = createRefreshPortalBearer(
      deps({
        exchangeGoogleIdToken: async () => {
          exchanges += 1
          await gate
          return { bearerToken: "once", expiresAt: 1 }
        },
      }),
    )
    const first = refresh()
    const second = refresh()
    release()
    assert.deepEqual(await Promise.all([first, second]), ["once", "once"])
    assert.equal(exchanges, 1)
  })
})
