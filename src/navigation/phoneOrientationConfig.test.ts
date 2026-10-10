import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("phone orientation config", () => {
  it("iOS Info.plist allows portrait and landscape", () => {
    const plist = readFileSync(new URL("../../ios/MorphosCapture/Info.plist", import.meta.url), "utf8")
    assert.match(plist, /UIInterfaceOrientationPortrait/)
    assert.match(plist, /UIInterfaceOrientationLandscapeLeft/)
  })

  it("Android manifest does not lock MainActivity to landscape", () => {
    const manifest = readFileSync(
      new URL("../../android/app/src/main/AndroidManifest.xml", import.meta.url),
      "utf8",
    )
    assert.match(manifest, /android:screenOrientation="unspecified"/)
    assert.doesNotMatch(manifest, /android:screenOrientation="landscape"/)
  })
})
