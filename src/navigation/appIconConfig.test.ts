import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("app icon config", () => {
  it("targets iOS and Android only so Metro does not web-bundle", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      dependencies: Record<string, string>
      devDependencies?: Record<string, string>
    }
    assert.equal(pkg.dependencies["react-native-web"], undefined)
    assert.equal(pkg.devDependencies?.["react-native-web"], undefined)
  })

  it("keeps Morphos icon assets for iOS and Android", () => {
    const colors = readFileSync(
      new URL("../../android/app/src/main/res/values/colors.xml", import.meta.url),
      "utf8",
    )
    assert.match(colors, /#0f172a/)
    assert.ok(existsSync(new URL("../../assets/icon.png", import.meta.url)))
    assert.ok(existsSync(new URL("../../assets/adaptive-icon.png", import.meta.url)))
    assert.ok(existsSync(new URL("../../assets/splash-icon.png", import.meta.url)))
  })

  it("committed icon PNGs exist at 1024x1024", () => {
    for (const rel of ["assets/icon.png", "assets/adaptive-icon.png", "assets/splash-icon.png"] as const) {
      const path = new URL(`../../${rel}`, import.meta.url)
      assert.ok(existsSync(path), `missing ${rel}`)
      const png = readFileSync(path)
      assert.ok(png.length > 1000, `${rel} looks empty`)
      const width = png.readUInt32BE(16)
      const height = png.readUInt32BE(20)
      assert.equal(width, 1024)
      assert.equal(height, 1024)
    }
  })

  it("Android launcher mipmaps were generated for all densities", () => {
    const densities = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"] as const
    for (const density of densities) {
      const launcher = readFileSync(
        new URL(`../../android/app/src/main/res/mipmap-${density}/ic_launcher.webp`, import.meta.url),
      )
      assert.ok(launcher.length > 400, `ic_launcher.webp missing for ${density}`)
      assert.equal(launcher.subarray(0, 4).toString(), "RIFF")
      assert.equal(launcher.subarray(8, 12).toString(), "WEBP")
    }
  })
})
