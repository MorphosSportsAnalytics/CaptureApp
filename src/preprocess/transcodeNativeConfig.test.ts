import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("morphos video transcode native module", () => {
  it("is a file dependency autolinked for iOS and Android", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      dependencies: Record<string, string>
    }
    assert.equal(pkg.dependencies["morphos-video-transcode"], "file:./modules/morphos-video-transcode")
    const modulePkg = JSON.parse(
      readFileSync(new URL("../../modules/morphos-video-transcode/package.json", import.meta.url), "utf8"),
    ) as { name: string }
    assert.equal(modulePkg.name, "morphos-video-transcode")
    const podspec = readFileSync(
      new URL("../../modules/morphos-video-transcode/MorphosVideoTranscode.podspec", import.meta.url),
      "utf8",
    )
    assert.match(podspec, /s\.dependency "React-Core"/)
    assert.doesNotMatch(podspec, /ExpoModulesCore/)
    const androidPkg = readFileSync(
      new URL(
        "../../modules/morphos-video-transcode/android/src/main/java/com/morphos/videotranscode/MorphosVideoTranscodePackage.kt",
        import.meta.url,
      ),
      "utf8",
    )
    assert.match(androidPkg, /MorphosVideoTranscodePackage/)
  })

  it("caps both OS encoders at 1080p H.264 with fps control", () => {
    const ios = readFileSync(
      new URL("../../modules/morphos-video-transcode/ios/MorphosVideoTranscodeModule.swift", import.meta.url),
      "utf8",
    )
    const android = readFileSync(
      new URL(
        "../../modules/morphos-video-transcode/android/src/main/java/com/morphos/videotranscode/MorphosVideoTranscodeModule.kt",
        import.meta.url,
      ),
      "utf8",
    )
    assert.match(ios, /fallback: 1920/)
    assert.match(ios, /fallback: 1080/)
    assert.match(ios, /frameDuration = CMTime\(value: 1, timescale: CMTimeScale\(fps\)\)/)
    assert.match(ios, /outputFileType = \.mp4/)
    assert.match(android, /intOf\(options, "width", 1920\)/)
    assert.match(android, /intOf\(options, "height", 1080\)/)
    assert.match(android, /MimeTypes\.VIDEO_H264/)
    assert.match(android, /FrameDropEffect\.createDefaultFrameDropEffect/)
    assert.match(android, /METADATA_KEY_VIDEO_ROTATION/)
  })

  it("applies preferredTransform to a CGRect so rotated iOS video keeps origin compensation", () => {
    const ios = readFileSync(
      new URL("../../modules/morphos-video-transcode/ios/MorphosVideoTranscodeModule.swift", import.meta.url),
      "utf8",
    )
    assert.doesNotMatch(ios, /naturalSize\.applying/)
    assert.match(ios, /CGRect\(origin: \.zero, size: track\.naturalSize\)\.applying\(track\.preferredTransform\)/)
    assert.match(ios, /transform\.tx -= transformed\.origin\.x/)
    assert.match(ios, /transform\.ty -= transformed\.origin\.y/)
  })
})
