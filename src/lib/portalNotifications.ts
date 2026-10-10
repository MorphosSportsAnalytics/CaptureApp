export type PortalAlert = {
  id: string
  title: string
  body: string | null
  readAt: string | null
  createdAt: string
  videoSubmissionId: string | null
}

export function parseNotificationPayload(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== "string") return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

function optionalText(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const text = raw.trim()
  return text || null
}

export function mapPortalAlert(raw: Record<string, unknown>): PortalAlert | null {
  const id = optionalText(raw.id)
  const title = optionalText(raw.title)
  if (!id || !title) return null
  const payload = parseNotificationPayload(raw.payload_json ?? raw.payloadJson)
  const videoSubmissionId =
    optionalText(payload?.submissionId) ?? optionalText(payload?.submission_id)
  const readAt = optionalText(raw.read_at) ?? optionalText(raw.readAt)
  return {
    id,
    title,
    body: optionalText(raw.body),
    readAt,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : typeof raw.createdAt === "string" ? raw.createdAt : "",
    videoSubmissionId,
  }
}

export function mapPortalAlerts(rows: unknown): PortalAlert[] {
  if (!Array.isArray(rows)) return []
  const out: PortalAlert[] = []
  for (const row of rows) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) continue
    const mapped = mapPortalAlert(row as Record<string, unknown>)
    if (mapped) out.push(mapped)
  }
  return out
}

export function unreadPortalAlerts(alerts: PortalAlert[]): PortalAlert[] {
  return alerts.filter((alert) => !alert.readAt)
}

export function videoDetailPath(alert: PortalAlert): `/videos/${string}` | null {
  if (!alert.videoSubmissionId) return null
  return `/videos/${alert.videoSubmissionId}`
}

export function withoutAlertIds(alerts: PortalAlert[], ids: readonly string[]): PortalAlert[] {
  const hide = new Set(ids)
  return alerts.filter((alert) => !hide.has(alert.id))
}

export function formatAlertCreatedAt(iso: string, locale: string): string {
  if (!iso.trim()) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
}
