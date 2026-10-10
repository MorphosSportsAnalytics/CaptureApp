import type { NavigatorScreenParams } from "@react-navigation/native"

export type CaptureNavParams = {
  athleteId?: string
  teamId?: string
  linkKind?: string
  linkId?: string
  eventKind?: string
  eventTitle?: string
  sportArenaId?: string
  kitKind?: string
  opponentJerseyPrimary?: string
  recordedAtMs?: string
}

export type MainTabParamList = {
  Home: undefined
  Capture: CaptureNavParams | undefined
  Videos: undefined
  Alerts: undefined
  Account: undefined
}

export type RootStackParamList = {
  SignIn: Record<string, string> | undefined
  Main: NavigatorScreenParams<MainTabParamList> | undefined
  VideoDetail: { id: string }
  AthleteSchedule: { athleteId: string }
  TeamSchedule: { teamId: string }
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
