import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("android native codegen before CMake", () => {
  it("keeps configureCMake dependent on generateCodegenArtifactsFromSchema", () => {
    const gradle = readFileSync(new URL("../android/app/build.gradle", import.meta.url), "utf8")
    assert.match(gradle, /morphosNativeCodegenBeforeCmake/)
    assert.match(gradle, /generateCodegenArtifactsFromSchema/)
    assert.match(gradle, /configureCMake/)
  })
})
