import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { withTimeout } from "./withTimeout.js"

describe("withTimeout", () => {
  it("resolves with promise result when fast", async () => {
    const value = await withTimeout(Promise.resolve("ok"), 50, "fallback")
    assert.equal(value, "ok")
  })

  it("returns fallback when promise is slow", async () => {
    const value = await withTimeout(
      new Promise<string>((resolve) => setTimeout(() => resolve("late"), 200)),
      20,
      "fallback",
    )
    assert.equal(value, "fallback")
  })
})
