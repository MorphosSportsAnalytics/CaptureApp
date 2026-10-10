"use strict"

const fs = require("fs")
const path = require("path")

const KEYS = [
  ["portalApiUrl", ["PORTAL_API_URL", "EXPO_PUBLIC_PORTAL_API_URL"], "https://api.morphosanalytics.com"],
  ["portalWebUrl", ["PORTAL_WEB_URL", "EXPO_PUBLIC_PORTAL_WEB_URL"], "https://portal.morphosanalytics.com"],
  ["msalClientId", ["MSAL_CLIENT_ID", "EXPO_PUBLIC_MSAL_CLIENT_ID"], "a6023341-d99d-48b1-83a3-c657cf791981"],
  ["msalTenant", ["MSAL_TENANT", "EXPO_PUBLIC_MSAL_TENANT"], "common"],
  ["msalPortalApiScope", ["MSAL_PORTAL_API_SCOPE", "EXPO_PUBLIC_MSAL_PORTAL_API_SCOPE"], "api://b8d3dc3c-5589-460e-af7e-30a2e6b46bbb/portal.read"],
  ["googleWebClientId", ["GOOGLE_WEB_CLIENT_ID", "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"], "79042994996-ccbdj2h3gjsd0rtjci0bgt3tij1l2ha3.apps.googleusercontent.com"],
  ["googleIosClientId", ["GOOGLE_IOS_CLIENT_ID", "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"], "79042994996-m23rnjus94uo1uvqn8pd1dft7iaqenml.apps.googleusercontent.com"],
]

function firstEnv(env, keys) {
  for (const key of keys) {
    const value = String(env[key] || "").trim()
    if (value) return value.replace(/\/$/, "")
  }
  return ""
}

function buildConfig(env) {
  const out = {}
  for (const [field, keys, fallback] of KEYS) {
    out[field] = firstEnv(env, keys) || fallback
  }
  return out
}

function render(config) {
  return `import type { BuildExtra } from "../buildExtra"

/** Public runtime defaults bundled into the app. Overwritten by scripts/write-build-config.cjs. */
export const generatedBuildConfig: BuildExtra = ${JSON.stringify(config, null, 2)}
`
}

function main(appRoot, env) {
  const dest = path.join(appRoot, "src", "generated", "buildConfig.ts")
  fs.writeFileSync(dest, render(buildConfig(env)))
  return dest
}

if (require.main === module) {
  const dest = main(path.resolve(__dirname, ".."), process.env)
  console.log(`Wrote ${dest}`)
}

module.exports = { buildConfig, render, main }
