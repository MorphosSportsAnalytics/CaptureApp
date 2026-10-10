const UTM = "morphos_capture"

/** Athlete Portal billing URL opened in the system browser (no in-app checkout). */
export function portalSubscriptionUrl(webOrigin: string, athleteId?: string | null): string {
  const base = webOrigin.replace(/\/$/, "") || "https://portal.morphosanalytics.com"
  const q = new URLSearchParams({ utm_source: UTM })
  const id = athleteId?.trim()
  if (id) {
    q.set("lane", "athlete")
    q.set("athleteId", id)
  }
  return `${base}/subscription?${q.toString()}`
}
