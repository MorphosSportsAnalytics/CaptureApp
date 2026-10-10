import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin"
import { Platform } from "react-native"
import { googleIosClientId, googleWebClientId } from "@/config"
import {
  acquireGoogleIdToken,
  googleSignInAvailable,
  restoreGoogleIdToken,
  signOutGoogleSession,
  type GoogleSignInBridge,
  type GoogleSignInClientIds,
  type GoogleSignInPlatform,
} from "./googleSignInCore"

const bridge: GoogleSignInBridge = {
  configure: (params) => GoogleSignin.configure(params),
  hasPlayServices: () => GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }),
  signIn: () => GoogleSignin.signIn(),
  signInSilently: () => GoogleSignin.signInSilently(),
  signOut: () => GoogleSignin.signOut(),
  isCancelledError: (err) => isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED,
}

export function googleSignInPlatform(): GoogleSignInPlatform {
  return Platform.OS === "ios" ? "ios" : "android"
}

function bakedClientIds(): GoogleSignInClientIds {
  return { googleWebClientId, googleIosClientId }
}

export function isGoogleSignInAvailable(ids: GoogleSignInClientIds = bakedClientIds()): boolean {
  return googleSignInAvailable(googleSignInPlatform(), ids)
}

export function acquireGoogleNativeIdToken(ids: GoogleSignInClientIds = bakedClientIds()): Promise<string> {
  return acquireGoogleIdToken(bridge, googleSignInPlatform(), ids)
}

export function restoreGoogleNativeIdToken(
  ids: GoogleSignInClientIds = bakedClientIds(),
): Promise<string | null> {
  return restoreGoogleIdToken(bridge, googleSignInPlatform(), ids)
}

export function signOutGoogleAccount(ids: GoogleSignInClientIds = bakedClientIds()): Promise<void> {
  return signOutGoogleSession(bridge, googleSignInPlatform(), ids)
}
