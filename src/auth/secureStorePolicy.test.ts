import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

describe("secureStorePolicy", () => {
  it("uses device-only keychain accessibility for auth secrets", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./secureStorePolicy.ts", import.meta.url)),
      "utf8",
    )
    assert.match(src, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/)
    assert.match(src, /AUTH_SECURE_STORE_OPTIONS/)
  })
})
