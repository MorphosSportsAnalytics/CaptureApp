import type { LinkableUploadEvent } from "@morphos/portal-api-client"
import { toSubmissionEventKind } from "@/lib/submissionEventKind"

export type EventLinkSelection =
  | { mode: "manual" }
  | {
      mode: "linked"
      kind: "team" | "dc" | "athlete"
      id: string
      eventKind: string | null
      sportArenaId: string | null
    }

export function pickerValue(sel: EventLinkSelection): string {
  if (sel.mode === "manual") return "manual"
  return `${sel.kind}:${sel.id}`
}

export function parsePickerValue(raw: string, events: LinkableUploadEvent[]): EventLinkSelection {
  if (!raw || raw === "manual") return { mode: "manual" }
  const idx = raw.indexOf(":")
  if (idx <= 0) return { mode: "manual" }
  const kind = raw.slice(0, idx) as "team" | "dc" | "athlete"
  const id = raw.slice(idx + 1)
  const ev = events.find((e) => e.kind === kind && e.id === id)
  if (!ev) return { mode: "manual" }
  return {
    mode: "linked",
    kind,
    id,
    eventKind: toSubmissionEventKind(ev.eventKind) || ev.eventKind,
    sportArenaId: ev.sportArenaId,
  }
}

export function eventLinksEqual(a: EventLinkSelection, b: EventLinkSelection): boolean {
  if (a.mode !== b.mode) return false
  if (a.mode === "manual" || b.mode === "manual") return true
  return (
    a.kind === b.kind &&
    a.id === b.id &&
    a.eventKind === b.eventKind &&
    a.sportArenaId === b.sportArenaId
  )
}

export function eventLinkIfPickerChanged(
  current: EventLinkSelection,
  raw: string,
  events: LinkableUploadEvent[],
): EventLinkSelection | null {
  const next = parsePickerValue(raw, events)
  return eventLinksEqual(current, next) ? null : next
}

/** Native pickers fire "manual" when selectedValue is not yet in the item list. */
export function shouldApplyPickerValueChange(args: {
  loading: boolean
  current: EventLinkSelection
  raw: string
  events: LinkableUploadEvent[]
}): boolean {
  if (args.loading) return false
  const current = args.current
  if (current.mode !== "linked") return true
  if (args.raw === pickerValue(current)) return false
  if (args.raw === "manual") {
    const inList = args.events.some((ev) => ev.kind === current.kind && ev.id === current.id)
    if (!inList) return false
  }
  return true
}

export function mergePrefilledLinkableEvent(
  events: LinkableUploadEvent[],
  prefilled: EventLinkSelection,
  extras?: { title?: string | null; startsAt?: string | null; teamId?: string | null },
): LinkableUploadEvent[] {
  if (prefilled.mode !== "linked") return events
  if (events.some((ev) => ev.kind === prefilled.kind && ev.id === prefilled.id)) return events
  const title = extras?.title?.trim() || ""
  return [
    {
      kind: prefilled.kind,
      id: prefilled.id,
      title,
      startsAt: extras?.startsAt ?? null,
      eventKind: prefilled.eventKind,
      sportArenaId: prefilled.sportArenaId,
      coachKitKind: null,
      teamId: extras?.teamId ?? null,
      teamName: null,
      dcId: null,
    },
    ...events,
  ]
}
