import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { LinkableUploadEvent } from "@morphos/portal-api-client"
import {
  eventLinkIfPickerChanged,
  eventLinksEqual,
  mergePrefilledLinkableEvent,
  parsePickerValue,
  pickerValue,
  shouldApplyPickerValueChange,
  type EventLinkSelection,
} from "./eventLinkSelection.js"

function event(over: Partial<LinkableUploadEvent> & Pick<LinkableUploadEvent, "id" | "kind">): LinkableUploadEvent {
  return {
    title: "Evening skate",
    startsAt: null,
    eventKind: "practice",
    sportArenaId: "arena-1",
    coachKitKind: null,
    teamId: "team-1",
    teamName: "U15",
    dcId: null,
    ...over,
  }
}

const manual: EventLinkSelection = { mode: "manual" }
const linked: EventLinkSelection = {
  mode: "linked",
  kind: "team",
  id: "evt-1",
  eventKind: "practice",
  sportArenaId: "arena-1",
}

const pickerEvents = [event({ id: "evt-1", kind: "team" }), event({ id: "dc-1", kind: "dc", eventKind: "scrimmage" })]

describe("eventLinkSelection", () => {

  it("serializes picker values", () => {
    assert.equal(pickerValue(manual), "manual")
    assert.equal(pickerValue(linked), "team:evt-1")
  })

  it("parses picker values including invalid raw strings", () => {
    assert.deepEqual(parsePickerValue("", pickerEvents), { mode: "manual" })
    assert.deepEqual(parsePickerValue("manual", pickerEvents), { mode: "manual" })
    assert.deepEqual(parsePickerValue("nocolon", pickerEvents), { mode: "manual" })
    assert.deepEqual(parsePickerValue(":evt-1", pickerEvents), { mode: "manual" })
    assert.deepEqual(parsePickerValue("team:missing", pickerEvents), { mode: "manual" })
    assert.deepEqual(parsePickerValue("team:evt-1", pickerEvents), linked)
    const dc = parsePickerValue("dc:dc-1", pickerEvents)
    assert.equal(dc.mode, "linked")
    if (dc.mode === "linked") {
      assert.equal(dc.kind, "dc")
      assert.equal(dc.eventKind, "scrimmage")
    }
  })

  it("treats equivalent event-link objects as equal", () => {
    assert.equal(eventLinksEqual(manual, { mode: "manual" }), true)
    assert.equal(eventLinksEqual(manual, linked), false)
    assert.equal(eventLinksEqual(linked, { ...linked }), true)
    assert.equal(eventLinksEqual(linked, { ...linked, id: "evt-2" }), false)
    assert.equal(eventLinksEqual(linked, { ...linked, kind: "dc" }), false)
    assert.equal(eventLinksEqual(linked, { ...linked, eventKind: "game" }), false)
    assert.equal(eventLinksEqual(linked, { ...linked, sportArenaId: "arena-2" }), false)
  })

  it("does not emit onChange when the picker repeats the current value", () => {
    assert.equal(eventLinkIfPickerChanged(manual, "manual", pickerEvents), null)
    assert.equal(eventLinkIfPickerChanged(linked, "team:evt-1", pickerEvents), null)
    const next = eventLinkIfPickerChanged(manual, "team:evt-1", pickerEvents)
    assert.deepEqual(next, linked)
  })
})

describe("prefilled calendar event", () => {
  it("ignores a native picker reset to manual while the linked event is still loading", () => {
    assert.equal(
      shouldApplyPickerValueChange({
        loading: true,
        current: linked,
        raw: "manual",
        events: [],
      }),
      false,
    )
    assert.equal(
      shouldApplyPickerValueChange({
        loading: false,
        current: linked,
        raw: "manual",
        events: [],
      }),
      false,
    )
    assert.equal(
      shouldApplyPickerValueChange({
        loading: false,
        current: linked,
        raw: "manual",
        events: pickerEvents,
      }),
      true,
    )
  })

  it("inserts the prefilled event so the picker can display it before the API returns", () => {
    const merged = mergePrefilledLinkableEvent([], linked, {
      title: "AA - U14 practice",
      startsAt: "2026-08-25T22:00:00.000Z",
      teamId: "team-1",
    })
    assert.equal(merged.length, 1)
    assert.equal(merged[0]?.id, "evt-1")
    assert.equal(merged[0]?.title, "AA - U14 practice")
    assert.deepEqual(mergePrefilledLinkableEvent(pickerEvents, linked), pickerEvents)
  })
})
