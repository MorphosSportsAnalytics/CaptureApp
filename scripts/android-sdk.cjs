"use strict"

const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")
const ciLimits = require("./android-ci-limits.cjs")

const RN_COMPILE_SDK = "android-35"
const RN_BUILD_TOOLS = "35.0.0"
const RN_NDK = "26.1.10909125"
const SDKMANAGER_PACKAGES = [
  "platform-tools",
  `platforms;${RN_COMPILE_SDK}`,
  `build-tools;${RN_BUILD_TOOLS}`,
  `ndk;${RN_NDK}`,
]
const CMDLINE_TOOLS_URL = "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
// GitHub releases are on the Morphos runner Squid allowlist; api.adoptium.net is not.
const TEMURIN17_URL =
  "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.16%2B8/OpenJDK17U-jdk_x64_linux_hotspot_17.0.16_8.tar.gz"
const MISSING_SDK_MESSAGE =
  "Android SDK not found. Local Android builds need a Linux SDK with platforms/ and build-tools/ " +
  `(RN 0.76: ${RN_COMPILE_SDK} + build-tools ${RN_BUILD_TOOLS}). ` +
  "The Debian adb package at /usr/lib/android-sdk is not enough. " +
  "Run `npm run ensure-android-sdk`, then retry the Gradle build."
const MISSING_JDK_MESSAGE =
  "JDK not found (javac missing). Local Android builds need OpenJDK 17. " +
  "Install with: sudo apt install openjdk-17-jdk-headless"

function defaultIo() {
  return {
    existsSync: fs.existsSync,
    readdirSync: fs.readdirSync,
    readFileSync: fs.readFileSync,
    writeFileSync: fs.writeFileSync,
    mkdirSync: fs.mkdirSync,
    homedir: os.homedir,
    env: process.env,
    platform: process.platform,
    spawnSync,
    log: console.log,
    error: console.error,
    exit: process.exit,
  }
}

function defaultSdkRoot(ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  return path.join(io.homedir(), "Android", "Sdk")
}

function dirHasEntries(dir, io) {
  if (!io.existsSync(dir)) return false
  try {
    return io.readdirSync(dir).filter((name) => name && name !== "." && name !== "..").length > 0
  } catch {
    return false
  }
}

function isValidAndroidSdk(sdkRoot, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  if (!sdkRoot) return false
  const adb = path.join(sdkRoot, "platform-tools", "adb")
  if (!io.existsSync(adb)) return false
  return (
    dirHasEntries(path.join(sdkRoot, "platforms"), io) && dirHasEntries(path.join(sdkRoot, "build-tools"), io)
  )
}

function hasRn76AndroidPackages(sdkRoot, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  if (!isValidAndroidSdk(sdkRoot, io)) return false
  return (
    io.existsSync(path.join(sdkRoot, "platforms", RN_COMPILE_SDK)) &&
    io.existsSync(path.join(sdkRoot, "build-tools", RN_BUILD_TOOLS))
  )
}

function candidateSdkRoots(ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const env = io.env || {}
  const roots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, defaultSdkRoot(io), "/opt/android-sdk", "/usr/lib/android-sdk"]
  return [...new Set(roots.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean))]
}

function resolveAndroidSdk(ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  for (const root of candidateSdkRoots(io)) {
    if (isValidAndroidSdk(root, io)) return root
  }
  return null
}

function isJdkHome(javaHome, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  return Boolean(javaHome) && io.existsSync(path.join(javaHome, "bin", "javac"))
}

function userJdkRoots(ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const base = path.join(io.homedir(), ".local", "jdk")
  if (!io.existsSync(base)) return []
  try {
    return io.readdirSync(base).map((name) => path.join(base, name))
  } catch {
    return []
  }
}

function resolveJavaHome(ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const envHome = (io.env || {}).JAVA_HOME
  if (isJdkHome(envHome, io)) return envHome
  const jvmRoots = [
    "/usr/lib/jvm/java-17-openjdk-amd64",
    "/usr/lib/jvm/java-21-openjdk-amd64",
    ...userJdkRoots(io),
  ]
  for (const root of jvmRoots) {
    if (isJdkHome(root, io)) return root
  }
  const which = io.spawnSync("which", ["javac"], { encoding: "utf8" })
  if (which.status === 0) {
    const javac = String(which.stdout || "").trim()
    const home = path.resolve(path.dirname(javac), "..")
    if (isJdkHome(home, io)) return home
  }
  return null
}

const GRADLEW_JAVA_HOME_BEGIN = "# morphos-java-home-begin"
const GRADLEW_JAVA_HOME_END = "# morphos-java-home-end"

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function gradleSdkDirProperty(sdkRoot) {
  return sdkRoot.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/ /g, "\\ ")
}

function upsertPropertyLine(body, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, "m")
  if (re.test(body)) return `${body.replace(re, line).replace(/\s+$/, "")}\n`
  const trimmed = body.replace(/\s+$/, "")
  return `${trimmed ? `${trimmed}\n` : ""}${line}\n`
}

function writeAndroidLocalProperties(appRoot, sdkRoot, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const filePath = path.join(appRoot, "android", "local.properties")
  const existing = io.existsSync(filePath) ? io.readFileSync(filePath, "utf8") : ""
  const next = upsertPropertyLine(existing, "sdk.dir", gradleSdkDirProperty(sdkRoot))
  io.writeFileSync(filePath, next)
  return { path: filePath, changed: next !== existing }
}

function writeGradleJavaHome(appRoot, javaHome, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const filePath = path.join(appRoot, "android", "gradle.properties")
  const existing = io.existsSync(filePath) ? io.readFileSync(filePath, "utf8") : ""
  const next = upsertPropertyLine(existing, "org.gradle.java.home", javaHome)
  io.writeFileSync(filePath, next)
  return { path: filePath, changed: next !== existing }
}

function writeGradleCiLimits(appRoot, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const filePath = path.join(appRoot, "android", "gradle.properties")
  if (!ciLimits.ciLimitsEnabled(io.env || {})) {
    return { path: filePath, changed: false }
  }
  const existing = io.existsSync(filePath) ? io.readFileSync(filePath, "utf8") : ""
  const next = ciLimits.upsertGradlePropertyLines(existing)
  if (next !== existing) io.writeFileSync(filePath, next)
  return { path: filePath, changed: next !== existing }
}

function gradlewJavaHomeBlock(javaHome) {
  return [
    GRADLEW_JAVA_HOME_BEGIN,
    `export JAVA_HOME=${shellSingleQuote(javaHome)}`,
    'export PATH="$JAVA_HOME/bin:$PATH"',
    GRADLEW_JAVA_HOME_END,
  ].join("\n")
}

function upsertGradlewJavaHome(body, javaHome) {
  const block = gradlewJavaHomeBlock(javaHome)
  const re = new RegExp(
    `${escapeRegex(GRADLEW_JAVA_HOME_BEGIN)}\\r?\\n[\\s\\S]*?${escapeRegex(GRADLEW_JAVA_HOME_END)}\\r?\\n?`,
  )
  if (re.test(body)) return body.replace(re, `${block}\n`)
  if (body.startsWith("#!")) {
    const nl = body.indexOf("\n")
    if (nl !== -1) {
      return `${body.slice(0, nl + 1)}${block}\n${body.slice(nl + 1)}`
    }
  }
  return `${block}\n${body}`
}

function writeGradlewJavaHome(appRoot, javaHome, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const filePath = path.join(appRoot, "android", "gradlew")
  if (!io.existsSync(filePath)) {
    return { path: filePath, changed: false }
  }
  const existing = io.readFileSync(filePath, "utf8")
  const next = upsertGradlewJavaHome(existing, javaHome)
  if (next !== existing) io.writeFileSync(filePath, next)
  return { path: filePath, changed: next !== existing }
}

function easBuildPlatform(ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  return String((io.env || {}).EAS_BUILD_PLATFORM || "").trim().toLowerCase()
}

function isEasBuild(ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  return String((io.env || {}).EAS_BUILD || "").trim().toLowerCase() === "true"
}

/**
 * Skip writing Gradle files when an iOS-only environment is detected
 * (legacy EAS_BUILD_PLATFORM=ios, or Darwin EAS jobs).
 */
function androidPrepareSkipReason(appRoot, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const easPlatform = easBuildPlatform(io)
  if (easPlatform === "ios") return "eas-ios"
  if (isEasBuild(io) && easPlatform !== "android" && io.platform === "darwin") return "darwin"
  const androidDir = path.join(appRoot, "android")
  if (!io.existsSync(androidDir)) return "no-android"
  return null
}

function prepareAndroidLocalBuild(appRoot, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const skipped = androidPrepareSkipReason(appRoot, io)
  if (skipped) {
    return { skipped }
  }
  const sdkRoot = resolveAndroidSdk(io)
  if (!sdkRoot) {
    throw new Error(MISSING_SDK_MESSAGE)
  }
  const javaHome = resolveJavaHome(io)
  if (!javaHome) {
    throw new Error(MISSING_JDK_MESSAGE)
  }
  const sdk = writeAndroidLocalProperties(appRoot, sdkRoot, io)
  const jdk = writeGradleJavaHome(appRoot, javaHome, io)
  const limits = writeGradleCiLimits(appRoot, io)
  const wrapper = writeGradlewJavaHome(appRoot, javaHome, io)
  return { skipped: null, sdkRoot, javaHome, sdk, jdk, limits, wrapper }
}

function sdkmanagerBin(sdkRoot) {
  return path.join(sdkRoot, "cmdline-tools", "latest", "bin", "sdkmanager")
}

function sdkmanagerProxyArgs(ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const env = io.env || {}
  const proxy = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy
  if (!proxy || typeof proxy !== "string") return []
  try {
    const parsed = new URL(proxy)
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80")
    return ["--proxy=http", `--proxy_host=${parsed.hostname}`, `--proxy_port=${port}`]
  } catch {
    return []
  }
}

function runChecked(io, command, args, opts) {
  const result = io.spawnSync(command, args, { encoding: "utf8", ...opts })
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim()
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `\n${detail}` : ""}`)
  }
  return result
}

function ensureJdk(ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const existing = resolveJavaHome(io)
  if (existing) return { installed: false, javaHome: existing }
  io.log("Installing OpenJDK 17 (javac is required for Gradle)")
  const apt = io.spawnSync("sudo", ["-n", "apt-get", "install", "-y", "openjdk-17-jdk-headless"], {
    encoding: "utf8",
  })
  if (apt.status !== 0) {
    const dest = path.join(io.homedir(), ".local", "jdk")
    io.mkdirSync(dest, { recursive: true })
    const tarball = path.join(dest, "temurin17.tar.gz")
    io.log("sudo apt is unavailable; downloading Temurin 17 into ~/.local/jdk")
    runChecked(io, "curl", ["-fsSL", "-L", "-o", tarball, TEMURIN17_URL])
    runChecked(io, "tar", ["-xzf", tarball, "-C", dest])
    runChecked(io, "rm", ["-f", tarball])
  }
  const javaHome = resolveJavaHome(io)
  if (!javaHome) {
    throw new Error(MISSING_JDK_MESSAGE)
  }
  return { installed: true, javaHome }
}

function extractCommandLineTools(zipPath, sdkRoot, io) {
  const staging = path.join(sdkRoot, ".cmdline-tools-staging")
  io.mkdirSync(staging, { recursive: true })
  runChecked(io, "python3", [
    "-c",
    "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
    zipPath,
    staging,
  ])
  const latest = path.join(sdkRoot, "cmdline-tools", "latest")
  io.mkdirSync(path.dirname(latest), { recursive: true })
  runChecked(io, "rm", ["-rf", latest])
  runChecked(io, "mv", [path.join(staging, "cmdline-tools"), latest])
  runChecked(io, "chmod", ["-R", "+x", path.join(latest, "bin")])
  runChecked(io, "rm", ["-rf", staging])
}

function ensureCommandLineTools(sdkRoot, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const bin = sdkmanagerBin(sdkRoot)
  if (io.existsSync(bin)) return { installed: false, bin }
  io.mkdirSync(sdkRoot, { recursive: true })
  const zipPath = path.join(sdkRoot, "commandlinetools.zip")
  io.log(`Downloading Android command-line tools to ${sdkRoot}`)
  runChecked(io, "curl", ["-fsSL", "-o", zipPath, CMDLINE_TOOLS_URL])
  extractCommandLineTools(zipPath, sdkRoot, io)
  runChecked(io, "rm", ["-f", zipPath])
  if (!io.existsSync(bin)) {
    throw new Error(`sdkmanager missing after extracting command-line tools at ${bin}`)
  }
  return { installed: true, bin }
}

function jdkProcessEnv(io, javaHome) {
  const env = { ...(io.env || {}) }
  env.JAVA_HOME = javaHome
  const jdkBin = path.join(javaHome, "bin")
  env.PATH = env.PATH ? `${jdkBin}${path.delimiter}${env.PATH}` : jdkBin
  return env
}

function androidBuildEnv(io, javaHome, sdkRoot) {
  const env = ciLimits.applyCiLimitEnv(jdkProcessEnv(io, javaHome))
  if (sdkRoot) {
    env.ANDROID_HOME = sdkRoot
    env.ANDROID_SDK_ROOT = sdkRoot
    const ndk = path.join(sdkRoot, "ndk", RN_NDK)
    if (io.existsSync(ndk)) env.ANDROID_NDK_HOME = ndk
  }
  return env
}

function ensureAndroidSdk(ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const jdk = ensureJdk(io)
  const env = jdkProcessEnv(io, jdk.javaHome)
  const ioWithJdk = { ...io, env }
  const resolved = resolveAndroidSdk(ioWithJdk)
  const sdkRoot = hasRn76AndroidPackages(resolved, ioWithJdk) ? resolved : defaultSdkRoot(ioWithJdk)
  if (hasRn76AndroidPackages(sdkRoot, ioWithJdk)) {
    return { sdkRoot, javaHome: jdk.javaHome, installed: false }
  }
  const tools = ensureCommandLineTools(sdkRoot, ioWithJdk)
  const proxyArgs = sdkmanagerProxyArgs(ioWithJdk)
  io.log("Accepting Android SDK licenses")
  runChecked(ioWithJdk, tools.bin, [`--sdk_root=${sdkRoot}`, ...proxyArgs, "--licenses"], {
    env,
    input: `${"y\n".repeat(200)}`,
  })
  io.log(`Installing Android SDK packages for RN 0.76: ${SDKMANAGER_PACKAGES.join(", ")}`)
  runChecked(ioWithJdk, tools.bin, [`--sdk_root=${sdkRoot}`, ...proxyArgs, ...SDKMANAGER_PACKAGES], { env })
  if (!hasRn76AndroidPackages(sdkRoot, ioWithJdk)) {
    throw new Error(`Android SDK install finished but ${sdkRoot} is still missing RN 0.76 platforms/build-tools`)
  }
  return { sdkRoot, javaHome: jdk.javaHome, installed: true }
}

function main(argv, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  const appRoot = io.appRoot || path.resolve(__dirname, "..")
  const cmd = argv[2]
  try {
    if (cmd === "resolve") {
      const sdkRoot = resolveAndroidSdk(io)
      if (!sdkRoot) {
        io.error(MISSING_SDK_MESSAGE)
        io.exit(1)
        return 1
      }
      io.log(sdkRoot)
      return 0
    }
    if (cmd === "prepare") {
      const result = prepareAndroidLocalBuild(appRoot, io)
      if (result.skipped) {
        io.log(`Skipping Android SDK local.properties (${result.skipped})`)
        return 0
      }
      io.log(
        `Wrote Android SDK location ${result.sdkRoot} and JDK ${result.javaHome}` +
          (result.wrapper?.changed ? " (injected JAVA_HOME into android/gradlew)" : ""),
      )
      return 0
    }
    if (cmd === "print-env") {
      const javaHome = resolveJavaHome(io)
      if (!javaHome) {
        io.error(MISSING_JDK_MESSAGE)
        io.exit(1)
        return 1
      }
      const sdkRoot = resolveAndroidSdk(io)
      const env = androidBuildEnv(io, javaHome, sdkRoot)
      io.log(`export JAVA_HOME=${shellSingleQuote(env.JAVA_HOME)}`)
      io.log(`export PATH=${shellSingleQuote(path.join(env.JAVA_HOME, "bin"))}:"$PATH"`)
      if (env.ANDROID_HOME) {
        io.log(`export ANDROID_HOME=${shellSingleQuote(env.ANDROID_HOME)}`)
        io.log(`export ANDROID_SDK_ROOT=${shellSingleQuote(env.ANDROID_SDK_ROOT)}`)
      }
      if (env.ANDROID_NDK_HOME) {
        io.log(`export ANDROID_NDK_HOME=${shellSingleQuote(env.ANDROID_NDK_HOME)}`)
      }
      if (env.ORG_GRADLE_PROJECT_reactNativeArchitectures) {
        io.log(
          `export ORG_GRADLE_PROJECT_reactNativeArchitectures=${shellSingleQuote(
            env.ORG_GRADLE_PROJECT_reactNativeArchitectures,
          )}`,
        )
      }
      if (env.CMAKE_BUILD_PARALLEL_LEVEL) {
        io.log(`export CMAKE_BUILD_PARALLEL_LEVEL=${shellSingleQuote(env.CMAKE_BUILD_PARALLEL_LEVEL)}`)
      }
      if (env.NINJAFLAGS) {
        io.log(`export NINJAFLAGS=${shellSingleQuote(env.NINJAFLAGS)}`)
      }
      if (env.GRADLE_OPTS) {
        io.log(`export GRADLE_OPTS=${shellSingleQuote(env.GRADLE_OPTS)}`)
      }
      return 0
    }
    if (cmd === "with-jdk") {
      let rest = argv.slice(3)
      if (rest[0] === "--") rest = rest.slice(1)
      if (!rest.length) {
        io.error("Usage: node scripts/android-sdk.cjs with-jdk <command> [args...]")
        io.exit(1)
        return 1
      }
      const javaHome = resolveJavaHome(io)
      if (!javaHome) {
        io.error(MISSING_JDK_MESSAGE)
        io.exit(1)
        return 1
      }
      const env = androidBuildEnv(io, javaHome, resolveAndroidSdk(io))
      const result = io.spawnSync(rest[0], rest.slice(1), {
        env,
        stdio: "inherit",
        cwd: appRoot,
      })
      const status = result.status == null ? 1 : result.status
      if (status !== 0) {
        io.exit(status)
        return status
      }
      return 0
    }
    if (cmd === "ensure") {
      const result = ensureAndroidSdk(io)
      io.log(
        result.installed
          ? `Installed Android SDK at ${result.sdkRoot}`
          : `Android SDK already present at ${result.sdkRoot}`,
      )
      return 0
    }
    io.error("Usage: node scripts/android-sdk.cjs <resolve|prepare|ensure|print-env|with-jdk>")
    io.exit(1)
    return 1
  } catch (err) {
    io.error(err instanceof Error ? err.message : String(err))
    io.exit(1)
    return 1
  }
}

module.exports = {
  RN_COMPILE_SDK,
  RN_BUILD_TOOLS,
  RN_NDK,
  SDKMANAGER_PACKAGES,
  CMDLINE_TOOLS_URL,
  TEMURIN17_URL,
  MISSING_SDK_MESSAGE,
  MISSING_JDK_MESSAGE,
  defaultSdkRoot,
  isValidAndroidSdk,
  hasRn76AndroidPackages,
  candidateSdkRoots,
  resolveAndroidSdk,
  isJdkHome,
  userJdkRoots,
  resolveJavaHome,
  GRADLEW_JAVA_HOME_BEGIN,
  GRADLEW_JAVA_HOME_END,
  shellSingleQuote,
  gradleSdkDirProperty,
  upsertPropertyLine,
  writeAndroidLocalProperties,
  writeGradleJavaHome,
  writeGradleCiLimits,
  upsertGradlewJavaHome,
  writeGradlewJavaHome,
  easBuildPlatform,
  isEasBuild,
  androidPrepareSkipReason,
  prepareAndroidLocalBuild,
  sdkmanagerBin,
  sdkmanagerProxyArgs,
  jdkProcessEnv,
  androidBuildEnv,
  ensureJdk,
  extractCommandLineTools,
  ensureCommandLineTools,
  ensureAndroidSdk,
  main,
}

if (require.main === module) {
  const envRoot = process.env.MORPHOS_MOBILE_APP_ROOT?.trim()
  main(process.argv, { appRoot: envRoot || path.resolve(__dirname, "..") })
}
