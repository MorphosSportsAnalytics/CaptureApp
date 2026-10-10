import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createDeviceTranscoder, type NativeTranscodeModule } from "./transcodeDevice"

function mockNative(overrides?: Partial<NativeTranscodeModule>): NativeTranscodeModule {
  return {
    probe: async () => ({ width: 1920, height: 1080, fps: 30, bitrateKbps: 4000, codec: "avc1" }),
    encode: async (options) => ({ outputUri: options.outputUri }),
    cancel: () => undefined,
    addListener: () => ({ remove: () => undefined }),
    ...overrides,
  }
}

describe("createDeviceTranscoder", () => {
  it("builds a cache output uri", () => {
    const t = createDeviceTranscoder(mockNative(), { cacheDirectory: "file:///cache/" })
    assert.match(t.createOutputUri(), /^file:\/\/\/cache\/morphos-transcode-\d+\.mp4$/)
  })

  it("uses a file uri prefix when cache is missing", () => {
    const t = createDeviceTranscoder(mockNative(), { cacheDirectory: null })
    assert.match(t.createOutputUri(), /^file:\/\/\/morphos-transcode-\d+\.mp4$/)
  })

  it("forwards probe and encode", async () => {
    const native = mockNative()
    const t = createDeviceTranscoder(native, { cacheDirectory: "file:///cache" })
    const probe = await t.probe("file:///in.mp4")
    assert.equal(probe.width, 1920)
    const out = await t.encode({
      inputUri: "file:///in.mp4",
      outputUri: "file:///out.mp4",
      width: 1920,
      height: 1080,
      fps: 30,
      bitrateKbps: 5000,
    })
    assert.equal(out.outputUri, "file:///out.mp4")
  })

  it("reports progress and cancels on abort", async () => {
    const abort = new AbortController()
    let progress = 0
    const native: NativeTranscodeModule = {
      probe: async () => ({ width: 1, height: 1, fps: 30, bitrateKbps: 1, codec: "h264" }),
      encode: async () => {
        abort.abort()
        throw new Error("native fail")
      },
      cancel: () => undefined,
      addListener: (_event, listener) => {
        listener({ progress: 0.4 })
        return { remove: () => undefined }
      },
    }
    const t = createDeviceTranscoder(native, { cacheDirectory: "file:///cache/" })
    await assert.rejects(
      () =>
        t.encode({
          inputUri: "file:///in.mp4",
          outputUri: "file:///out.mp4",
          width: 1920,
          height: 1080,
          fps: 30,
          bitrateKbps: 5000,
          onProgress: (p) => {
            progress = p
          },
          signal: abort.signal,
        }),
      /cancelled/,
    )
    assert.equal(progress, 0.4)
  })

  it("throws cancelled when already aborted", async () => {
    const abort = new AbortController()
    abort.abort()
    let encoded = false
    const t = createDeviceTranscoder(
      mockNative({
        encode: async () => {
          encoded = true
          return { outputUri: "file:///out.mp4" }
        },
      }),
      { cacheDirectory: "file:///cache/" },
    )
    await assert.rejects(
      () =>
        t.encode({
          inputUri: "file:///in.mp4",
          outputUri: "file:///out.mp4",
          width: 1920,
          height: 1080,
          fps: 30,
          bitrateKbps: 5000,
          signal: abort.signal,
        }),
      /cancelled/,
    )
    assert.equal(encoded, false)
  })

  it("wraps non-Error encode failures", async () => {
    const t = createDeviceTranscoder(
      mockNative({
        encode: async () => {
          throw "boom"
        },
      }),
      { cacheDirectory: "file:///cache/" },
    )
    await assert.rejects(
      () =>
        t.encode({
          inputUri: "file:///in.mp4",
          outputUri: "file:///out.mp4",
          width: 1920,
          height: 1080,
          fps: 30,
          bitrateKbps: 5000,
        }),
      /Couldn't prepare this video for upload/,
    )
  })
})
