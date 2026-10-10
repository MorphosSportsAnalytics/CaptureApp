import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { fetchWithTimeout } from "./timeout.js"

async function withAbortSignalTimeout(
  value: typeof AbortSignal.timeout | undefined,
  fn: () => Promise<void>,
): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(AbortSignal, "timeout")
  Object.defineProperty(AbortSignal, "timeout", {
    value,
    configurable: true,
    writable: true,
  })
  try {
    await fn()
  } finally {
    if (original) Object.defineProperty(AbortSignal, "timeout", original)
    else delete (AbortSignal as { timeout?: unknown }).timeout
  }
}

describe("fetchWithTimeout", () => {
  it("uses AbortSignal.timeout when the runtime provides it", async () => {
    let timeoutMs = 0
    let passedSignal: AbortSignal | undefined
    const native = AbortSignal.timeout.bind(AbortSignal)
    await withAbortSignalTimeout((ms) => {
      timeoutMs = ms
      return native(ms)
    }, async () => {
      const fetchImpl: typeof fetch = async (_url, init) => {
        passedSignal = init?.signal ?? undefined
        return new Response("ok", { status: 200 })
      }
      const res = await fetchWithTimeout(fetchImpl, "https://example.com", {}, 1_500)
      assert.equal(res.status, 200)
      assert.equal(timeoutMs, 1_500)
      assert.equal(passedSignal?.aborted, false)
    })
  })

  it("falls back to AbortController when AbortSignal.timeout is missing", async () => {
    await withAbortSignalTimeout(undefined, async () => {
      assert.equal(typeof AbortSignal.timeout, "undefined")
      let passedSignal: AbortSignal | undefined
      const fetchImpl: typeof fetch = async (_url, init) => {
        passedSignal = init?.signal ?? undefined
        return new Response("ok", { status: 200 })
      }
      const res = await fetchWithTimeout(fetchImpl, "https://example.com", {}, 20_000)
      assert.equal(res.status, 200)
      assert.equal(passedSignal instanceof AbortSignal, true)
      assert.equal(passedSignal?.aborted, false)
    })
  })

  it("aborts a hung request via the AbortController fallback", async () => {
    await withAbortSignalTimeout(undefined, async () => {
      const fetchImpl: typeof fetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted")
            err.name = "AbortError"
            reject(err)
          })
        })
      await assert.rejects(() => fetchWithTimeout(fetchImpl, "https://example.com", {}, 20), (err: unknown) => {
        assert.equal(err instanceof Error, true)
        assert.equal((err as Error).name, "AbortError")
        return true
      })
    })
  })

  it("keeps a caller-provided signal and does not attach a timeout", async () => {
    const controller = new AbortController()
    let passedSignal: AbortSignal | undefined
    const fetchImpl: typeof fetch = async (_url, init) => {
      passedSignal = init?.signal ?? undefined
      return new Response("ok", { status: 200 })
    }
    await fetchWithTimeout(fetchImpl, "https://example.com", { signal: controller.signal }, 5)
    assert.equal(passedSignal, controller.signal)
  })

  it("clears the fallback timer when fetch throws synchronously", async () => {
    await withAbortSignalTimeout(undefined, async () => {
      const fetchImpl: typeof fetch = () => {
        throw new Error("boom")
      }
      await assert.rejects(() => fetchWithTimeout(fetchImpl, "https://example.com", {}, 20_000), /boom/)
    })
  })
})
