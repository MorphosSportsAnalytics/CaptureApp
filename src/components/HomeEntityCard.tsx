import { useState } from "react"
import { View, Text, Pressable, StyleSheet } from "react-native"
import { useNavigation } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import type { PortalApiClientConfig } from "@morphos/portal-api-client"
import type { MobileMessages } from "@morphos/mobile-i18n"
import { t as translate } from "@morphos/mobile-i18n"
import { AthleteAvatar } from "@/components/AthleteAvatar"
import {
  type HomeCardViewModel,
  type HomeUploadActionView,
  type HomeUpcomingEventView,
} from "@/home/buildHomeCards"
import { openCapture } from "@/home/openCapture"

const VISIBLE_UPLOAD_ACTIONS = 3

function eventKindLabel(eventKindKey: string, messages: MobileMessages): string {
  if (eventKindKey === "game") return messages.metadata.eventKind_game
  if (eventKindKey === "skills_session") return messages.metadata.eventKind_skill_session
  return messages.metadata.eventKind_practice
}

function uploadActionLabel(action: HomeUploadActionView, messages: MobileMessages): string {
  if (action.isGeneric) return messages.home.uploadGeneric
  const kindLabel = eventKindLabel(action.eventKindKey, messages)
  return translate(messages, "home.uploadFromEvent", {
    kind: kindLabel,
    title: action.eventTitle,
  })
}

type Props = {
  card: HomeCardViewModel
  expanded: boolean
  onToggleExpanded: () => void
  messages: MobileMessages
  selfLabel: string
  cfg: PortalApiClientConfig
  onUploadAction: (action: HomeUploadActionView) => void
}

export function HomeEntityCard({
  card,
  expanded,
  onToggleExpanded,
  messages,
  selfLabel,
  cfg,
  onUploadAction,
}: Props) {
  const navigation = useNavigation()
  const [showAllActions, setShowAllActions] = useState(false)
  const isTeam = card.kind === "team"
  const displayName = card.isSelf ? selfLabel : card.title
  const headerAccessibilityLabel = expanded ? messages.home.collapseCard : messages.home.expandCard
  const kindIcon = isTeam ? "shirt-outline" : "people-outline"
  const visibleActions = showAllActions
    ? card.uploadActions
    : card.uploadActions.slice(0, VISIBLE_UPLOAD_ACTIONS)
  const hiddenActionCount = Math.max(0, card.uploadActions.length - VISIBLE_UPLOAD_ACTIONS)

  const openSchedule = () => {
    if (card.scheduleAthleteId) {
      navigation.navigate("AthleteSchedule", { athleteId: card.scheduleAthleteId })
      return
    }
    if (card.scheduleTeamId) {
      navigation.navigate("TeamSchedule", { teamId: card.scheduleTeamId })
    }
  }

  const onUpcomingPress = (event: HomeUpcomingEventView) => {
    openCapture(navigation, event.captureParams)
  }

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.headerRow}
        onPress={onToggleExpanded}
        accessibilityRole="button"
        accessibilityLabel={headerAccessibilityLabel}
        accessibilityState={{ expanded }}
      >
        <View style={styles.iconBadge}>
          <Ionicons name={kindIcon} size={18} color="#38bdf8" />
        </View>
        {!isTeam && card.photo ? (
          <AthleteAvatar
            cfg={cfg}
            athleteId={card.photo.athleteId}
            kind={card.photo.kind}
            updatedAt={card.photo.updatedAt}
            initials={card.initials}
          />
        ) : (
          <View style={styles.initials}>
            <Text style={styles.initialsText}>{card.initials}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          {isTeam ? (
            <Text style={styles.kindLabel}>{messages.home.teamCardLabel}</Text>
          ) : null}
          <Text style={styles.title} numberOfLines={expanded ? undefined : 1}>
            {displayName}
          </Text>
          {expanded && !isTeam ? (
            <Text style={styles.position}>
              {card.positionLabel ?? messages.home.noPosition}
            </Text>
          ) : null}
          {expanded && isTeam && card.subtitle ? (
            <View style={styles.seasonPill}>
              <Text style={styles.seasonPillText}>{card.subtitle}</Text>
            </View>
          ) : null}
          {expanded && card.billingActive != null ? (
            <View
              style={[
                styles.statusPill,
                card.billingActive ? styles.statusActive : styles.statusInactive,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  card.billingActive ? styles.statusTextActive : styles.statusTextInactive,
                ]}
              >
                {card.billingActive
                  ? messages.home.subscriptionActive
                  : messages.account.subscriptionNeeded}
              </Text>
            </View>
          ) : null}
          {expanded && card.hasHappeningNow ? (
            <Text style={styles.liveBadge}>{messages.home.happeningNow}</Text>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#94a3b8"
          style={styles.chevron}
        />
      </Pressable>

      {expanded ? (
        <>
          {card.scheduleAthleteId || card.scheduleTeamId ? (
            <View style={styles.iconRow}>
              <Pressable
                style={styles.iconButton}
                onPress={openSchedule}
                accessibilityRole="button"
                accessibilityLabel={messages.home.viewSchedule}
              >
                <Ionicons name="calendar-outline" size={22} color="#38bdf8" />
              </Pressable>
            </View>
          ) : null}

          {card.uploadActions.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{messages.home.suggestedActionsTitle}</Text>
              <View style={styles.actions}>
                {visibleActions.map((action) => (
                  <Pressable
                    key={action.id}
                    style={styles.actionRow}
                    onPress={() => onUploadAction(action)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.actionLabel}>{uploadActionLabel(action, messages)}</Text>
                    {action.whenLabel ? (
                      <Text style={styles.actionWhen}>{action.whenLabel}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
              {hiddenActionCount > 0 ? (
                <Pressable
                  style={styles.toggleRow}
                  onPress={() => setShowAllActions((prev) => !prev)}
                  accessibilityRole="button"
                >
                  <Text style={styles.toggleText}>
                    {showAllActions
                      ? messages.home.showLess
                      : translate(messages, "home.showMore", { count: hiddenActionCount })}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {card.upcomingEvents.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{messages.home.upcomingTitle}</Text>
              <View style={styles.actions}>
                {card.upcomingEvents.map((event) => (
                  <Pressable
                    key={event.id}
                    style={styles.upcomingRow}
                    onPress={() => onUpcomingPress(event)}
                    accessibilityRole="button"
                  >
                    <View style={styles.upcomingMain}>
                      <Text style={styles.actionLabel} numberOfLines={2}>
                        {event.title}
                      </Text>
                      <Text style={styles.eventKind}>
                        {eventKindLabel(event.eventKindKey, messages)}
                      </Text>
                    </View>
                    {event.whenLabel ? (
                      <Text style={styles.actionWhen}>{event.whenLabel}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  initials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },
  initialsText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  kindLabel: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
  position: { color: "#94a3b8", fontSize: 13 },
  seasonPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "#334155",
    borderWidth: 1,
  },
  seasonPillText: { color: "#bae6fd", fontSize: 12, fontWeight: "600" },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusActive: { backgroundColor: "rgba(34, 197, 94, 0.2)" },
  statusInactive: { backgroundColor: "rgba(248, 113, 113, 0.2)" },
  statusText: { fontSize: 10, fontWeight: "600" },
  statusTextActive: { color: "#4ade80" },
  statusTextInactive: { color: "#fca5a5" },
  liveBadge: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  chevron: { marginTop: 8 },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#1e293b",
  },
  section: { gap: 8 },
  sectionTitle: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  actions: { gap: 8 },
  actionRow: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  upcomingRow: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#172033",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  upcomingMain: { flex: 1, gap: 4, minWidth: 0 },
  actionLabel: { color: "#f8fafc", fontSize: 14, fontWeight: "600" },
  eventKind: { color: "#94a3b8", fontSize: 12, textTransform: "capitalize" },
  actionWhen: { color: "#94a3b8", fontSize: 12, flexShrink: 0 },
  toggleRow: { alignSelf: "flex-start", paddingVertical: 4 },
  toggleText: { color: "#38bdf8", fontSize: 13, fontWeight: "600" },
})
