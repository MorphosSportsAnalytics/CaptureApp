import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatAlertCreatedAt,
  mapPortalAlert,
  mapPortalAlerts,
  parseNotificationPayload,
  unreadPortalAlerts,
  videoDetailPath,
  withoutAlertIds,
} from "./portalNotifications.js"

describe("portalNotifications", () => {
  it("parses object and JSON payloads", () => {
    assert.deepEqual(parseNotificationPayload({ submissionId: "s1" }), { submissionId: "s1" })
    assert.deepEqual(parseNotificationPayload('{"submission_id":"s2"}'), { submission_id: "s2" })
    assert.equal(parseNotificationPayload("not-json"), null)
    assert.equal(parseNotificationPayload("[]"), null)
    assert.equal(parseNotificationPayload([]), null)
    assert.equal(parseNotificationPayload(42), null)
    assert.equal(parseNotificationPayload(null), null)
  })

  it("maps API rows without exposing type constants in the alert", () => {
    const alert = mapPortalAlert({
      id: "n1",
      type: "video_analysis_complete",
      title: "Analysis complete",
      body: "Stats are ready",
      payload_json: { submissionId: "vid-1", href: "/athletes/x/videos" },
      read_at: null,
      created_at: "2026-08-25T12:00:00.000Z",
    })
    assert.equal(alert?.id, "n1")
    assert.equal(alert?.title, "Analysis complete")
    assert.equal(alert?.videoSubmissionId, "vid-1")
    assert.equal(alert?.readAt, null)
    assert.equal(videoDetailPath(alert!), "/videos/vid-1")
  })

  it("treats persisted read_at as dismissed on every client", () => {
    const read = mapPortalAlert({
      id: "n2",
      title: "Done",
      read_at: "2026-08-25T13:00:00.000Z",
    })
    assert.equal(read?.readAt, "2026-08-25T13:00:00.000Z")
    assert.deepEqual(unreadPortalAlerts([read!]), [])
    assert.deepEqual(
      withoutAlertIds([read!], ["n2"]).map((a) => a.id),
      [],
    )
  })

  it("skips invalid rows and accepts camelCase", () => {
    assert.equal(mapPortalAlert({ title: "No id" }), null)
    const alerts = mapPortalAlerts([
      { id: "ok", title: "Hello", payloadJson: { submission_id: "s9" }, createdAt: "t" },
      null,
      "x",
    ])
    assert.equal(alerts.length, 1)
    assert.equal(alerts[0]?.videoSubmissionId, "s9")
    assert.equal(mapPortalAlerts(null).length, 0)
  })

  it("formats created times and ignores invalid dates", () => {
    assert.equal(formatAlertCreatedAt("", "en-CA"), "")
    assert.equal(formatAlertCreatedAt("not-a-date", "en-CA"), "")
    assert.match(formatAlertCreatedAt("2026-08-25T13:00:00.000Z", "en-CA"), /2026/)
  })
})
