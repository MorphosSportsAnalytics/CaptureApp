import { useMemo } from "react"
import { View, Text, Switch, StyleSheet, TextInput, Pressable, ActivityIndicator } from "react-native"
import { Picker } from "@react-native-picker/picker"
import type { SportArenaOption } from "@morphos/portal-api-client"
import { useI18n } from "@/i18n/I18nProvider"
import { filterArenasByQuery } from "@/lib/arenaDistance"
import { metadataPatchIfChanged, type MetadataFormValues } from "@/components/metadataFormValues"

export type { MetadataFormValues }

type Props = {
  values: MetadataFormValues
  arenas: SportArenaOption[]
  onChange: (patch: Partial<MetadataFormValues>) => void
  eventKindLocked?: boolean
  arenaLocked?: boolean
  arenaSearch: string
  onArenaSearchChange: (query: string) => void
  allRegions: boolean
  onAllRegionsChange: (next: boolean) => void
  onNearMe: () => void
  nearMeLoading?: boolean
  arenasLoading?: boolean
  arenasLoadError?: string
  venueLocationHint?: string
}

export function MetadataForm({
  values,
  arenas,
  onChange,
  eventKindLocked = false,
  arenaLocked = false,
  arenaSearch,
  onArenaSearchChange,
  allRegions,
  onAllRegionsChange,
  onNearMe,
  nearMeLoading = false,
  arenasLoading = false,
  arenasLoadError = "",
  venueLocationHint = "",
}: Props) {
  const { messages } = useI18n()
  const filteredArenas = useMemo(() => filterArenasByQuery(arenas, arenaSearch), [arenas, arenaSearch])

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{messages.metadata.eventKind}</Text>
      <View style={styles.pickerWrap}>
        <Picker
          enabled={!eventKindLocked}
          selectedValue={values.eventKind}
          onValueChange={(v) => {
            const patch = metadataPatchIfChanged(values, { eventKind: String(v) })
            if (patch) onChange(patch)
          }}
          dropdownIconColor="#e2e8f0"
          style={styles.picker}
        >
          <Picker.Item label={messages.metadata.eventKind_game} value="game" />
          <Picker.Item label={messages.metadata.eventKind_practice} value="practice" />
          <Picker.Item label={messages.metadata.eventKind_skill_session} value="skills_session" />
        </Picker>
      </View>

      <Text style={styles.label}>{messages.metadata.arena}</Text>
      {arenasLoadError ? <Text style={styles.error}>{arenasLoadError}</Text> : null}
      {venueLocationHint ? <Text style={styles.hint}>{venueLocationHint}</Text> : null}
      <TextInput
        value={arenaSearch}
        onChangeText={onArenaSearchChange}
        placeholder={messages.metadata.arenaSearchPlaceholder}
        placeholderTextColor="#64748b"
        style={styles.input}
        editable={!arenaLocked}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <View style={styles.row}>
        <Text style={styles.subLabel}>{messages.metadata.showAllRegions}</Text>
        <Switch value={allRegions} onValueChange={onAllRegionsChange} disabled={arenaLocked} />
      </View>
      <Pressable
        style={[styles.secondaryBtn, arenaLocked ? styles.disabledBtn : null]}
        onPress={onNearMe}
        disabled={arenaLocked || nearMeLoading}
      >
        {nearMeLoading ? (
          <ActivityIndicator color="#e2e8f0" />
        ) : (
          <Text style={styles.secondaryBtnText}>{messages.metadata.useNearestVenue}</Text>
        )}
      </Pressable>
      {arenasLoading ? <ActivityIndicator color="#38bdf8" /> : null}
      {!arenasLoading && filteredArenas.length === 0 ? (
        <Text style={styles.hint}>{messages.metadata.noVenuesMatch}</Text>
      ) : null}
      <View style={styles.pickerWrap}>
        <Picker
          enabled={!arenaLocked && !arenasLoading}
          selectedValue={values.sportArenaId}
          onValueChange={(v) => {
            const patch = metadataPatchIfChanged(values, { sportArenaId: String(v) })
            if (patch) onChange(patch)
          }}
          dropdownIconColor="#e2e8f0"
          style={styles.picker}
        >
          <Picker.Item label={messages.metadata.arenaNone} value="" />
          {filteredArenas.map((a) => (
            <Picker.Item key={a.id} label={a.name} value={a.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>{messages.metadata.jerseyColor}</Text>
      <TextInput
        value={values.jerseyColor}
        onChangeText={(jerseyColor) => {
          const patch = metadataPatchIfChanged(values, { jerseyColor })
          if (patch) onChange(patch)
        }}
        placeholder={messages.metadata.jerseyColorPlaceholder}
        placeholderTextColor="#64748b"
        style={styles.input}
        autoCapitalize="words"
      />

      <Text style={styles.label}>{messages.metadata.jerseyNumber}</Text>
      <TextInput
        value={values.jerseyNumber}
        onChangeText={(jerseyNumber) => {
          const patch = metadataPatchIfChanged(values, { jerseyNumber })
          if (patch) onChange(patch)
        }}
        placeholder={messages.metadata.jerseyNumberPlaceholder}
        placeholderTextColor="#64748b"
        style={styles.input}
        keyboardType="number-pad"
      />

      <View style={styles.row}>
        <Text style={styles.label}>{messages.capture.skillClipMode}</Text>
        <Switch
          value={values.skillClipMode}
          onValueChange={(v) => {
            const patch = metadataPatchIfChanged(values, { skillClipMode: v })
            if (patch) onChange(patch)
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: "#cbd5e1", fontSize: 14, fontWeight: "600" },
  subLabel: { color: "#94a3b8", fontSize: 13, flex: 1, paddingRight: 8 },
  hint: { color: "#94a3b8", fontSize: 13 },
  error: { color: "#f87171", fontSize: 13 },
  pickerWrap: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  picker: { color: "#f8fafc" },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    color: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  secondaryBtn: {
    backgroundColor: "#334155",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#f8fafc", fontWeight: "600" },
  disabledBtn: { opacity: 0.5 },
})
