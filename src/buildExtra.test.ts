import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_MSAL_CLIENT_ID,
  DEFAULT_MSAL_PORTAL_API_SCOPE,
  DEFAULT_PORTAL_API_URL,
  DEFAULT_GOOGLE_WEB_CLIENT_ID,
  mergeBuildExtra,
  PLACEHOLDER_MSAL_PORTAL_API_SCOPE,
  validatePhoneBuildExtra,
} from "./buildExtra"

describe("mergeBuildExtra", () => {
  it("prefers unprefixed env then EXPO_PUBLIC_* over bundled extra", () => {
    const merged = mergeBuildExtra(
      {
        portalApiUrl: "http://localhost:3002",
        msalClientId: "",
        msalPortalApiScope: "api://old/portal.read",
      },
      {
        EXPO_PUBLIC_PORTAL_API_URL: "https://api.morphosanalytics.com/",
        EXPO_PUBLIC_MSAL_CLIENT_ID: "client-id",
        EXPO_PUBLIC_MSAL_PORTAL_API_SCOPE: "api://new/portal.read",
      },
    )
    assert.equal(merged.portalApiUrl, "https://api.morphosanalytics.com")
    assert.equal(merged.portalWebUrl, "https://portal.morphosanalytics.com")
    assert.equal(merged.msalClientId, "client-id")
    assert.equal(merged.msalPortalApiScope, "api://new/portal.read")
  })

  it("prefers PORTAL_WEB_URL over the default portal origin", () => {
    const merged = mergeBuildExtra({}, { PORTAL_WEB_URL: "https://portal.example.com/" })
    assert.equal(merged.portalWebUrl, "https://portal.example.com")
  })

  it("strips trailing slash from portal API URL", () => {
    const merged = mergeBuildExtra({}, { PORTAL_API_URL: "https://api.example.com/" })
    assert.equal(merged.portalApiUrl, "https://api.example.com")
  })

  it("fills Morphos public MSAL ids when extra and env are empty", () => {
    const merged = mergeBuildExtra({}, {})
    assert.equal(merged.msalClientId, DEFAULT_MSAL_CLIENT_ID)
    assert.equal(merged.msalPortalApiScope, DEFAULT_MSAL_PORTAL_API_SCOPE)
    assert.equal(merged.portalApiUrl, DEFAULT_PORTAL_API_URL)
    assert.equal(merged.googleWebClientId, DEFAULT_GOOGLE_WEB_CLIENT_ID)
  })

  it("replaces loopback extra portal URLs with the production API origin", () => {
    const merged = mergeBuildExtra({ portalApiUrl: "http://localhost:3002" }, {})
    assert.equal(merged.portalApiUrl, DEFAULT_PORTAL_API_URL)
  })

  it("keeps an explicit loopback PORTAL_API_URL for local servers", () => {
    const merged = mergeBuildExtra({}, { PORTAL_API_URL: "http://localhost:3002" })
    assert.equal(merged.portalApiUrl, "http://localhost:3002")
  })

  it("replaces the MSAL scope placeholder with the production Portal API scope", () => {
    const merged = mergeBuildExtra(
      { msalClientId: "", msalPortalApiScope: PLACEHOLDER_MSAL_PORTAL_API_SCOPE },
      {},
    )
    assert.equal(merged.msalClientId, DEFAULT_MSAL_CLIENT_ID)
    assert.equal(merged.msalPortalApiScope, DEFAULT_MSAL_PORTAL_API_SCOPE)
  })
})

describe("validatePhoneBuildExtra", () => {
  it("flags localhost and missing MSAL values", () => {
    const issues = validatePhoneBuildExtra({
      portalApiUrl: "http://localhost:3002",
      msalClientId: "",
      msalPortalApiScope: "",
    })
    assert.ok(issues.some((i) => i.field === "portalApiUrl"))
    assert.ok(issues.some((i) => i.field === "msalClientId"))
    assert.equal(issues.some((i) => i.field === "eas.projectId"), false)
  })

  it("accepts production-like config", () => {
    const issues = validatePhoneBuildExtra({
      portalApiUrl: "https://api.morphosanalytics.com",
      msalClientId: "11111111-1111-1111-1111-111111111111",
      msalPortalApiScope: "api://22222222-2222-2222-2222-222222222222/portal.read",
      googleIosClientId: "ios.apps.googleusercontent.com",
    })
    assert.equal(issues.length, 0)
  })

  it("does not require iOS Google client id for Android-only builds", () => {
    const issues = validatePhoneBuildExtra(
      {
        portalApiUrl: "https://api.morphosanalytics.com",
        msalClientId: "11111111-1111-1111-1111-111111111111",
        msalPortalApiScope: "api://22222222-2222-2222-2222-222222222222/portal.read",
      },
      "android",
    )
    assert.equal(issues.length, 0)
  })
})
