import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { portalAuthHeaders, portalFetch, portalJson } from "./fetch.js"

async function withMissingAbortSignalTimeout(fn: () => Promise<void>): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(AbortSignal, "timeout")
  Object.defineProperty(AbortSignal, "timeout", {
    value: undefined,
    configurable: true,
    writable: true,
  })
  try {
    await fn()
  } finally {
    if (original) Object.defineProperty(AbortSignal, "timeout", original)
  }
}

describe("portalFetch", () => {
  it("attaches auth headers and succeeds without AbortSignal.timeout", async () => {
    await withMissingAbortSignalTimeout(async () => {
      let url = ""
      let auth = ""
      const fetchImpl: typeof fetch = async (input, init) => {
        url = String(input)
        auth = new Headers(init?.headers).get("authorization") ?? ""
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      const res = await portalFetch(
        { baseUrl: "https://api.example.com/", bearerToken: " tok ", fetchImpl },
        "v1/portal/my-profile",
      )
      assert.equal(url, "https://api.example.com/v1/portal/my-profile")
      assert.equal(auth, "Bearer tok")
      assert.equal(res.status, 200)
    })
  })

  it("remints the bearer and retries once after 401", async () => {
    const statuses: number[] = []
    const tokens: string[] = []
    const fetchImpl: typeof fetch = async (_input, init) => {
      const token = new Headers(init?.headers).get("authorization") ?? ""
      tokens.push(token)
      if (token === "Bearer burned") {
        statuses.push(401)
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
      }
      statuses.push(200)
      return new Response(JSON.stringify({ row: { id: "a1" } }), { status: 200 })
    }
    const cfg = {
      baseUrl: "https://api.example.com",
      bearerToken: "burned",
      fetchImpl,
      onUnauthorized: async () => "fresh",
    }
    const res = await portalJson<{ row: { id: string } }>(cfg, "/v1/portal/my-profile")
    assert.deepEqual(statuses, [401, 200])
    assert.deepEqual(tokens, ["Bearer burned", "Bearer fresh"])
    assert.equal(cfg.bearerToken, "fresh")
    assert.equal(res.ok, true)
    if (res.ok) assert.equal(res.data.row.id, "a1")
  })

  it("does not retry 401 when remint returns nothing", async () => {
    let calls = 0
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }
    const res = await portalFetch(
      {
        baseUrl: "https://api.example.com",
        bearerToken: "burned",
        fetchImpl,
        onUnauthorized: async () => null,
      },
      "/v1/portal/my-videos",
    )
    assert.equal(calls, 1)
    assert.equal(res.status, 401)
  })

  it("honors a caller-provided abort signal", async () => {
    const controller = new AbortController()
    let passed: AbortSignal | undefined
    const fetchImpl: typeof fetch = async (_input, init) => {
      passed = init?.signal ?? undefined
      return new Response("{}", { status: 200 })
    }
    await portalFetch(
      { baseUrl: "https://api.example.com", bearerToken: "t", fetchImpl },
      "/v1/x",
      { signal: controller.signal },
    )
    assert.equal(passed, controller.signal)
  })
})

describe("portalJson", () => {
  it("returns parsed JSON on success", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ arenas: [] }), { status: 200 })
    const res = await portalJson<{ arenas: unknown[] }>(
      { baseUrl: "https://api.example.com", bearerToken: "t", fetchImpl },
      "/v1/sport-arenas/for-submit",
    )
    assert.equal(res.ok, true)
    if (res.ok) assert.deepEqual(res.data, { arenas: [] })
  })

  it("surfaces API error strings and invalid JSON bodies", async () => {
    const errImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: "no venues" }), { status: 403 })
    const err = await portalJson({ baseUrl: "https://api.example.com", bearerToken: "t", fetchImpl: errImpl }, "/v1/x")
    assert.equal(err.ok, false)
    if (!err.ok) {
      assert.equal(err.status, 403)
      assert.equal(err.error, "no venues")
    }

    const rawImpl: typeof fetch = async () => new Response("not-json", { status: 500 })
    const raw = await portalJson({ baseUrl: "https://api.example.com", bearerToken: "t", fetchImpl: rawImpl }, "/v1/x")
    assert.equal(raw.ok, false)
    if (!raw.ok) assert.equal(raw.error, "Request failed (500)")
  })
})

describe("portalAuthHeaders", () => {
  it("trims the bearer token", () => {
    const headers = portalAuthHeaders("  abc  ")
    assert.equal(headers.Authorization, "Bearer abc")
  })
})
