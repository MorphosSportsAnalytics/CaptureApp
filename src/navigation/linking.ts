import { getStateFromPath as defaultGetStateFromPath, type LinkingOptions } from "@react-navigation/native"
import { resolveSystemPath } from "./resolveSystemPath"
import type { RootStackParamList } from "./types"

export const navigationLinking: LinkingOptions<RootStackParamList> = {
  prefixes: ["morphoscapture://", "https://portal.morphosanalytics.com"],
  config: {
    screens: {
      SignIn: "sign-in",
      Main: {
        path: "",
        screens: {
          Home: "home",
          Capture: "capture",
          Videos: "videos",
          Alerts: "alerts",
          Account: "account",
        },
      },
      VideoDetail: "videos/:id",
      AthleteSchedule: "schedule/:athleteId",
      TeamSchedule: "schedule/team/:teamId",
    },
  },
  getStateFromPath(path, options) {
    return defaultGetStateFromPath(resolveSystemPath(path), options)
  },
}
