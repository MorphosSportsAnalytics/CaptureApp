import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Alert, ScrollView, Linking } from "react-native"
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native"
import {
  fetchAthleteStatMenu,
  getMyProfile,
  getMyVideoUploadAccess,
  getNearestSportArena,
  getSportArenasForSubmit,
  getUploadLimits,
  uploadLimitsHasSubscription,
  type AthleteStatMenu,
  type PortalApiClientConfig,
  type SportArenaOption,
  type VideoUploadAccess,
} from "@morphos/portal-api-client"
import { portalClientConfig } from "@/auth/tokenStore"
import { maxClipLengthLabel, t } from "@morphos/mobile-i18n"
import { useI18n } from "@/i18n/I18nProvider"
import { MetadataForm } from "@/components/MetadataForm"
import { QcGateModal } from "@/components/QcGateModal"
import { UploadEventLinkPicker } from "@/components/UploadEventLinkPicker"
import { applyMetadataPatch, type MetadataFormValues } from "@/components/metadataFormValues"
import { eventLinksEqual, type EventLinkSelection } from "@/components/eventLinkSelection"
import {
  clearCaptureIntent,
  getCaptureIntentRevision,
  peekCaptureIntent,
  subscribeCaptureIntent,
} from "@/home/captureIntent"
import {
  captureParamsHasUploadScope,
  parseCaptureParams,
  recordedAtMsFromParams,
  resolveCaptureParams,
} from "@/home/captureParams"
import {
  captureParamsKey,
  eventLinkFromParams,
  metadataFromParams,
} from "@/home/captureScreenState"
import { runPreprocessPipeline, VIDEO_TOO_LONG } from "@/preprocess/pipeline"
import { loadDeviceTranscoder } from "@/preprocess/loadDeviceTranscoder"
import { enqueueUpload } from "@/upload/queue"
import { athleteUploadSelectionReady } from "@/upload/statSelection"
import { pickerDurationSeconds, pickerRecordedAtMs } from "@/lib/pickerMedia"
import { toSubmissionEventKind } from "@/lib/submissionEventKind"
import { portalSubscriptionUrl } from "@/lib/portalSubscriptionUrl"
import { portalWebUrl } from "@/config"
import { applyNearestArenaToPicker } from "@/lib/arenaDistance"
import { deviceLocationApi } from "@/lib/deviceLocationApi"
import { pickVideoFromLibrary, type PickedVideo } from "@/lib/pickVideo"
import { readDeviceLocation } from "@/lib/readDeviceLocation"
import type { MainTabParamList } from "@/navigation/types"
import { venueLocationFailureMessage } from "@/lib/venueLocationMessage"
import { profileDisplayName } from "@/lib/profileDisplayName"
import { portalLoadErrorMessage } from "@/lib/portalLoadError"

export default function CaptureScreen() {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<MainTabParamList, "Capture">>()
  const rawParams = (route.params ?? {}) as Record<string, string | string[] | undefined>
  const routeParamsKey = captureParamsKey(rawParams)
  const intentRevision = useSyncExternalStore(subscribeCaptureIntent, getCaptureIntentRevision)
  const routeParams = useMemo(
    () => resolveCaptureParams(parseCaptureParams(rawParams), peekCaptureIntent()),
    [intentRevision, routeParamsKey],
  )
  const hasUploadScope = captureParamsHasUploadScope(routeParams)
  const prefilledLink = useMemo(() => eventLinkFromParams(routeParams), [routeParams])
  const { messages } = useI18n()
  const [maxSeconds, setMaxSeconds] = useState(0)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingPercent, setProcessingPercent] = useState<number | null>(null)
  const [arenas, setArenas] = useState<SportArenaOption[]>([])
  const [arenasLoading, setArenasLoading] = useState(false)
  const [arenasLoadError, setArenasLoadError] = useState("")
  const [allRegions, setAllRegions] = useState(false)
  const [arenaSearch, setArenaSearch] = useState("")
  const [nearMeLoading, setNearMeLoading] = useState(false)
  const [venueLocationHint, setVenueLocationHint] = useState("")
  const [cfg, setCfg] = useState<PortalApiClientConfig | null>(null)
  const [athleteId, setAthleteId] = useState<string | undefined>(routeParams.athleteId)
  const [teamId, setTeamId] = useState<string | undefined>(routeParams.teamId)
  const [kitKind, setKitKind] = useState<string | undefined>(routeParams.kitKind)
  const [opponentJerseyPrimary, setOpponentJerseyPrimary] = useState<string | undefined>(
    routeParams.opponentJerseyPrimary,
  )
  const [displayName, setDisplayName] = useState("")
  const [profileError, setProfileError] = useState("")
  const [uploadAccess, setUploadAccess] = useState<VideoUploadAccess | null>(null)
  const [statMenu, setStatMenu] = useState<AthleteStatMenu | null>(null)
  const [statMenuError, setStatMenuError] = useState("")
  const [selectedStats, setSelectedStats] = useState<string[]>([])
  const [eventLink, setEventLink] = useState<EventLinkSelection>(prefilledLink)
  const [recordedAtMs, setRecordedAtMs] = useState<number | null>(() => recordedAtMsFromParams(routeParams))
  const [meta, setMeta] = useState<MetadataFormValues>(() => ({
    eventKind: "practice",
    sportArenaId: "",
    jerseyColor: "",
    jerseyNumber: "",
    skillClipMode: false,
    ...metadataFromParams(routeParams),
  }))
  const [qcVisible, setQcVisible] = useState(false)
  const [qcFailures, setQcFailures] = useState<string[]>([])
  const [qcOverride, setQcOverride] = useState(false)
  const [pendingUri, setPendingUri] = useState<string | null>(null)
  const [pendingSidecar, setPendingSidecar] = useState<import("@morphos/mobile-preprocess").ClientPreprocessSidecar | null>(null)
  const [pendingFileName, setPendingFileName] = useState("video.mp4")
  const preprocessAbort = useRef<AbortController | null>(null)

  const canPickVideos = uploadAccess?.canPickVideos === true
  const skipAutoSelect = prefilledLink.mode === "linked"

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => {
            clearCaptureIntent()
            navigation.navigate("Main", { screen: "Home" })
          }}
          style={styles.headerBack}
        >
          <Text style={styles.headerBackText}>{messages.home.backToHome}</Text>
        </Pressable>
      ),
    })
  }, [messages.home.backToHome, navigation])

  useEffect(() => {
    setAthleteId((current) => (current === routeParams.athleteId ? current : routeParams.athleteId))
    setTeamId((current) => (current === routeParams.teamId ? current : routeParams.teamId))
    setKitKind((current) => (current === routeParams.kitKind ? current : routeParams.kitKind))
    setOpponentJerseyPrimary((current) =>
      current === routeParams.opponentJerseyPrimary ? current : routeParams.opponentJerseyPrimary,
    )
    const nextLink = eventLinkFromParams(routeParams)
    setEventLink((current) => (eventLinksEqual(current, nextLink) ? current : nextLink))
    const nextRecordedAtMs = recordedAtMsFromParams(routeParams)
    setRecordedAtMs((current) => (current === nextRecordedAtMs ? current : nextRecordedAtMs))
    setMeta((current) => applyMetadataPatch(current, metadataFromParams(routeParams)))
  }, [routeParams])

  useEffect(() => {
    void (async () => {
      const nextCfg = await portalClientConfig()
      if (!nextCfg) return
      setCfg(nextCfg)
      try {
        const limits = await getUploadLimits(nextCfg, {
          athleteId: routeParams.athleteId,
          teamId: routeParams.teamId,
        })
        setMaxSeconds(limits.maxDurationSeconds)
        setHasSubscription(uploadLimitsHasSubscription(limits))
        const profile = await getMyProfile(nextCfg)
        const id = typeof profile.row?.id === "string" ? profile.row.id : undefined
        if (!routeParams.athleteId && !routeParams.teamId) setAthleteId(id)
        setDisplayName(profileDisplayName(profile.row))
        const access = await getMyVideoUploadAccess(nextCfg)
        setUploadAccess(access)
        setProfileError("")
      } catch (err) {
        setProfileError(portalLoadErrorMessage(err, messages))
      }
    })()
  }, [messages, routeParams.athleteId, routeParams.teamId])

  useEffect(() => {
    void (async () => {
      if (!cfg) {
        setArenas([])
        return
      }
      setArenasLoading(true)
      setArenasLoadError("")
      try {
        const list = await getSportArenasForSubmit(cfg, { teamId, allRegions })
        setArenas(list)
        if (list.length === 0 && !allRegions) {
          const expanded = await getSportArenasForSubmit(cfg, { teamId, allRegions: true })
          if (expanded.length > 0) {
            setAllRegions(true)
            setArenas(expanded)
          }
        }
      } catch (err) {
        setArenasLoadError(portalLoadErrorMessage(err, messages))
      } finally {
        setArenasLoading(false)
      }
    })()
  }, [cfg, allRegions, messages.errors.network, teamId])

  useEffect(() => {
    if (!cfg || (!athleteId && !teamId)) {
      setStatMenu(null)
      setSelectedStats([])
      return
    }
    let cancelled = false
    setStatMenuError("")
    setSelectedStats([])
    void (async () => {
      try {
        const menu = await fetchAthleteStatMenu(cfg, { athleteId, teamId })
        if (!cancelled) setStatMenu(menu)
      } catch (err) {
        if (!cancelled) {
          setStatMenu(null)
          setStatMenuError(portalLoadErrorMessage(err, messages))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [athleteId, cfg, messages, teamId])

  const toggleStat = useCallback((schemaName: string) => {
    setSelectedStats((current) => {
      if (current.includes(schemaName)) return current.filter((name) => name !== schemaName)
      const cap = statMenu?.pickCount
      if (cap != null && current.length >= cap) return current
      return [...current, schemaName]
    })
  }, [statMenu?.pickCount])

  const isTeamUpload = Boolean(teamId)
  const pickReady = isTeamUpload
    ? true
    : statMenu?.mode === "athlete_pick" &&
      athleteUploadSelectionReady(statMenu.mode, statMenu.pickCount, selectedStats)

  const applyNearestVenue = useCallback(async () => {
    if (!cfg) return
    setNearMeLoading(true)
    try {
      const location = await readDeviceLocation(deviceLocationApi)
      if (!location.ok) {
        if (__DEV__) {
          console.info(`MorphosCapture nearestVenue location=${location.reason}`)
        }
        setVenueLocationHint(venueLocationFailureMessage(messages, location.reason))
        return
      }
      const nearest = await getNearestSportArena(cfg, { lat: location.lat, lng: location.lng })
      const next = applyNearestArenaToPicker(arenas, nearest)
      if (!next) {
        setVenueLocationHint(messages.metadata.noNearbyVenue)
        return
      }
      setVenueLocationHint("")
      if (!arenas.some((arena) => arena.id === next.sportArenaId)) {
        setAllRegions(true)
      }
      setArenas(next.arenas)
      setArenaSearch("")
      setMeta((m) => applyMetadataPatch(m, { sportArenaId: next.sportArenaId }))
    } catch (err) {
      setVenueLocationHint(portalLoadErrorMessage(err, messages))
    } finally {
      setNearMeLoading(false)
    }
  }, [arenas, cfg, messages])

  const onArenaSearchChange = useCallback((query: string) => {
    setArenaSearch(query)
    setVenueLocationHint("")
  }, [])

  const openSubscribeWebsite = useCallback(() => {
    const url = portalSubscriptionUrl(portalWebUrl, athleteId)
    void Linking.openURL(url)
  }, [athleteId])

  const explainBlockedUpload = useCallback(() => {
    if (uploadAccess?.athleteHasGuardian) {
      Alert.alert(messages.upload.title, messages.capture.guardianManagesFootage)
      return
    }
    Alert.alert(messages.upload.title, messages.capture.subscriptionRequired, [
      { text: messages.capture.cancel, style: "cancel" },
      { text: messages.capture.openWebsite, onPress: () => openSubscribeWebsite() },
    ])
  }, [messages, openSubscribeWebsite, uploadAccess?.athleteHasGuardian])

  const onEventLinkChange = useCallback((next: EventLinkSelection) => {
    setEventLink((current) => (eventLinksEqual(current, next) ? current : next))
    if (next.mode === "linked") {
      const kind = toSubmissionEventKind(next.eventKind)
      setMeta((m) =>
        applyMetadataPatch(m, {
          ...(kind ? { eventKind: kind } : {}),
          ...(next.sportArenaId ? { sportArenaId: next.sportArenaId } : {}),
        }),
      )
    }
  }, [])

  const uploadProcessed = useCallback(
    async (
      uri: string,
      sidecar: import("@morphos/mobile-preprocess").ClientPreprocessSidecar,
      fileName: string,
    ) => {
      if (!canPickVideos) {
        explainBlockedUpload()
        return
      }
      if (!pickReady) {
        Alert.alert(
          messages.upload.title,
          t(messages, "upload.statPickNeed", { count: statMenu?.pickCount ?? 0 }),
        )
        return
      }
      const portalCfg = cfg ?? (await portalClientConfig())
      if (!portalCfg) {
        Alert.alert(messages.account.title, messages.auth.signInFailed)
        return
      }
      await enqueueUpload(portalCfg, {
        id: `upload-${Date.now()}`,
        fileUri: uri,
        fileName,
        athleteId,
        teamId,
        durationSeconds: sidecar.outputDurationSeconds,
        clientPreprocessJson: sidecar,
        sportArenaId: meta.sportArenaId || undefined,
        eventKind: meta.eventKind,
        jerseyColor: meta.jerseyColor,
        jerseyNumber: meta.jerseyNumber,
        teamEventId: eventLink.mode === "linked" && eventLink.kind === "team" ? eventLink.id : undefined,
        dcEventId: eventLink.mode === "linked" && eventLink.kind === "dc" ? eventLink.id : undefined,
        athleteEventId: eventLink.mode === "linked" && eventLink.kind === "athlete" ? eventLink.id : undefined,
        kitKind,
        opponentJerseyPrimary,
        recordedAtMs,
        selectedFocusSchemas: isTeamUpload ? undefined : selectedStats,
      })
      Alert.alert(messages.upload.title, messages.upload.success)
      setPendingUri(null)
      setPendingSidecar(null)
    },
    [
      athleteId,
      canPickVideos,
      cfg,
      eventLink,
      explainBlockedUpload,
      isTeamUpload,
      kitKind,
      messages,
      meta,
      opponentJerseyPrimary,
      pickReady,
      recordedAtMs,
      selectedStats,
      statMenu?.pickCount,
      teamId,
    ],
  )

  const handlePickedVideo = useCallback(
    async (asset: PickedVideo) => {
      if (!canPickVideos) {
        explainBlockedUpload()
        return
      }
      const uri = asset.uri
      if (!uri) return
      const durationSeconds = pickerDurationSeconds(asset.duration)
      const fileName = asset.fileName?.trim() || `capture-${Date.now()}.mp4`
      setPendingFileName(fileName)
      setRecordedAtMs(pickerRecordedAtMs(asset))
      preprocessAbort.current?.abort()
      const abort = new AbortController()
      preprocessAbort.current = abort
      setProcessing(true)
      setProcessingPercent(0)
      try {
        let transcoder
        try {
          transcoder = loadDeviceTranscoder()
        } catch {
          Alert.alert(messages.upload.failed, messages.errors.transcode_failed)
          return
        }
        const tierMax = meta.skillClipMode ? Math.min(maxSeconds, 300) : maxSeconds
        const result = await runPreprocessPipeline({
          inputUri: uri,
          sourceDurationSeconds: durationSeconds,
          maxDurationSeconds: tierMax,
          skillClipMode: meta.skillClipMode,
          transcode: transcoder,
          onProgress: (progress) => setProcessingPercent(Math.round(progress * 100)),
          signal: abort.signal,
          capture: {
            arenaId: meta.sportArenaId || null,
            eventKind: meta.eventKind,
            jerseyColor: meta.jerseyColor || null,
            jerseyNumber: meta.jerseyNumber || null,
          },
        })
        if (abort.signal.aborted) return
        if (!result.ok) {
          if (result.error === "cancelled") return
          const msg =
            result.code === VIDEO_TOO_LONG
              ? messages.errors.video_too_long
              : messages.errors.transcode_failed
          Alert.alert(messages.upload.failed, msg)
          return
        }
        setPendingUri(result.outputUri)
        setPendingSidecar(result.sidecar)
        if (!result.qcPassed) {
          setQcFailures(result.qcFailures)
          setQcOverride(false)
          setQcVisible(true)
          return
        }
        await uploadProcessed(result.outputUri, result.sidecar, fileName)
      } finally {
        setProcessing(false)
        setProcessingPercent(null)
      }
    },
    [
      canPickVideos,
      explainBlockedUpload,
      maxSeconds,
      meta,
      messages.errors.transcode_failed,
      messages.errors.video_too_long,
      messages.upload.failed,
      uploadProcessed,
    ],
  )

  const importVideo = async () => {
    if (!uploadAccess) return
    if (!canPickVideos) {
      explainBlockedUpload()
      return
    }
    if (!pickReady) {
      Alert.alert(
        messages.upload.title,
        t(messages, "upload.statPickNeed", { count: statMenu?.pickCount ?? 0 }),
      )
      return
    }
    const pick = await pickVideoFromLibrary()
    if (!pick) return
    await handlePickedVideo(pick)
  }

  useEffect(() => {
    if (!hasUploadScope) navigation.navigate("Main", { screen: "Home" })
  }, [hasUploadScope, navigation])

  if (!hasUploadScope) {
    return null
  }

  const linked = eventLink.mode === "linked"
  const showSubscribeCta = uploadAccess?.subscribeOnWebsite === true
  const importGreyed = !canPickVideos || !pickReady

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.signedInCard}>
          <Text style={styles.signedInLabel}>{messages.account.signedInAs}</Text>
          <Text style={styles.signedInName}>
            {displayName || profileError || messages.account.profileLoading}
          </Text>
        </View>

        <Text style={styles.title}>{messages.capture.tipsTitle}</Text>
        <Text style={styles.tip}>• {messages.capture.tipsWide}</Text>
        <Text style={styles.tip}>• {messages.capture.tipsJersey}</Text>
        <Text style={styles.tip}>• {messages.capture.tipsLines}</Text>
        <Text style={styles.limit}>
          {maxClipLengthLabel(messages, { maxDurationSeconds: maxSeconds, hasSubscription })}
        </Text>

        {uploadAccess?.athleteHasGuardian && !canPickVideos ? (
          <Text style={styles.banner}>{messages.capture.guardianManagesFootage}</Text>
        ) : null}
        {showSubscribeCta ? <Text style={styles.banner}>{messages.capture.subscriptionRequired}</Text> : null}

        <UploadEventLinkPicker
          cfg={cfg}
          signedIn
          athleteId={athleteId}
          teamId={teamId}
          recordedAtMs={recordedAtMs}
          prefilledTitle={routeParams.eventTitle}
          value={eventLink}
          onChange={onEventLinkChange}
          skipAutoSelect={skipAutoSelect}
        />

        <MetadataForm
          values={meta}
          arenas={arenas}
          onChange={(p) => setMeta((m) => applyMetadataPatch(m, p))}
          eventKindLocked={linked}
          arenaLocked={linked && Boolean(eventLink.sportArenaId)}
          arenaSearch={arenaSearch}
          onArenaSearchChange={onArenaSearchChange}
          allRegions={allRegions}
          onAllRegionsChange={setAllRegions}
          onNearMe={() => void applyNearestVenue()}
          nearMeLoading={nearMeLoading}
          arenasLoading={arenasLoading}
          arenasLoadError={arenasLoadError}
          venueLocationHint={venueLocationHint}
        />

        {statMenuError ? <Text style={styles.banner}>{statMenuError}</Text> : null}
        {!isTeamUpload && statMenu?.mode === "athlete_pick" ? (
          <View style={styles.statCard}>
            <Text style={styles.title}>
              {t(messages, "upload.statPickTitle", { count: statMenu.pickCount ?? 0 })}
            </Text>
            <Text style={styles.tip}>{messages.upload.statPickHint}</Text>
            {statMenu.stats.map((stat) => {
              const checked = selectedStats.includes(stat.schemaName)
              return (
                <Pressable
                  key={stat.schemaName}
                  style={styles.statRow}
                  onPress={() => toggleStat(stat.schemaName)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <Text style={styles.statBox}>{checked ? "✓" : ""}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </Pressable>
              )
            })}
            {statMenu.pickCount != null && selectedStats.length !== statMenu.pickCount ? (
              <Text style={styles.tip}>
                {t(messages, "upload.statPickNeed", { count: statMenu.pickCount })}
              </Text>
            ) : null}
          </View>
        ) : null}
        {isTeamUpload && statMenu?.mode === "team_full" ? (
          <Text style={styles.banner}>{messages.upload.teamFullStats}</Text>
        ) : null}
        {isTeamUpload && statMenu?.mode === "team_starter" ? (
          <Text style={styles.banner}>{messages.upload.teamStarterStats}</Text>
        ) : null}

        {processing ? (
          <View style={styles.processing}>
            <ActivityIndicator color="#38bdf8" />
            <Text style={styles.tip}>
              {processingPercent == null
                ? messages.capture.processing
                : t(messages, "capture.processingProgress", { percent: processingPercent })}
            </Text>
            <Pressable
              style={styles.btn}
              onPress={() => {
                preprocessAbort.current?.abort()
                setProcessing(false)
                setProcessingPercent(null)
              }}
            >
              <Text style={styles.btnText}>{messages.capture.cancel}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, importGreyed ? styles.btnGrey : null]}
              onPress={() => void importVideo()}
              disabled={importGreyed}
            >
              <Text style={[styles.btnText, importGreyed ? styles.btnTextGrey : null]}>
                {messages.capture.import}
              </Text>
            </Pressable>
            {showSubscribeCta ? (
              <Pressable style={styles.btn} onPress={openSubscribeWebsite}>
                <Text style={styles.btnText}>{messages.capture.subscribeOnWebsite}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      <QcGateModal
        visible={qcVisible}
        failures={qcFailures}
        overrideChecked={qcOverride}
        onToggleOverride={setQcOverride}
        onRetry={() => {
          setQcVisible(false)
          setPendingUri(null)
        }}
        onContinue={async () => {
          setQcVisible(false)
          if (pendingUri && pendingSidecar) await uploadProcessed(pendingUri, pendingSidecar, pendingFileName)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  container: { padding: 16, gap: 8, paddingBottom: 32 },
  headerBack: { paddingHorizontal: 8, paddingVertical: 4 },
  headerBackText: { color: "#38bdf8", fontSize: 16 },
  signedInCard: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  signedInLabel: { color: "#94a3b8", fontSize: 12 },
  signedInName: { color: "#f8fafc", fontSize: 16, fontWeight: "700", marginTop: 2 },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "700", marginTop: 8 },
  tip: { color: "#94a3b8", fontSize: 14 },
  banner: {
    color: "#fde68a",
    backgroundColor: "#422006",
    borderColor: "#b45309",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  limit: { color: "#38bdf8", fontSize: 14, marginVertical: 8 },
  statCard: { gap: 8, marginTop: 8 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  statBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#38bdf8",
    color: "#38bdf8",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "700",
  },
  statLabel: { color: "#f8fafc", fontSize: 15, flex: 1 },
  actions: { marginTop: 16, gap: 12 },
  btn: { backgroundColor: "#0284c7", padding: 14, borderRadius: 10, alignItems: "center" },
  btnGrey: { backgroundColor: "#334155", opacity: 0.55 },
  btnText: { color: "#fff", fontWeight: "700" },
  btnTextGrey: { color: "#cbd5e1" },
  processing: { alignItems: "center", gap: 8, marginTop: 24 },
})
