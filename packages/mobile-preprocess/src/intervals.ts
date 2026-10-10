import type { TimeInterval } from "./schema.js"

export function totalIntervalDuration(intervals: TimeInterval[]): number {
  return intervals.reduce((sum, iv) => sum + (iv.end - iv.start), 0)
}

export function mergeOverlappingIntervals(intervals: TimeInterval[], minGapSeconds = 0): TimeInterval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const out: TimeInterval[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const last = out[out.length - 1]
    if (cur.start <= last.end + minGapSeconds) {
      last.end = Math.max(last.end, cur.end)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

export function complementIntervals(dead: TimeInterval[], totalDuration: number): TimeInterval[] {
  if (totalDuration <= 0) return []
  const merged = mergeOverlappingIntervals(dead)
  const active: TimeInterval[] = []
  let cursor = 0
  for (const d of merged) {
    if (d.start > cursor) active.push({ start: cursor, end: d.start })
    cursor = Math.max(cursor, d.end)
  }
  if (cursor < totalDuration) active.push({ start: cursor, end: totalDuration })
  return active
}

export function activeCoverage(dead: TimeInterval[], totalDuration: number): number {
  if (totalDuration <= 0) return 0
  const active = complementIntervals(dead, totalDuration)
  return totalIntervalDuration(active) / totalDuration
}

export function trimWindowForTierMax(
  active: TimeInterval[],
  maxSeconds: number,
): { intervals: TimeInterval[]; durationSeconds: number } {
  if (maxSeconds <= 0 || active.length === 0) {
    return { intervals: [], durationSeconds: 0 }
  }
  let remaining = maxSeconds
  const out: TimeInterval[] = []
  for (const iv of active) {
    const len = iv.end - iv.start
    if (len <= remaining) {
      out.push({ ...iv })
      remaining -= len
    } else if (remaining > 0) {
      out.push({ start: iv.start, end: iv.start + remaining })
      remaining = 0
      break
    } else {
      break
    }
  }
  return { intervals: out, durationSeconds: totalIntervalDuration(out) }
}

export function trimToTierMax(durationSeconds: number, maxSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
  if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) return 0
  return Math.min(Math.floor(durationSeconds), Math.floor(maxSeconds))
}

export function coverageDelta(a: number, b: number): number {
  return Math.abs(a - b)
}
