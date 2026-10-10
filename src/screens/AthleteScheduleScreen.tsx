import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native"
import type { RootStackParamList } from "@/navigation/types"
import {
  getMyScheduleEvents,
  type AthleteScheduleEventRow,
  type PortalApiClientConfig,
} from "@morphos/portal-api-client"
import { useAuth } from "@/auth/AuthProvider"
import { portalClientConfig } from "@/auth/tokenStore"
import { AppBootScreen } from "@/components/AppBootScreen"
import { captureParamsFromAthleteScheduleEvent } from "@/home/captureParams"
import { openCapture } from "@/home/openCapture"
import { useI18n } from "@/i18n/I18nProvider"
import { portalLoadErrorMessage } from "@/lib/portalLoadError"
import { toSubmissionEventKind } from "@/lib/submissionEventKind"
import { ScheduleAgenda, scheduleEventKindKey } from "@/schedule/ScheduleAgenda"
import {
  bucketAthleteScheduleEvents,
  groupEventsByLocalDay,
  mobileScheduleFetchWindowYmd,
} from "@/schedule/scheduleBuckets"

type AthleteAgendaEvent = AthleteScheduleEventRow & { eventKindKey: string }

export default function AthleteScheduleScreen() {
  const { ready } = useAuth()
  const navigation = useNavigation()
  const { athleteId } = useRoute<RouteProp<RootStackParamList, "AthleteSchedule">>().params
  const { messages, locale } = useI18n()
  const [cfg, setCfg] = useState<PortalApiClientConfig | null>(null)
  const [events, setEvents] = useState<AthleteAgendaEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [showEarlier, setShowEarlier] = useState(false)

  const scopedAthleteId = typeof athleteId === "string" ? athleteId.trim() : ""

  const fetchSchedule = useCallback(
    async (nextCfg: PortalApiClientConfig, opts?: { refresh?: boolean }) => {
      if (!scopedAthleteId) return
      if (opts?.refresh) setRefreshing(true)
      else setLoading(true)
      setLoadError("")
      try {
        const { from, to } = mobileScheduleFetchWindowYmd()
        const data = await getMyScheduleEvents(nextCfg, {
          from,
          to,
          athleteId: scopedAthleteId,
        })
        setEvents(
          (data?.events ?? []).map((ev) => ({
            ...ev,
            eventKindKey: scheduleEventKindKey(ev.eventKindLabel),
          })),
        )
      } catch (err) {
        setLoadError(portalLoadErrorMessage(err, messages))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [messages, scopedAthleteId],
  )

  useEffect(() => {
    void (async () => {
      const nextCfg = await portalClientConfig()
      if (!nextCfg) {
        setLoading(false)
        return
      }
      setCfg(nextCfg)
      await fetchSchedule(nextCfg)
    })()
  }, [fetchSchedule])

  useLayoutEffect(() => {
    navigation.setOptions({ title: messages.schedule.title })
  }, [messages.schedule.title, navigation])

  const buckets = useMemo(() => bucketAthleteScheduleEvents(events), [events])
  const upcomingGroups = useMemo(
    () => groupEventsByLocalDay(buckets.upcoming),
    [buckets.upcoming],
  )
  const focusGroups = useMemo(() => groupEventsByLocalDay(buckets.focus), [buckets.focus])
  const earlierGroups = useMemo(
    () => groupEventsByLocalDay(buckets.earlier),
    [buckets.earlier],
  )

  useEffect(() => {
    if (!scopedAthleteId) navigation.navigate("Main", { screen: "Home" })
  }, [navigation, scopedAthleteId])

  if (!ready) return <AppBootScreen />
  if (!scopedAthleteId) {
    return null
  }

  if (loading && events.length === 0 && !loadError) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#38bdf8" size="large" />
      </View>
    )
  }

  return (
    <ScheduleAgenda
      messages={messages}
      locale={locale}
      loadError={loadError}
      emptyMessage={messages.schedule.empty}
      refreshing={refreshing}
      onRefresh={cfg ? () => void fetchSchedule(cfg, { refresh: true }) : undefined}
      upcomingGroups={upcomingGroups}
      focusGroups={focusGroups}
      earlierGroups={earlierGroups}
      showEarlier={showEarlier}
      onToggleEarlier={() => setShowEarlier((prev) => !prev)}
      hasAnyEvents={buckets.upcoming.length + buckets.focus.length + buckets.earlier.length > 0}
      onEventPress={(ev) =>
        openCapture(
          navigation,
          captureParamsFromAthleteScheduleEvent(
            ev,
            scopedAthleteId,
            toSubmissionEventKind(ev.eventKindLabel) || undefined,
          ),
        )
      }
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#020617", alignItems: "center", justifyContent: "center" },
})
