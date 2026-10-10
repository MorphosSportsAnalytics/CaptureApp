import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getMobileMessages } from "@morphos/mobile-i18n"
import { venueLocationFailureMessage } from "./venueLocationMessage.js"

describe("venueLocationFailureMessage", () => {
  const messages = getMobileMessages("en-CA")

  it("maps permissionDenied to locationNeeded", () => {
    assert.equal(venueLocationFailureMessage(messages, "permissionDenied"), messages.metadata.locationNeeded)
  })

  it("maps servicesDisabled to locationServicesOff", () => {
    assert.equal(venueLocationFailureMessage(messages, "servicesDisabled"), messages.metadata.locationServicesOff)
  })

  it("maps unavailable to locationUnavailable", () => {
    assert.equal(venueLocationFailureMessage(messages, "unavailable"), messages.metadata.locationUnavailable)
  })
})
