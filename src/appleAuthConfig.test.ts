import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("Sign in with Apple config", () => {
  it("enables the Apple Sign In entitlement for Capture", () => {
    const entitlements = readFileSync(
      new URL("../ios/MorphosCapture/MorphosCapture.entitlements", import.meta.url),
      "utf8",
    )
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      dependencies: Record<string, string>
    }
    assert.match(entitlements, /com\.apple\.developer\.applesignin/)
    assert.ok(pkg.dependencies["@invertase/react-native-apple-authentication"])
  })

  it("shows Sign in with Apple on the same screen as Google and Microsoft, on both OS", () => {
    const src = readFileSync(new URL("./screens/SignInScreen.tsx", import.meta.url), "utf8")
    assert.match(src, /signInWithApple/)
    assert.match(src, /messages\.auth\.signInWithApple/)
    assert.match(src, /messages\.auth\.signInWithGoogle/)
    assert.match(src, /messages\.auth\.signInWithMicrosoft/)
    assert.doesNotMatch(src, /Platform\.OS/)
  })
})
