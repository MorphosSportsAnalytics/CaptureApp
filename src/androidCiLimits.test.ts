import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const limits = require("../scripts/android-ci-limits.cjs") as {
  CI_ANDROID_ABI: string
  CI_CMAKE_PARALLEL: string
  CI_GRADLE_WORKERS: string
  CI_GRADLE_PROPERTIES: Record<string, string>
  PREVIEW_LOCAL_GRADLE_COMMAND: string
  truthyEnv: (value: unknown) => boolean
  ciLimitsEnabled: (env?: Record<string, string | undefined>) => boolean
  applyCiLimitEnv: (env?: Record<string, string | undefined>) => Record<string, string | undefined>
}

describe("android CI native-compile limits", () => {
  it("treats 1/true/yes as enabled flags", () => {
    assert.equal(limits.truthyEnv("1"), true)
    assert.equal(limits.truthyEnv("TRUE"), true)
    assert.equal(limits.truthyEnv("yes"), true)
    assert.equal(limits.truthyEnv(""), false)
    assert.equal(limits.truthyEnv("0"), false)
    assert.equal(limits.truthyEnv(undefined), false)
  })

  it("enables limits for GitHub Actions and the explicit flag", () => {
    assert.equal(limits.ciLimitsEnabled(), false)
    assert.equal(limits.ciLimitsEnabled({}), false)
    assert.equal(limits.ciLimitsEnabled({ MORPHOS_ANDROID_CI_LIMITS: "1" }), true)
    assert.equal(limits.ciLimitsEnabled({ GITHUB_ACTIONS: "true" }), true)
  })

  it("applies arm64-only Gradle env when limits are on", () => {
    const env = limits.applyCiLimitEnv({ MORPHOS_ANDROID_CI_LIMITS: "1" })
    assert.equal(env.ORG_GRADLE_PROJECT_reactNativeArchitectures, limits.CI_ANDROID_ABI)
    assert.equal(env.CMAKE_BUILD_PARALLEL_LEVEL, limits.CI_CMAKE_PARALLEL)
    assert.equal(env.NINJAFLAGS, `-j${limits.CI_CMAKE_PARALLEL}`)
    assert.match(String(env.GRADLE_OPTS), /org\.gradle\.workers\.max=2/)
  })

  it("skips assembleRelease vital lint on CI", () => {
    assert.match(limits.PREVIEW_LOCAL_GRADLE_COMMAND, /:app:assembleRelease/)
    assert.match(limits.PREVIEW_LOCAL_GRADLE_COMMAND, /lintVitalRelease/)
  })

  it("workflow sets the CI ABI limit env", () => {
    const workflowPath = new URL("../.github/workflows/ci.yml", import.meta.url)
    assert.equal(existsSync(workflowPath), true)
    const workflow = readFileSync(workflowPath, "utf8")
    assert.match(workflow, /MORPHOS_ANDROID_CI_LIMITS: "1"/)
    assert.match(workflow, /ORG_GRADLE_PROJECT_reactNativeArchitectures: arm64-v8a/)
    assert.match(workflow, /android:assemble:release/)
    assert.match(workflow, /ubuntu-latest/)
    assert.doesNotMatch(workflow, /eas-cli/)
    assert.doesNotMatch(workflow, /eas-build-ios/)
    assert.doesNotMatch(workflow, /EXPO_TOKEN/)
    assert.doesNotMatch(workflow, /self-hosted/)
  })
})
