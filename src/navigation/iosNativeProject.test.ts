import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

describe("committed iOS Xcode project", () => {
  it("enables Apple Sign In and associated domains", () => {
    const entitlements = readFileSync(
      new URL("../../ios/MorphosCapture/MorphosCapture.entitlements", import.meta.url),
      "utf8",
    )
    assert.match(entitlements, /com\.apple\.developer\.applesignin/)
    assert.match(entitlements, /applinks:portal\.morphosanalytics\.com/)
    const pbx = readFileSync(
      new URL("../../ios/MorphosCapture.xcodeproj/project.pbxproj", import.meta.url),
      "utf8",
    )
    assert.match(pbx, /CODE_SIGN_ENTITLEMENTS = MorphosCapture\/MorphosCapture.entitlements/)
  })

  it("keeps the Google reverse-DNS scheme and GIDClientID", () => {
    const plist = readFileSync(new URL("../../ios/MorphosCapture/Info.plist", import.meta.url), "utf8")
    assert.match(plist, /GIDClientID/)
    assert.match(plist, /com\.googleusercontent\.apps\./)
    const appDelegate = readFileSync(new URL("../../ios/MorphosCapture/AppDelegate.mm", import.meta.url), "utf8")
    assert.match(appDelegate, /GIDSignIn/)
    assert.match(appDelegate, /RCTLinkingManager/)
  })

  it("CI compiles unsigned iOS and Gradle Android without EAS", () => {
    const workflowPath = fileURLToPath(new URL("../../.github/workflows/ci.yml", import.meta.url))
    assert.equal(existsSync(workflowPath), true)
    const yml = readFileSync(workflowPath, "utf8")
    assert.doesNotMatch(yml, /eas-build-ios/)
    assert.doesNotMatch(yml, /eas-cli/)
    assert.doesNotMatch(yml, /EXPO_TOKEN/)
    assert.doesNotMatch(yml, /self-hosted/)
    assert.doesNotMatch(yml, /npm --prefix MobileApp/)
    assert.match(yml, /android:assemble:release/)
    assert.match(yml, /npm run test/)
    assert.match(yml, /macos-latest/)
    assert.match(yml, /CODE_SIGNING_ALLOWED=NO/)
  })
})
