"use strict"

/**
 * RN 0.76 New Architecture CMake compiling four ABIs at full ninja
 * parallelism starves CI. Preview APKs only need arm64-v8a for devices.
 */

const CI_ANDROID_ABI = "arm64-v8a"
const CI_CMAKE_PARALLEL = "2"
const CI_GRADLE_WORKERS = "2"

const CI_GRADLE_PROPERTIES = {
  reactNativeArchitectures: CI_ANDROID_ABI,
  "org.gradle.workers.max": CI_GRADLE_WORKERS,
  "org.gradle.parallel": "false",
}

const PREVIEW_LOCAL_GRADLE_COMMAND =
  ":app:assembleRelease -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease"

function truthyEnv(value) {
  const v = String(value ?? "").trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

function ciLimitsEnabled(env) {
  const e = env || {}
  if (truthyEnv(e.MORPHOS_ANDROID_CI_LIMITS)) return true
  if (truthyEnv(e.GITHUB_ACTIONS)) return true
  return false
}

function applyCiLimitEnv(env) {
  const next = { ...(env || {}) }
  if (!ciLimitsEnabled(next)) return next
  if (!String(next.ORG_GRADLE_PROJECT_reactNativeArchitectures || "").trim()) {
    next.ORG_GRADLE_PROJECT_reactNativeArchitectures = CI_ANDROID_ABI
  }
  if (!String(next.CMAKE_BUILD_PARALLEL_LEVEL || "").trim()) {
    next.CMAKE_BUILD_PARALLEL_LEVEL = CI_CMAKE_PARALLEL
  }
  if (!String(next.NINJAFLAGS || "").trim()) {
    next.NINJAFLAGS = `-j${CI_CMAKE_PARALLEL}`
  }
  const opts = String(next.GRADLE_OPTS || "")
  if (!opts.includes("org.gradle.workers.max")) {
    next.GRADLE_OPTS = `${opts} -Dorg.gradle.workers.max=${CI_GRADLE_WORKERS}`.trim()
  }
  return next
}

function upsertPropertyLine(body, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, "m")
  if (re.test(body)) return `${body.replace(re, line).replace(/\s+$/, "")}\n`
  const trimmed = body.replace(/\s+$/, "")
  return `${trimmed ? `${trimmed}\n` : ""}${line}\n`
}

function upsertGradlePropertyLines(body) {
  let next = body || ""
  for (const [key, value] of Object.entries(CI_GRADLE_PROPERTIES)) {
    next = upsertPropertyLine(next, key, value)
  }
  return next
}

module.exports = {
  CI_ANDROID_ABI,
  CI_CMAKE_PARALLEL,
  CI_GRADLE_WORKERS,
  CI_GRADLE_PROPERTIES,
  PREVIEW_LOCAL_GRADLE_COMMAND,
  truthyEnv,
  ciLimitsEnabled,
  applyCiLimitEnv,
  upsertPropertyLine,
  upsertGradlePropertyLines,
}
