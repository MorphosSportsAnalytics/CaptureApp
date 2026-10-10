/** Sunday = 0, Monday = 1 */
export type WeekStartsOn = 0 | 1

export type ScheduleWindowOptions = {
  weekStartsOn?: WeekStartsOn
  businessDaysAhead?: number
}

export type ScheduleBuckets<T> = {
  earlier: T[]
  focus: T[]
  upcoming: T[]
}

export type ScheduleWindowBounds = {
  focusStart: Date
  focusEnd: Date
  upcomingEnd: Date
}

const DEFAULT_WEEK_STARTS_ON: WeekStartsOn = 0
const DEFAULT_BUSINESS_DAYS_AHEAD = 10

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

export function startOfLocalWeek(d: Date, weekStartsOn: WeekStartsOn = DEFAULT_WEEK_STARTS_ON): Date {
  const day = startOfLocalDay(d)
  const dow = day.getDay()
  const offset = (dow - weekStartsOn + 7) % 7
  day.setDate(day.getDate() - offset)
  return day
}

export function endOfLocalWeek(d: Date, weekStartsOn: WeekStartsOn = DEFAULT_WEEK_STARTS_ON): Date {
  const weekStart = startOfLocalWeek(d, weekStartsOn)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  return endOfLocalDay(weekEnd)
}

export function endOfNthBusinessDayOnOrAfter(from: Date, n: number): Date {
  const cursor = startOfLocalDay(from)
  let counted = 0
  while (counted < n) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) counted++
    if (counted < n) cursor.setDate(cursor.getDate() + 1)
  }
  return endOfLocalDay(cursor)
}

export function computeScheduleWindowBounds(
  now: Date = new Date(),
  options?: ScheduleWindowOptions,
): ScheduleWindowBounds {
  const weekStartsOn = options?.weekStartsOn ?? DEFAULT_WEEK_STARTS_ON
  const businessDaysAhead = options?.businessDaysAhead ?? DEFAULT_BUSINESS_DAYS_AHEAD

  const todayStart = startOfLocalDay(now)
  const currentWeekStart = startOfLocalWeek(now, weekStartsOn)
  const focusStart = new Date(currentWeekStart)
  focusStart.setDate(focusStart.getDate() - 7)

  const focusEnd = endOfLocalWeek(now, weekStartsOn)

  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const upcomingEnd = endOfNthBusinessDayOnOrAfter(tomorrowStart, businessDaysAhead)

  return { focusStart, focusEnd, upcomingEnd }
}

function parseStartsAt(startsAt: string | null): Date | null {
  if (!startsAt) return null
  const d = new Date(startsAt)
  return Number.isNaN(d.getTime()) ? null : d
}

export function bucketAthleteScheduleEvents<T extends { startsAt: string | null }>(
  events: T[],
  now: Date = new Date(),
  options?: ScheduleWindowOptions,
): ScheduleBuckets<T> {
  const { focusStart, focusEnd, upcomingEnd } = computeScheduleWindowBounds(now, options)
  const earlier: T[] = []
  const focus: T[] = []
  const upcoming: T[] = []

  for (const ev of events) {
    const start = parseStartsAt(ev.startsAt)
    if (!start) continue
    if (start < focusStart) {
      earlier.push(ev)
    } else if (start <= focusEnd) {
      focus.push(ev)
    } else if (start <= upcomingEnd) {
      upcoming.push(ev)
    }
  }

  const byStart = (a: T, b: T) => {
    const ta = parseStartsAt(a.startsAt)?.getTime() ?? 0
    const tb = parseStartsAt(b.startsAt)?.getTime() ?? 0
    return ta - tb
  }
  earlier.sort(byStart)
  focus.sort(byStart)
  upcoming.sort(byStart)

  return { earlier, focus, upcoming }
}

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Mobile schedule fetch window: ~90 days back through ~60 days forward. */
export function mobileScheduleFetchWindowYmd(now: Date = new Date()): { from: string; to: string } {
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - 90)
  const toDate = new Date(now)
  toDate.setDate(toDate.getDate() + 60)
  return { from: localYmd(fromDate), to: localYmd(toDate) }
}

export function groupEventsByLocalDay<T extends { startsAt: string | null }>(
  events: T[],
): { dayLabel: string; events: T[] }[] {
  const groups = new Map<string, T[]>()
  for (const ev of events) {
    const start = parseStartsAt(ev.startsAt)
    if (!start) continue
    const key = localYmd(start)
    const bucket = groups.get(key) ?? []
    bucket.push(ev)
    groups.set(key, bucket)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayLabel, dayEvents]) => ({ dayLabel, events: dayEvents }))
}
