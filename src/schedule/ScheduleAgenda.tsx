import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileMessages } from "@morphos/mobile-i18n"
import { formatScheduleWhenLabel } from "@/home/cardEvents"
import { toSubmissionEventKind } from "@/lib/submissionEventKind"

export type ScheduleAgendaEvent = {
  id: string
  title: string
  startsAt: string | null
  eventKindKey: string
}

type DayGroup<T> = { dayLabel: string; events: T[] }

type Props<T extends ScheduleAgendaEvent> = {
  messages: MobileMessages
  locale?: string
  loadError: string
  emptyMessage: string
  refreshing: boolean
  onRefresh?: () => void
  upcomingGroups: DayGroup<T>[]
  focusGroups: DayGroup<T>[]
  earlierGroups: DayGroup<T>[]
  showEarlier: boolean
  onToggleEarlier: () => void
  hasAnyEvents: boolean
  onEventPress: (ev: T) => void
}

function eventKindLabel(eventKindKey: string, messages: MobileMessages): string {
  if (eventKindKey === "game") return messages.metadata.eventKind_game
  if (eventKindKey === "skills_session") return messages.metadata.eventKind_skill_session
  return messages.metadata.eventKind_practice
}

export function ScheduleAgenda<T extends ScheduleAgendaEvent>({
  messages,
  locale,
  loadError,
  emptyMessage,
  refreshing,
  onRefresh,
  upcomingGroups,
  focusGroups,
  earlierGroups,
  showEarlier,
  onToggleEarlier,
  hasAnyEvents,
  onEventPress,
}: Props<T>) {
  const renderEvent = (ev: T) => (
    <Pressable
      key={ev.id}
      style={styles.row}
      onPress={() => onEventPress(ev)}
      accessibilityRole="button"
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {ev.title}
        </Text>
        <Text style={styles.rowKind}>{eventKindLabel(ev.eventKindKey, messages)}</Text>
      </View>
      <Text style={styles.rowWhen}>{formatScheduleWhenLabel(ev.startsAt, locale)}</Text>
    </Pressable>
  )

  const renderDayGroups = (groups: DayGroup<T>[]) =>
    groups.map((group) => (
      <View key={group.dayLabel} style={styles.dayGroup}>
        <Text style={styles.dayLabel}>{group.dayLabel}</Text>
        {group.events.map(renderEvent)}
      </View>
    ))

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />
        ) : undefined
      }
    >
      {loadError ? <Text style={styles.error}>{loadError || messages.schedule.loadFailed}</Text> : null}

      {!hasAnyEvents ? (
        <Text style={styles.empty}>{emptyMessage}</Text>
      ) : (
        <>
          {upcomingGroups.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{messages.schedule.upcoming}</Text>
              {renderDayGroups(upcomingGroups)}
            </View>
          ) : null}

          {focusGroups.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{messages.schedule.thisWeek}</Text>
              {renderDayGroups(focusGroups)}
            </View>
          ) : null}

          {earlierGroups.length > 0 ? (
            <View style={styles.section}>
              <Pressable
                style={styles.toggleRow}
                onPress={onToggleEarlier}
                accessibilityRole="button"
              >
                <Text style={styles.toggleText}>
                  {showEarlier ? messages.home.showLess : messages.schedule.showEarlier}
                </Text>
              </Pressable>
              {showEarlier ? renderDayGroups(earlierGroups) : null}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  )
}

export function scheduleEventKindKey(raw: string | null | undefined): string {
  return toSubmissionEventKind(raw) || "practice"
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  container: { padding: 16, gap: 16, paddingBottom: 32 },
  error: { color: "#f87171", fontSize: 14 },
  empty: { color: "#94a3b8", fontSize: 14, textAlign: "center", marginTop: 24 },
  section: { gap: 10 },
  sectionTitle: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  dayGroup: { gap: 8 },
  dayLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  row: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  rowMain: { flex: 1, gap: 4, minWidth: 0 },
  rowTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  rowKind: { color: "#94a3b8", fontSize: 12 },
  rowWhen: { color: "#94a3b8", fontSize: 12, flexShrink: 0 },
  toggleRow: { alignSelf: "flex-start", paddingVertical: 4 },
  toggleText: { color: "#38bdf8", fontSize: 13, fontWeight: "600" },
})
