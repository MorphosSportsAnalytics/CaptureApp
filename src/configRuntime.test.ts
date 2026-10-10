import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { DEFAULT_MSAL_CLIENT_ID } from "./buildExtra"

const root = new URL("../", import.meta.url)

describe("runtime build config", () => {
  it("merges generated defaults with env in config.ts", () => {
    const generated = readFileSync(new URL("src/generated/buildConfig.ts", root), "utf8")
    assert.match(generated, new RegExp(DEFAULT_MSAL_CLIENT_ID))
    assert.match(generated, /b8d3dc3c-5589-460e-af7e-30a2e6b46bbb/)
    const config = readFileSync(new URL("src/config.ts", root), "utf8")
    assert.match(config, /mergeBuildExtra/)
    assert.match(config, /generatedBuildConfig/)
    assert.doesNotMatch(config, /expo-constants/)
  })
})
