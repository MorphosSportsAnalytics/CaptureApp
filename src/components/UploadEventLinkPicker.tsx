import { useEffect, useMemo, useState } from "react"
import { View, Text, StyleSheet, ActivityIndicator } from "react-native"
import { Picker } from "@react-native-picker/picker"
import type { CalendarEventSuggestion, LinkableUploadEvent, PortalApiClientConfig } from "@morphos/portal-api-client"
import { getLinkableUploadEvents, getTeamEvents } from "@morphos/portal-api-client"
import { useI18n } from "@/i18n/I18nProvider"
import { toSubmissionEventKind } from "@/lib/submissionEventKind"
import { portalLoadErrorMessage } from "@/lib/portalLoadError"
import {
  eventLinkIfPickerChanged,
  mergePrefilledLinkableEvent,
  pickerValue,
  shouldApplyPickerValueChange,
  type EventLinkSelection,
} from "@/components/eventLinkSelection"
import { linkableEventWindowYmd, linkableTeamEventsFromRows } from "@/components/linkableTeamEvents"
import { formatEventDate, localDayKey, parseApiInstant } from "@/lib/eventDateTime"

export type { EventLinkSelection }

function eventOptionLabel(
  ev: LinkableUploadEvent,
  labels: { dcPrefix: string; personalPrefix: string },
): string {
  const prefix =
    ev.kind === "dc"
      ? labels.dcPrefix
      : ev.kind === "athlete"
        ? labels.personalPrefix
        : ev.teamName
          ? `${ev.teamName}: `
          : ""
  const when = ev.startsAt ? ` (${formatEventDate(ev.startsAt)})` : ""
  const title = ev.title.trim() || ev.id
  return `${prefix}${title}${when}`
}

type Props = {
  cfg: PortalApiClientConfig | null
  signedIn: boolean
  athleteId?: string
  teamId?: string
  recordedAtMs?: number | null
  prefilledTitle?: string
  value: EventLinkSelection
  onChange: (next: EventLinkSelection) => void
  disabled?: boolean
  skipAutoSelect?: boolean
}

export function UploadEventLinkPicker({
  cfg,
  signedIn,
  athleteId,
  teamId,
  recordedAtMs,
  prefilledTitle,
  value,
  onChange,
  disabled = false,
  skipAutoSelect = false,
}: Props) {
  const { messages } = useI18n()
  const tLink = messages.metadata.eventLink
  const [events, setEvents] = useState<LinkableUploadEvent[]>([])
  const [suggestions, setSuggestions] = useState<CalendarEventSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [didAutoSelect, setDidAutoSelect] = useState(false)

  useEffect(() => {
    if (!cfg || !signedIn) {
      setEvents([])
      setSuggestions([])
      setLoadError("")
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError("")
    setDidAutoSelect(false)
    const anchorAt =
      recordedAtMs != null && Number.isFinite(recordedAtMs)
        ? new Date(recordedAtMs).toISOString()
        : undefined
    const load = athleteId?.trim()
      ? getLinkableUploadEvents(cfg, { athleteId, anchorAt })
      : teamId?.trim()
        ? getTeamEvents(cfg, teamId, linkableEventWindowYmd(recordedAtMs)).then((data) => ({
            events: linkableTeamEventsFromRows(data?.events ?? [], teamId),
            suggestions: [] as CalendarEventSuggestion[],
          }))
        : Promise.resolve({ events: [] as LinkableUploadEvent[], suggestions: [] as CalendarEventSuggestion[] })
    void load
      .then((data) => {
        if (cancelled) return
        setEvents(data.events)
        setSuggestions(data.suggestions)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(portalLoadErrorMessage(err, messages))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cfg, signedIn, athleteId, teamId, recordedAtMs, messages])

  useEffect(() => {
    if (skipAutoSelect || didAutoSelect || loading || value.mode === "linked") return
    const top = suggestions[0]
    if (!top) return
    setDidAutoSelect(true)
    onChange({
      mode: "linked",
      kind: top.kind,
      id: top.id,
      eventKind: toSubmissionEventKind(top.eventKind) || top.eventKind,
      sportArenaId: top.sportArenaId,
    })
  }, [didAutoSelect, loading, onChange, skipAutoSelect, suggestions, value.mode])

  const prefilledStartsAt =
    recordedAtMs != null && Number.isFinite(recordedAtMs) ? new Date(recordedAtMs).toISOString() : null
  const displayEvents = useMemo(
    () =>
      mergePrefilledLinkableEvent(events, value, {
        title: prefilledTitle || tLink.selectedEvent,
        startsAt: prefilledStartsAt,
        teamId: teamId ?? null,
      }),
    [events, prefilledStartsAt, prefilledTitle, teamId, tLink.selectedEvent, value],
  )

  const grouped = useMemo(() => {
    const now = new Date()
    const todayKey = localDayKey(now)
    const today: LinkableUploadEvent[] = []
    const past: LinkableUploadEvent[] = []
    const upcoming: LinkableUploadEvent[] = []
    for (const ev of displayEvents) {
      if (!ev.startsAt) {
        past.push(ev)
        continue
      }
      const ms = parseApiInstant(ev.startsAt)
      if (!Number.isFinite(ms)) {
        past.push(ev)
        continue
      }
      const start = new Date(ms)
      const key = localDayKey(start)
      if (key === todayKey) today.push(ev)
      else if (start.getTime() < now.getTime()) past.push(ev)
      else upcoming.push(ev)
    }
    return { today, past, upcoming }
  }, [displayEvents])

  const items: { value: string; label: string }[] = [{ value: "manual", label: tLink.notLinked }]
  const seen = new Set<string>()
  const pushEv = (ev: LinkableUploadEvent, groupLabel: string) => {
    const v = `${ev.kind}:${ev.id}`
    if (seen.has(v)) return
    seen.add(v)
    items.push({ value: v, label: `${groupLabel}: ${eventOptionLabel(ev, tLink)}` })
  }
  for (const ev of suggestions) pushEv(ev, tLink.suggested)
  for (const ev of grouped.today) pushEv(ev, tLink.today)
  for (const ev of grouped.past) pushEv(ev, tLink.recent)
  for (const ev of grouped.upcoming) pushEv(ev, tLink.upcoming)

  const emptyHint = teamId && !athleteId ? tLink.emptyTeam : tLink.empty

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{tLink.label}</Text>
      {!signedIn ? <Text style={styles.hint}>{tLink.signInRequired}</Text> : null}
      {loading ? <ActivityIndicator color="#38bdf8" /> : null}
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      {signedIn && !loading && !loadError && displayEvents.length === 0 ? (
        <Text style={styles.hint}>{emptyHint}</Text>
      ) : null}
      <View style={styles.pickerWrap}>
        <Picker
          enabled={!disabled && !loading && signedIn}
          selectedValue={pickerValue(value)}
          onValueChange={(v) => {
            const raw = String(v)
            if (!shouldApplyPickerValueChange({ loading, current: value, raw, events: displayEvents })) {
              return
            }
            const next = eventLinkIfPickerChanged(value, raw, displayEvents)
            if (next) onChange(next)
          }}
          dropdownIconColor="#e2e8f0"
          style={styles.picker}
        >
          {items.map((it) => (
            <Picker.Item key={it.value} label={it.label} value={it.value} />
          ))}
        </Picker>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: "#cbd5e1", fontSize: 14, fontWeight: "600" },
  hint: { color: "#94a3b8", fontSize: 13 },
  error: { color: "#f87171", fontSize: 13 },
  pickerWrap: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  picker: { color: "#f8fafc" },
})
