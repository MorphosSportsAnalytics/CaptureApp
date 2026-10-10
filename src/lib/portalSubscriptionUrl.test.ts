import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { portalSubscriptionUrl } from "./portalSubscriptionUrl"

describe("portalSubscriptionUrl", () => {
  it("includes athlete lane and id when present", () => {
    const url = portalSubscriptionUrl("https://portal.morphosanalytics.com/", "ath-1")
    assert.equal(
      url,
      "https://portal.morphosanalytics.com/subscription?utm_source=morphos_capture&lane=athlete&athleteId=ath-1",
    )
  })

  it("falls back to /subscription without athlete id", () => {
    const url = portalSubscriptionUrl("https://portal.morphosanalytics.com", "")
    assert.equal(url, "https://portal.morphosanalytics.com/subscription?utm_source=morphos_capture")
  })
})
