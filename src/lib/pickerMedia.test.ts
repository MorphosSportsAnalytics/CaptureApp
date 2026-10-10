import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pickerDurationSeconds, pickerRecordedAtMs } from "./pickerMedia"

describe("pickerDurationSeconds", () => {
  it("keeps duration already reported in seconds", () => {
    assert.equal(pickerDurationSeconds(90), 90)
  })

  it("returns 0 for missing duration", () => {
    assert.equal(pickerDurationSeconds(null), 0)
    assert.equal(pickerDurationSeconds(0), 0)
  })
})

describe("pickerRecordedAtMs", () => {
  it("parses EXIF DateTimeOriginal", () => {
    const ms = pickerRecordedAtMs({ exif: { DateTimeOriginal: "2026:08:21 18:00:00" } })
    assert.ok(Number.isFinite(ms))
    assert.ok(ms > 1_700_000_000_000)
  })
})
