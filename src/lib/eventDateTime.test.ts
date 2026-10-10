process.env.TZ = "America/Toronto"

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatEventDate, parseApiInstant } from "./eventDateTime.js"

describe("eventDateTime", () => {
  it("parseApiInstant treats naive MySQL DATETIME as UTC", () => {
    assert.equal(parseApiInstant("2026-08-28 19:15:00.000"), Date.parse("2026-08-28T19:15:00.000Z"))
  })

  it("formatEventDate formats UTC ISO in local timezone", () => {
    const formatted = formatEventDate("2026-08-28T19:15:00.000Z")
    assert.match(formatted, /Aug 28/)
    assert.match(formatted, /3:15|15:15/)
  })
})
