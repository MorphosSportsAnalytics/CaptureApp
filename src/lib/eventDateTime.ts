/** Parse API / DB instant strings to UTC millis (NaN when invalid). */
export function parseApiInstant(raw: string | null | undefined): number {
  const t = String(raw ?? "").trim()
  if (!t) return NaN
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) return Date.parse(t)
  if (t.includes(" ") && !t.includes("T")) return Date.parse(t.replace(" ", "T") + "Z")
  return Date.parse(t)
}

export function formatEventDate(iso: string | null): string {
  const ms = parseApiInstant(iso)
  if (!Number.isFinite(ms)) return ""
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
