/** Friendly athlete name from a portal my-profile row. */
export function profileDisplayName(row: Record<string, unknown> | null | undefined): string {
  if (!row) return ""
  const first = String(row.first_name ?? row.firstName ?? "").trim()
  const last = String(row.last_name ?? row.lastName ?? "").trim()
  return [first, last].filter(Boolean).join(" ")
}
