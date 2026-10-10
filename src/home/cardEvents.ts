const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000

export type TimedScheduleEvent = {
  id: string
  title: string
  startsAt: string | null
  endsAt?: string | null
  status?: string
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Local calendar YMD window: today minus lookbackDays through today plus lookaheadDays (inclusive). */
export function homeCardEventWindowYmd(
  now: Date = new Date(),
  lookbackDays = 4,
  lookaheadDays = 2,
): { from: string; to: string } {
  const toDate = new Date(now)
  toDate.setDate(toDate.getDate() + lookaheadDays)
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - lookbackDays)
  return { from: localYmd(fromDate), to: localYmd(toDate) }
}

export function eventEndMs(ev: TimedScheduleEvent): number | null {
  const end = parseDate(ev.endsAt ?? null)
  if (end) return end.getTime()
  const start = parseDate(ev.startsAt)
  if (!start) return null
  return start.getTime() + DEFAULT_EVENT_DURATION_MS
}

export function isEventHappeningNow(ev: TimedScheduleEvent, now: Date = new Date()): boolean {
  const start = parseDate(ev.startsAt)
  if (!start) return false
  const endMs = eventEndMs(ev)
  if (endMs == null) return false
  const nowMs = now.getTime()
  return start.getTime() <= nowMs && nowMs <= endMs
}

export function isCancelledEvent(status: string | null | undefined): boolean {
  return String(status ?? "").trim().toLowerCase() === "cancelled"
}

/** Happening-now first, then past events in the lookback window newest-first. */
export function sortCardUploadEvents<T extends TimedScheduleEvent>(
  events: T[],
  now: Date = new Date(),
  lookbackDays = 4,
): T[] {
  const windowStart = startOfLocalDay(now)
  windowStart.setDate(windowStart.getDate() - lookbackDays)

  const eligible = events.filter((ev) => {
    if (isCancelledEvent(ev.status)) return false
    const start = parseDate(ev.startsAt)
    if (!start) return false
    if (isEventHappeningNow(ev, now)) return true
    if (start.getTime() > now.getTime()) return false
    return start >= windowStart
  })

  const happening = eligible.filter((ev) => isEventHappeningNow(ev, now))
  const past = eligible
    .filter((ev) => !isEventHappeningNow(ev, now))
    .sort((a, b) => new Date(b.startsAt!).getTime() - new Date(a.startsAt!).getTime())

  return [...happening, ...past]
}

export function formatScheduleWhenLabel(iso: string | null, locale?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export type CardUpcomingEventView = {
  id: string
  title: string
  eventKindKey: string
  whenLabel: string
  startsAt: string
}

/** Future events within horizonDays, ascending, capped at limit. */
export function upcomingCardEvents<T extends TimedScheduleEvent & { eventKindKey: string }>(
  events: T[],
  now: Date = new Date(),
  horizonDays = 2,
  limit = 5,
  locale?: string,
): CardUpcomingEventView[] {
  const horizonEnd = new Date(now)
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays)
  horizonEnd.setHours(23, 59, 59, 999)

  return events
    .filter((ev) => {
      if (isCancelledEvent(ev.status)) return false
      const start = parseDate(ev.startsAt)
      return start != null && start >= now && start <= horizonEnd
    })
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())
    .slice(0, limit)
    .map((ev) => ({
      id: ev.id,
      title: ev.title,
      eventKindKey: ev.eventKindKey,
      whenLabel: formatScheduleWhenLabel(ev.startsAt, locale),
      startsAt: ev.startsAt!,
    }))
}
