import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PortalApiError } from "@morphos/portal-api-client"
import { getMobileMessages } from "@morphos/mobile-i18n"
import { portalLoadErrorMessage } from "./portalLoadError.js"

describe("portalLoadErrorMessage", () => {
  const messages = getMobileMessages("en-CA")

  it("maps 401 and Unauthorized text to the session-expired copy", () => {
    const unauthorized = new PortalApiError(401, { error: "Unauthorized" }, "Unauthorized")
    assert.equal(portalLoadErrorMessage(unauthorized, messages), messages.errors.sessionExpired)
    assert.equal(portalLoadErrorMessage(new Error("Unauthorized"), messages), messages.errors.sessionExpired)
  })

  it("maps other failures to the network copy", () => {
    const forbidden = new PortalApiError(403, { error: "Forbidden" }, "Forbidden")
    assert.equal(portalLoadErrorMessage(forbidden, messages), messages.errors.network)
    assert.equal(portalLoadErrorMessage(new Error("boom"), messages), messages.errors.network)
    assert.equal(portalLoadErrorMessage("x", messages), messages.errors.network)
  })
})
