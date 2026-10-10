import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { createRequire } from "node:module"

describe("React Native CLI build config", () => {
  it("does not ship eas-cli or Expo SDK packages", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      dependencies: Record<string, string>
      devDependencies?: Record<string, string>
      scripts: Record<string, string>
    }
    assert.equal(pkg.dependencies.expo, undefined)
    assert.equal(pkg.dependencies["expo-router"], undefined)
    assert.equal(pkg.dependencies["expo-constants"], undefined)
    assert.equal(pkg.devDependencies?.["eas-cli"], undefined)
    assert.equal(pkg.dependencies["react-native-msal"], undefined)
    assert.equal(pkg.dependencies["@react-native-picker/picker"], "2.9.0")
    assert.match(pkg.scripts.start, /react-native start/)
    assert.match(pkg.scripts.ios, /react-native run-ios/)
    assert.match(pkg.scripts.android, /react-native run-android/)
    assert.match(pkg.scripts["android:assemble:release"], /assembleRelease/)
    assert.match(pkg.scripts.test, /test:bundle/)
    assert.equal(existsSync(new URL("../../eas.json", import.meta.url)), false)
    assert.equal(existsSync(new URL("../../app.config.js", import.meta.url)), false)
  })

  it("commits iOS and Android native projects", () => {
    assert.ok(existsSync(new URL("../../android/settings.gradle", import.meta.url)))
    assert.ok(existsSync(new URL("../../ios/MorphosCapture.xcodeproj/project.pbxproj", import.meta.url)))
    const gitignore = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8")
    assert.match(gitignore, /android\/local\.properties/)
  })

  it("pins iOS bundle id and tablet family", () => {
    const pbx = readFileSync(
      new URL("../../ios/MorphosCapture.xcodeproj/project.pbxproj", import.meta.url),
      "utf8",
    )
    assert.match(pbx, /PRODUCT_BUNDLE_IDENTIFIER = com.morphosanalytics.capture/)
    assert.match(pbx, /TARGETED_DEVICE_FAMILY = "1,2"/)
    const plist = readFileSync(new URL("../../ios/MorphosCapture/Info.plist", import.meta.url), "utf8")
    assert.match(plist, /morphoscapture/)
    assert.match(plist, /NSPhotoLibraryUsageDescription/)
    assert.match(plist, /NSLocationWhenInUseUsageDescription/)
  })

  it("loads Metro with the shared-packages watch folder", () => {
    const requireFromApp = createRequire(new URL("../../package.json", import.meta.url))
    const config = requireFromApp("./metro.config.js") as { watchFolders?: string[] }
    assert.ok(Array.isArray(config.watchFolders))
    assert.ok(config.watchFolders?.some((folder) => folder.endsWith(`${require("node:path").sep}packages`)))
  })

  it("links morphoscapture and the portal App Link host", () => {
    const linking = readFileSync(new URL("./linking.ts", import.meta.url), "utf8")
    assert.match(linking, /morphoscapture:\/\//)
    assert.match(linking, /https:\/\/portal\.morphosanalytics\.com/)
    const tabs = readFileSync(new URL("./TabNavigator.tsx", import.meta.url), "utf8")
    assert.match(tabs, /tabBarButton: \(\) => null/)
  })
})
