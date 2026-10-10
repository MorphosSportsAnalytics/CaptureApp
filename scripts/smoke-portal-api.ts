#!/usr/bin/env node
/**
 * Smoke-test Portal API reachability from a developer machine (proxy for phone network path).
 */
const portalApiUrl = (
  process.env.PORTAL_API_URL ??
  process.env.EXPO_PUBLIC_PORTAL_API_URL ??
  "https://api.morphosanalytics.com"
).replace(/\/$/, "")

async function main() {
  const healthUrl = `${portalApiUrl}/health`
  const res = await fetch(healthUrl, { method: "GET" })
  const body = await res.text()
  if (res.status === 403) {
    console.log(`OK ${healthUrl} → HTTP 403 (health is IP-gated on prod; phones use authenticated /v1/portal/* routes)`)
    return
  }
  if (!res.ok) {
    console.error(`FAIL ${healthUrl} → HTTP ${res.status}: ${body.slice(0, 200)}`)
    process.exit(1)
  }
  console.log(`OK ${healthUrl} → ${body.slice(0, 120)}`)
  console.log("Upload/sign-in still require MSAL on device — see docs/phone-testing-checklist.md")
}

main().catch((err) => {
  console.error("FAIL", err instanceof Error ? err.message : err)
  process.exit(1)
})
