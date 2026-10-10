import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { googleNativeUrlScheme } from "./auth/googleNativeRedirect"
import { generatedBuildConfig } from "./generated/buildConfig"

describe("Google sign-in native config", () => {
  it("bakes the iOS reverse-DNS URL scheme into Info.plist", () => {
    const plist = readFileSync(new URL("../ios/MorphosCapture/Info.plist", import.meta.url), "utf8")
    const scheme = googleNativeUrlScheme(generatedBuildConfig.googleIosClientId ?? "")
    assert.ok(scheme)
    assert.match(plist, new RegExp(scheme.replace(/\./g, "\\.")))
    assert.match(plist, /GIDClientID/)
  })

  it("needs no Android URL scheme, since Android authenticates by package name and SHA-1", () => {
    const manifest = readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8")
    assert.equal(manifest.includes("com.googleusercontent.apps."), false)
    assert.match(manifest, /android:scheme="morphoscapture"/)
    assert.doesNotMatch(manifest, /exp\+morphos-capture/)
  })

  it("keeps the Android web client id available for the ID token audience", () => {
    assert.match(String(generatedBuildConfig.googleWebClientId), /\.apps\.googleusercontent\.com$/)
  })
})
