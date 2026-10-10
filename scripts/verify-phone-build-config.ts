#!/usr/bin/env node
/**
 * Preflight check before preview/production device builds.
 * Merges generated defaults with process.env (including EXPO_PUBLIC_* CI secrets).
 */
import { generatedBuildConfig } from "../src/generated/buildConfig"
import { mergeBuildExtra, validatePhoneBuildExtra, type BuildExtraEnv } from "../src/buildExtra"

function publicEnv(): BuildExtraEnv {
  const out: BuildExtraEnv = {}
  for (const key of [
    "PORTAL_API_URL",
    "PORTAL_WEB_URL",
    "MSAL_CLIENT_ID",
    "MSAL_TENANT",
    "MSAL_PORTAL_API_SCOPE",
    "GOOGLE_WEB_CLIENT_ID",
    "GOOGLE_IOS_CLIENT_ID",
    "EXPO_PUBLIC_PORTAL_API_URL",
    "EXPO_PUBLIC_PORTAL_WEB_URL",
    "EXPO_PUBLIC_MSAL_CLIENT_ID",
    "EXPO_PUBLIC_MSAL_TENANT",
    "EXPO_PUBLIC_MSAL_PORTAL_API_SCOPE",
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
    "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  ] as const) {
    const val = process.env[key]?.trim()
    if (val) out[key] = val
  }
  return out
}

function phoneBuildPlatform(): "android" | "ios" | "all" {
  const raw = (process.env.MORPHOS_PHONE_BUILD_PLATFORM ?? "all").trim().toLowerCase()
  if (raw === "android") return "android"
  if (raw === "ios") return "ios"
  return "all"
}

const extra = mergeBuildExtra(generatedBuildConfig, publicEnv())
const platform = phoneBuildPlatform()
const issues = validatePhoneBuildExtra(extra, platform)

if (issues.length > 0) {
  console.error("Phone build config is incomplete:\n")
  for (const issue of issues) {
    console.error(`  • ${issue.field}: ${issue.message}`)
  }
  console.error("\nSee .env.example and README.md")
  process.exit(1)
}

console.log("Phone build config OK")
console.log(`  platform: ${platform}`)
console.log(`  portalApiUrl: ${extra.portalApiUrl}`)
console.log(`  msalClientId: ${extra.msalClientId?.slice(0, 8)}…`)
console.log(`  msalPortalApiScope: ${extra.msalPortalApiScope}`)
