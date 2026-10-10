import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  capOutputSize,
  evenDimension,
  isH264Codec,
  maxOutputFps,
  planTranscode,
  RECOMMENDED_OUTPUT_PROFILE,
  SKILL_CLIP_MAX_FPS,
} from "./transcodePlan.js"

describe("transcodePlan", () => {
  it("recommends 1080p H.264 at 5000 kbps 30fps", () => {
    assert.equal(RECOMMENDED_OUTPUT_PROFILE.codec, "h264")
    assert.equal(RECOMMENDED_OUTPUT_PROFILE.width, 1920)
    assert.equal(RECOMMENDED_OUTPUT_PROFILE.height, 1080)
    assert.equal(RECOMMENDED_OUTPUT_PROFILE.fps, 30)
    assert.equal(RECOMMENDED_OUTPUT_PROFILE.bitrateKbps, 5000)
  })

  it("caps 4K landscape to 1920x1080 without upscaling 720p", () => {
    assert.deepEqual(capOutputSize(3840, 2160), { width: 1920, height: 1080 })
    assert.deepEqual(capOutputSize(1280, 720), { width: 1280, height: 720 })
  })

  it("caps 4K portrait to 1080x1920", () => {
    assert.deepEqual(capOutputSize(2160, 3840), { width: 1080, height: 1920 })
    assert.deepEqual(capOutputSize(1080, 1920), { width: 1080, height: 1920 })
  })

  it("skips H.264 720p that is already within the cap", () => {
    const plan = planTranscode(
      { width: 1280, height: 720, fps: 30, bitrateKbps: 2500, codec: "avc1" },
      { skillClipMode: false },
    )
    assert.equal(plan.action, "skip")
    assert.equal(plan.output.width, 1280)
    assert.equal(plan.output.height, 720)
    assert.equal(plan.output.fps, 30)
    assert.equal(plan.output.bitrateKbps, 2500)
  })

  it("encodes 4K 60fps games to 1080p30", () => {
    const plan = planTranscode(
      { width: 3840, height: 2160, fps: 60, bitrateKbps: 20000, codec: "h264" },
      { skillClipMode: false },
    )
    assert.equal(plan.action, "encode")
    assert.equal(plan.output.width, 1920)
    assert.equal(plan.output.height, 1080)
    assert.equal(plan.output.fps, 30)
    assert.equal(plan.output.bitrateKbps, 5000)
    assert.equal(plan.output.codec, "h264")
  })

  it("keeps up to 60fps on skill clips when capping 4K", () => {
    assert.equal(maxOutputFps(true), SKILL_CLIP_MAX_FPS)
    const plan = planTranscode(
      { width: 3840, height: 2160, fps: 60, bitrateKbps: 20000, codec: "h264" },
      { skillClipMode: true },
    )
    assert.equal(plan.action, "encode")
    assert.equal(plan.output.fps, 60)
    assert.equal(plan.output.width, 1920)
  })

  it("encodes HEVC 1080p to H.264 even when size already fits", () => {
    const plan = planTranscode(
      { width: 1920, height: 1080, fps: 30, bitrateKbps: 4000, codec: "hvc1" },
      { skillClipMode: false },
    )
    assert.equal(plan.action, "encode")
    assert.equal(plan.output.codec, "h264")
    assert.equal(isH264Codec("hvc1"), false)
    assert.equal(isH264Codec("hev1"), false)
    assert.equal(isH264Codec("h265"), false)
    assert.equal(isH264Codec("avc1"), true)
    assert.equal(isH264Codec(""), true)
  })

  it("encodes 1080p60 games to drop fps to 30", () => {
    const plan = planTranscode(
      { width: 1920, height: 1080, fps: 60, bitrateKbps: 5000, codec: "h264" },
      { skillClipMode: false },
    )
    assert.equal(plan.action, "encode")
    assert.equal(plan.output.fps, 30)
    assert.equal(plan.output.width, 1920)
  })

  it("skips 1080p60 skill clips that are already H.264 within bitrate", () => {
    const plan = planTranscode(
      { width: 1920, height: 1080, fps: 60, bitrateKbps: 5000, codec: "h264" },
      { skillClipMode: true },
    )
    assert.equal(plan.action, "skip")
    assert.equal(plan.output.fps, 60)
  })

  it("treats missing fps and bitrate as the recommended defaults without upscaling 720p", () => {
    const plan = planTranscode(
      { width: 1280, height: 720, fps: 0, bitrateKbps: 0, codec: "" },
      { skillClipMode: false },
    )
    assert.equal(plan.action, "skip")
    assert.equal(plan.output.fps, 30)
    assert.equal(plan.output.bitrateKbps, 5000)
  })

  it("rounds odd dimensions down to even values", () => {
    assert.equal(evenDimension(1081), 1080)
    assert.equal(evenDimension(0), 2)
    assert.deepEqual(capOutputSize(0, 0), { width: 1920, height: 1080 })
  })
})
