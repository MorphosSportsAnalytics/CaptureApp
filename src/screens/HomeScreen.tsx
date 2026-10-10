import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import {
  getMyShareInvite,
  hasMyShareInviteContent,
  type MyShareInviteResponse,
  type PortalApiClientConfig,
} from "@morphos/portal-api-client"
import { portalClientConfig } from "@/auth/tokenStore"
import { HomeEntityCard } from "@/components/HomeEntityCard"
import { HomeHeaderLogo } from "@/components/HomeHeaderLogo"
import { HomeShareInviteModal } from "@/components/HomeShareInviteModal"
import { type HomeCardViewModel, type HomeUploadActionView } from "@/home/buildHomeCards"
import { openCapture } from "@/home/openCapture"
import { initialExpandedCardIds } from "@/home/cardCollapse"
import { loadHomeCards } from "@/home/loadHomeCards"
import { useI18n } from "@/i18n/I18nProvider"
import { portalLoadErrorMessage } from "@/lib/portalLoadError"
import { portalSubscriptionUrl } from "@/lib/portalSubscriptionUrl"
import { portalWebUrl } from "@/config"

export default function HomeScreen() {
  const navigation = useNavigation()
  const { messages, locale } = useI18n()
  const [cfg, setCfg] = useState<PortalApiClientConfig | null>(null)
  const [cards, setCards] = useState<HomeCardViewModel[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [shareInvite, setShareInvite] = useState<MyShareInviteResponse | null>(null)
  const [shareModalVisible, setShareModalVisible] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareLoadError, setShareLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [athleteId, setAthleteId] = useState<string | undefined>()

  const hasActiveHomeCards = cards.length > 0

  const showShareButton = useMemo(() => {
    if (shareInvite && hasMyShareInviteContent(shareInvite)) return true
    return hasActiveHomeCards
  }, [shareInvite, hasActiveHomeCards])

  useEffect(() => {
    void (async () => {
      const nextCfg = await portalClientConfig()
      setCfg(nextCfg)
    })()
  }, [])

  const fetchShareInvite = useCallback(async (nextCfg: PortalApiClientConfig) => {
    setShareLoading(true)
    setShareLoadError(false)
    try {
      const data = await getMyShareInvite(nextCfg)
      setShareInvite(data)
      return data
    } catch {
      setShareLoadError(true)
      return null
    } finally {
      setShareLoading(false)
    }
  }, [])

  const fetchCards = useCallback(
    async (nextCfg: PortalApiClientConfig, opts?: { refresh?: boolean }) => {
      if (opts?.refresh) setRefreshing(true)
      else setLoading(true)
      setLoadError("")
      try {
        const result = await loadHomeCards(nextCfg, locale)
        setAthleteId(result.myProfileAthleteId)
        setCards(result.cards)
        setShareInvite(result.shareInvite)
        setExpandedIds((prev) => {
          if (opts?.refresh && prev.size > 0) {
            const valid = new Set(result.cards.map((c) => c.id))
            const kept = new Set([...prev].filter((id) => valid.has(id)))
            if (kept.size > 0) return kept
          }
          return initialExpandedCardIds(result.cards)
        })
      } catch (err) {
        setLoadError(portalLoadErrorMessage(err, messages))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [locale, messages],
  )

  useEffect(() => {
    if (!cfg) return
    void fetchCards(cfg)
  }, [cfg, fetchCards])

  const openSubscribeWebsite = useCallback(() => {
    void Linking.openURL(portalSubscriptionUrl(portalWebUrl, athleteId))
  }, [athleteId])

  const openMorphosWebsite = useCallback(() => {
    const url = hasActiveHomeCards
      ? portalWebUrl.replace(/\/$/, "")
      : portalSubscriptionUrl(portalWebUrl, athleteId)
    void Linking.openURL(url)
  }, [athleteId, hasActiveHomeCards])

  const openShareModal = useCallback(async () => {
    setShareModalVisible(true)
    if (!cfg) return
    if (shareInvite && hasMyShareInviteContent(shareInvite)) return
    await fetchShareInvite(cfg)
  }, [cfg, fetchShareInvite, shareInvite])

  const retryShareInvite = useCallback(() => {
    if (!cfg) return
    void fetchShareInvite(cfg)
  }, [cfg, fetchShareInvite])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HomeHeaderLogo
          accessibilityLabel={
            hasActiveHomeCards
              ? messages.home.openMorphosWebsite
              : messages.home.openSubscribeWebsite
          }
          onPress={openMorphosWebsite}
        />
      ),
      headerRight: showShareButton
        ? () => (
            <Pressable
              onPress={() => void openShareModal()}
              accessibilityRole="button"
              accessibilityLabel={messages.home.shareInvite}
              style={styles.headerBtn}
            >
              <Ionicons name="gift-outline" size={22} color="#38bdf8" />
            </Pressable>
          )
        : undefined,
    })
  }, [
    navigation,
    showShareButton,
    messages.home.shareInvite,
    messages.home.openMorphosWebsite,
    messages.home.openSubscribeWebsite,
    hasActiveHomeCards,
    openMorphosWebsite,
    openShareModal,
  ])

  const onUploadAction = useCallback(
    (action: HomeUploadActionView) => {
      openCapture(navigation, action.captureParams)
    },
    [navigation],
  )

  const toggleCardExpanded = useCallback((cardId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }, [])

  if (loading && cards.length === 0 && !loadError) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#38bdf8" size="large" />
      </View>
    )
  }

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.container}
        refreshControl={
          cfg ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchCards(cfg, { refresh: true })}
              tintColor="#38bdf8"
            />
          ) : undefined
        }
      >
        {loadError ? (
          <Text style={styles.error}>{loadError || messages.home.loadFailed}</Text>
        ) : null}

        {cards.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{messages.home.emptyTitle}</Text>
            <Text style={styles.emptyBody}>{messages.home.emptyBody}</Text>
            <Pressable style={styles.btn} onPress={openSubscribeWebsite}>
              <Text style={styles.btnText}>{messages.home.subscribeOnWebsite}</Text>
            </Pressable>
          </View>
        ) : cfg ? (
          cards.map((card) => (
            <HomeEntityCard
              key={card.id}
              card={card}
              expanded={expandedIds.has(card.id)}
              onToggleExpanded={() => toggleCardExpanded(card.id)}
              messages={messages}
              selfLabel={messages.home.selfLabel}
              cfg={cfg}
              onUploadAction={onUploadAction}
            />
          ))
        ) : null}
      </ScrollView>

      <HomeShareInviteModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        data={shareInvite}
        portalWebUrl={portalWebUrl}
        messages={messages}
        loading={shareLoading}
        loadError={shareLoadError}
        onRetry={retryShareInvite}
      />
    </>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  container: { padding: 16, gap: 16, paddingBottom: 32 },
  center: { flex: 1, backgroundColor: "#020617", alignItems: "center", justifyContent: "center" },
  headerBtn: { marginRight: 12, padding: 4 },
  error: { color: "#f87171", fontSize: 14 },
  emptyWrap: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  emptyTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
  emptyBody: { color: "#94a3b8", fontSize: 14 },
  btn: { backgroundColor: "#0284c7", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontWeight: "700" },
})
