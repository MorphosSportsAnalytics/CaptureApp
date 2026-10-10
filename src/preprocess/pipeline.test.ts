import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runPreprocessPipeline, VIDEO_TOO_LONG, type VideoTranscoder } from "./pipeline"

function mockTranscoder(opts?: {
  probe?: VideoTranscoder["probe"]
  encode?: VideoTranscoder["encode"]
}): VideoTranscoder {
  return {
    probe:
      opts?.probe ??
      (async () => ({ width: 1280, height: 720, fps: 30, bitrateKbps: 2500, codec: "avc1" })),
    encode:
      opts?.encode ??
      (async (input) => {
        throw new Error(`encode should not run for ${input.inputUri}`)
      }),
    createOutputUri: () => "file:///out.mp4",
  }
}

describe("runPreprocessPipeline", () => {
  it("rejects clips longer than the plan max without probing", async () => {
    let probed = false
    const result = await runPreprocessPipeline({
      inputUri: "file:///clip.mp4",
      sourceDurationSeconds: 400,
      maxDurationSeconds: 300,
      transcode: mockTranscoder({
        probe: async () => {
          probed = true
          return { width: 1920, height: 1080, fps: 30, bitrateKbps: 4000, codec: "h264" }
        },
      }),
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, VIDEO_TOO_LONG)
    assert.equal(probed, false)
  })

  it("rejects unreadable duration", async () => {
    const result = await runPreprocessPipeline({
      inputUri: "file:///clip.mp4",
      sourceDurationSeconds: 0,
      maxDurationSeconds: 300,
      transcode: mockTranscoder(),
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /duration/)
  })

  it("fails closed when no transcoder is available", async () => {
    const result = await runPreprocessPipeline({
      inputUri: "file:///clip.mp4",
      sourceDurationSeconds: 90,
      maxDurationSeconds: 300,
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /unavailable/)
  })

  it("passthrough-uploads 720p H.264 already within the 1080p cap", async () => {
    const result = await runPreprocessPipeline({
      inputUri: "file:///clip.mp4",
      sourceDurationSeconds: 90,
      maxDurationSeconds: 300,
      capture: { eventKind: "game" },
      transcode: mockTranscoder(),
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.outputUri, "file:///clip.mp4")
      assert.equal(result.sidecar.transcode.width, 1280)
      assert.equal(result.sidecar.transcode.height, 720)
      assert.equal(result.sidecar.transcode.fps, 30)
      assert.equal(result.qcPassed, true)
    }
  })

  it("encodes 4K 60fps games to 1080p30", async () => {
    const encoded: number[] = []
    const result = await runPreprocessPipeline({
      inputUri: "file:///game4k.mp4",
      sourceDurationSeconds: 90,
      maxDurationSeconds: 300,
      skillClipMode: false,
      transcode: mockTranscoder({
        probe: async (uri) =>
          uri === "file:///out.mp4"
            ? { width: 1920, height: 1080, fps: 30, bitrateKbps: 4900, codec: "avc1" }
            : { width: 3840, height: 2160, fps: 60, bitrateKbps: 20000, codec: "h264" },
        encode: async (input) => {
          encoded.push(input.fps, input.width, input.height)
          return { outputUri: input.outputUri }
        },
      }),
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.outputUri, "file:///out.mp4")
      assert.notEqual(result.outputUri, "file:///game4k.mp4")
      assert.equal(result.sidecar.transcode.width, 1920)
      assert.equal(result.sidecar.transcode.fps, 30)
    }
    assert.deepEqual(encoded, [30, 1920, 1080])
  })

  it("keeps 60fps when encoding 4K skill clips", async () => {
    const result = await runPreprocessPipeline({
      inputUri: "file:///skill4k.mp4",
      sourceDurationSeconds: 40,
      maxDurationSeconds: 300,
      skillClipMode: true,
      transcode: mockTranscoder({
        probe: async (uri) =>
          uri.includes("out")
            ? { width: 1920, height: 1080, fps: 60, bitrateKbps: 5000, codec: "avc1" }
            : { width: 3840, height: 2160, fps: 60, bitrateKbps: 18000, codec: "h264" },
        encode: async (input) => {
          assert.equal(input.fps, 60)
          return { outputUri: input.outputUri }
        },
      }),
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.outputUri, "file:///out.mp4")
      assert.equal(result.sidecar.transcode.fps, 60)
    }
  })

  it("uses planned transcode when output probe fails", async () => {
    const result = await runPreprocessPipeline({
      inputUri: "file:///hevc.mp4",
      sourceDurationSeconds: 20,
      maxDurationSeconds: 300,
      transcode: mockTranscoder({
        probe: async (uri) => {
          if (uri.includes("out")) throw new Error("probe output failed")
          return { width: 1920, height: 1080, fps: 30, bitrateKbps: 4000, codec: "hvc1" }
        },
        encode: async (input) => ({ outputUri: input.outputUri }),
      }),
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.outputUri, "file:///out.mp4")
      assert.equal(result.sidecar.transcode.codec, "h264")
      assert.equal(result.sidecar.transcode.width, 1920)
    }
  })

  it("fails closed when encode throws and does not upload the original", async () => {
    const result = await runPreprocessPipeline({
      inputUri: "file:///game4k.mp4",
      sourceDurationSeconds: 90,
      maxDurationSeconds: 300,
      transcode: mockTranscoder({
        probe: async () => ({ width: 3840, height: 2160, fps: 30, bitrateKbps: 12000, codec: "h264" }),
        encode: async () => {
          throw new Error("encoder exploded")
        },
      }),
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error, "encoder exploded")
      assert.notEqual(result.code, VIDEO_TOO_LONG)
    }
  })

  it("returns cancelled when abort fires before encode", async () => {
    const abort = new AbortController()
    abort.abort()
    const result = await runPreprocessPipeline({
      inputUri: "file:///game4k.mp4",
      sourceDurationSeconds: 90,
      maxDurationSeconds: 300,
      signal: abort.signal,
      transcode: mockTranscoder({
        probe: async () => ({ width: 3840, height: 2160, fps: 30, bitrateKbps: 12000, codec: "h264" }),
        encode: async () => ({ outputUri: "file:///should-not.mp4" }),
      }),
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.error, "cancelled")
  })

  it("maps cancelled encode errors", async () => {
    const result = await runPreprocessPipeline({
      inputUri: "file:///game4k.mp4",
      sourceDurationSeconds: 90,
      maxDurationSeconds: 300,
      transcode: mockTranscoder({
        probe: async () => ({ width: 3840, height: 2160, fps: 30, bitrateKbps: 12000, codec: "h264" }),
        encode: async () => {
          throw new Error("cancelled")
        },
      }),
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.error, "cancelled")
  })

  it("fails closed when probe throws a non-Error", async () => {
    const result = await runPreprocessPipeline({
      inputUri: "file:///clip.mp4",
      sourceDurationSeconds: 90,
      maxDurationSeconds: 300,
      transcode: mockTranscoder({
        probe: async () => {
          throw "nope"
        },
      }),
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.error, "Preprocess failed")
  })

  it("fills sidecar transcode from the plan when output probe is empty", async () => {
    const result = await runPreprocessPipeline({
      inputUri: "file:///hevc.mp4",
      sourceDurationSeconds: 20,
      maxDurationSeconds: 300,
      transcode: mockTranscoder({
        probe: async (uri) => {
          if (uri.includes("out")) return { width: 0, height: 0, fps: 0, bitrateKbps: 0, codec: "  " }
          return { width: 1920, height: 1080, fps: 30, bitrateKbps: 4000, codec: "hvc1" }
        },
        encode: async (input) => ({ outputUri: input.outputUri }),
      }),
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.sidecar.transcode.codec, "h264")
      assert.equal(result.sidecar.transcode.width, 1920)
      assert.equal(result.sidecar.transcode.height, 1080)
      assert.equal(result.sidecar.transcode.fps, 30)
      assert.equal(result.sidecar.transcode.bitrateKbps, 4000)
    }
  })
})
