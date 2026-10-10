import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const gradle = readFileSync(fileURLToPath(new URL("../android/build.gradle", import.meta.url)), "utf8")
const settings = readFileSync(fileURLToPath(new URL("../android/settings.gradle", import.meta.url)), "utf8")

describe("android MSAL display-mask resolution", () => {
  it("does not declare the Duo SDK Maven feed after removing react-native-msal", () => {
    assert.doesNotMatch(
      gradle,
      /https:\/\/pkgs\.dev\.azure\.com\/MicrosoftDeviceSDK\/DuoSDK-Public\/_packaging\/Duo-SDK-Feed\/maven\/v1/,
    )
    assert.doesNotMatch(gradle, /com\.microsoft\.device\.display/)
    assert.doesNotMatch(gradle, /Msal_compileSdkVersion/)
  })
})

describe("android Gradle project identity", () => {
  it("uses morphos-capture as rootProject.name so Gradle paths have no spaces", () => {
    assert.match(settings, /rootProject\.name\s*=\s*['"]morphos-capture['"]/)
    assert.doesNotMatch(settings, /rootProject\.name\s*=\s*['"]Morphos Capture['"]/)
  })
})
