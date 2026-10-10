import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { describe, it, after } from "node:test"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const scriptPath = fileURLToPath(new URL("../scripts/android-sdk.cjs", import.meta.url))
const sdk = require("../scripts/android-sdk.cjs") as {
  RN_COMPILE_SDK: string
  RN_BUILD_TOOLS: string
  SDKMANAGER_PACKAGES: string[]
  TEMURIN17_URL: string
  MISSING_SDK_MESSAGE: string
  MISSING_JDK_MESSAGE: string
  defaultSdkRoot: (io?: Record<string, unknown>) => string
  isValidAndroidSdk: (sdkRoot: string | null, io?: Record<string, unknown>) => boolean
  hasRn76AndroidPackages: (sdkRoot: string | null, io?: Record<string, unknown>) => boolean
  candidateSdkRoots: (io?: Record<string, unknown>) => string[]
  resolveAndroidSdk: (io?: Record<string, unknown>) => string | null
  isJdkHome: (javaHome: string | undefined, io?: Record<string, unknown>) => boolean
  userJdkRoots: (io?: Record<string, unknown>) => string[]
  resolveJavaHome: (io?: Record<string, unknown>) => string | null
  gradleSdkDirProperty: (sdkRoot: string) => string
  upsertPropertyLine: (body: string, key: string, value: string) => string
  writeAndroidLocalProperties: (
    appRoot: string,
    sdkRoot: string,
    io?: Record<string, unknown>,
  ) => { path: string; changed: boolean }
  writeGradleJavaHome: (
    appRoot: string,
    javaHome: string,
    io?: Record<string, unknown>,
  ) => { path: string; changed: boolean }
  writeGradleCiLimits: (
    appRoot: string,
    io?: Record<string, unknown>,
  ) => { path: string; changed: boolean }
  GRADLEW_JAVA_HOME_BEGIN: string
  GRADLEW_JAVA_HOME_END: string
  shellSingleQuote: (value: string) => string
  upsertGradlewJavaHome: (body: string, javaHome: string) => string
  writeGradlewJavaHome: (
    appRoot: string,
    javaHome: string,
    io?: Record<string, unknown>,
  ) => { path: string; changed: boolean }
  easBuildPlatform: (io?: Record<string, unknown>) => string
  isEasBuild: (io?: Record<string, unknown>) => boolean
  androidPrepareSkipReason: (appRoot: string, io?: Record<string, unknown>) => string | null
  prepareAndroidLocalBuild: (
    appRoot: string,
    io?: Record<string, unknown>,
  ) => {
    skipped: string | null
    sdkRoot?: string
    javaHome?: string
    sdk?: { path: string; changed: boolean }
    jdk?: { path: string; changed: boolean }
    limits?: { path: string; changed: boolean }
    wrapper?: { path: string; changed: boolean }
  }
  sdkmanagerBin: (sdkRoot: string) => string
  sdkmanagerProxyArgs: (io?: Record<string, unknown>) => string[]
  jdkProcessEnv: (io: Record<string, unknown>, javaHome: string) => Record<string, string>
  androidBuildEnv: (io: Record<string, unknown>, javaHome: string, sdkRoot?: string | null) => Record<string, string>
  ensureJdk: (io?: Record<string, unknown>) => { installed: boolean; javaHome: string }
  extractCommandLineTools: (zipPath: string, sdkRoot: string, io: Record<string, unknown>) => void
  ensureCommandLineTools: (
    sdkRoot: string,
    io?: Record<string, unknown>,
  ) => { installed: boolean; bin: string }
  ensureAndroidSdk: (io?: Record<string, unknown>) => {
    sdkRoot: string
    javaHome: string
    installed: boolean
  }
  main: (argv: string[], io?: Record<string, unknown>) => number
}

const tmpRoots: string[] = []

function tmpDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "morphos-android-sdk-"))
  tmpRoots.push(dir)
  return dir
}

after(() => {
  for (const dir of tmpRoots) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function writeSdk(root: string, opts?: { rn76?: boolean; adb?: boolean }): string {
  mkdirSync(path.join(root, "platform-tools"), { recursive: true })
  if (opts?.adb !== false) writeFileSync(path.join(root, "platform-tools", "adb"), "#!/bin/sh\n")
  mkdirSync(path.join(root, "platforms", opts?.rn76 === false ? "android-33" : "android-35"), { recursive: true })
  mkdirSync(path.join(root, "build-tools", opts?.rn76 === false ? "33.0.0" : "35.0.0"), { recursive: true })
  return root
}

function writeJdk(root: string): string {
  mkdirSync(path.join(root, "bin"), { recursive: true })
  writeFileSync(path.join(root, "bin", "javac"), "#!/bin/sh\n")
  return root
}

describe("Android SDK path resolution", () => {
  it("rejects empty, adb-only, and unreadable SDK roots", () => {
    const incomplete = path.join(tmpDir(), "adb-only")
    mkdirSync(path.join(incomplete, "platform-tools"), { recursive: true })
    writeFileSync(path.join(incomplete, "platform-tools", "adb"), "ok\n")
    assert.equal(sdk.isValidAndroidSdk(""), false)
    assert.equal(sdk.isValidAndroidSdk(incomplete), false)
    assert.equal(
      sdk.isValidAndroidSdk("/sdk", {
        existsSync: () => true,
        readdirSync: () => {
          throw new Error("eacces")
        },
      }),
      false,
    )
  })

  it("accepts a Linux SDK with platforms and build-tools", () => {
    const root = writeSdk(path.join(tmpDir(), "Sdk"))
    assert.equal(sdk.isValidAndroidSdk(root), true)
    assert.equal(sdk.hasRn76AndroidPackages(root), true)
    assert.equal(sdk.hasRn76AndroidPackages(writeSdk(path.join(tmpDir(), "old"), { rn76: false })), false)
    assert.match(sdk.TEMURIN17_URL, /^https:\/\/github\.com\/adoptium\/temurin17-binaries\/releases\/download\//)
  })

  it("prefers ANDROID_HOME over default locations", () => {
    const homeSdk = writeSdk(path.join(tmpDir(), "home-sdk"))
    const envSdk = writeSdk(path.join(tmpDir(), "env-sdk"))
    const resolved = sdk.resolveAndroidSdk({
      env: { ANDROID_HOME: envSdk, ANDROID_SDK_ROOT: homeSdk },
      homedir: () => path.dirname(homeSdk),
    })
    assert.equal(resolved, envSdk)
    assert.deepEqual(
      sdk.candidateSdkRoots({ env: { ANDROID_HOME: envSdk, ANDROID_SDK_ROOT: envSdk }, homedir: () => "/home/dev" }),
      [envSdk, path.join("/home/dev", "Android", "Sdk"), "/opt/android-sdk", "/usr/lib/android-sdk"],
    )
  })

  it("returns null when no candidate is a real SDK", () => {
    assert.equal(
      sdk.resolveAndroidSdk({
        env: {},
        homedir: () => path.join(tmpDir(), "empty-home"),
        existsSync: () => false,
      }),
      null,
    )
    assert.equal(sdk.defaultSdkRoot({ homedir: () => "/home/dev" }), path.join("/home/dev", "Android", "Sdk"))
  })
})

describe("JDK resolution", () => {
  it("uses JAVA_HOME when javac exists", () => {
    const javaHome = writeJdk(path.join(tmpDir(), "jdk"))
    assert.equal(sdk.isJdkHome(javaHome), true)
    assert.equal(sdk.isJdkHome(undefined), false)
    assert.equal(sdk.resolveJavaHome({ env: { JAVA_HOME: javaHome } }), javaHome)
  })

  it("falls back to which javac", () => {
    const javaHome = writeJdk(path.join(tmpDir(), "jdk-which"))
    const resolved = sdk.resolveJavaHome({
      env: {},
      existsSync: (p: string) => p === path.join(javaHome, "bin", "javac"),
      spawnSync: (cmd: string) =>
        cmd === "which"
          ? { status: 0, stdout: `${path.join(javaHome, "bin", "javac")}\n`, stderr: "" }
          : { status: 1, stdout: "", stderr: "" },
    })
    assert.equal(resolved, javaHome)
  })

  it("returns null when no JDK is present", () => {
    assert.equal(
      sdk.resolveJavaHome({
        env: {},
        existsSync: () => false,
        spawnSync: () => ({ status: 1, stdout: "", stderr: "" }),
      }),
      null,
    )
    assert.deepEqual(sdk.userJdkRoots({ existsSync: () => false }), [])
    assert.deepEqual(
      sdk.userJdkRoots({
        homedir: () => "/home/dev",
        existsSync: () => true,
        readdirSync: () => {
          throw new Error("eacces")
        },
      }),
      [],
    )
  })

  it("finds a user-local Temurin JDK under ~/.local/jdk", () => {
    const home = tmpDir()
    const javaHome = writeJdk(path.join(home, ".local", "jdk", "jdk-17.0.16+8"))
    // Do not consult the real filesystem for /usr/lib/jvm — CI runners that
    // already ran eas:ensure-android-sdk have OpenJDK 17 there and would
    // otherwise win over the fixture.
    assert.equal(
      sdk.resolveJavaHome({
        env: {},
        homedir: () => home,
        existsSync: (p: string) => p.startsWith(home) && existsSync(p),
        spawnSync: () => ({ status: 1, stdout: "", stderr: "" }),
      }),
      javaHome,
    )
  })

  it("prefers a system OpenJDK 17 over ~/.local/jdk", () => {
    const home = tmpDir()
    writeJdk(path.join(home, ".local", "jdk", "jdk-17.0.16+8"))
    const system = "/usr/lib/jvm/java-17-openjdk-amd64"
    assert.equal(
      sdk.resolveJavaHome({
        env: {},
        homedir: () => home,
        existsSync: (p: string) => p.startsWith(system) || (p.startsWith(home) && existsSync(p)),
        spawnSync: () => ({ status: 1, stdout: "", stderr: "" }),
      }),
      system,
    )
  })
})

describe("Gradle property files", () => {
  it("escapes Windows SDK paths for local.properties", () => {
    assert.equal(sdk.gradleSdkDirProperty("C:\\Android Sdk"), "C\\:\\\\Android\\ Sdk")
  })

  it("inserts and replaces property lines", () => {
    assert.equal(sdk.upsertPropertyLine("", "sdk.dir", "/sdk"), "sdk.dir=/sdk\n")
    assert.equal(sdk.upsertPropertyLine("sdk.dir=/old\n", "sdk.dir", "/new"), "sdk.dir=/new\n")
    assert.equal(sdk.upsertPropertyLine("android.useAndroidX=true\n", "sdk.dir", "/sdk"), "android.useAndroidX=true\nsdk.dir=/sdk\n")
  })

  it("writes local.properties and gradle.properties", () => {
    const appRoot = tmpDir()
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    const sdkWrite = sdk.writeAndroidLocalProperties(appRoot, "/home/dev/Android/Sdk")
    const jdkWrite = sdk.writeGradleJavaHome(appRoot, "/usr/lib/jvm/java-17-openjdk-amd64")
    assert.equal(sdkWrite.changed, true)
    assert.equal(jdkWrite.changed, true)
    assert.match(readFileSync(sdkWrite.path, "utf8"), /^sdk.dir=\/home\/dev\/Android\/Sdk$/m)
    assert.match(readFileSync(jdkWrite.path, "utf8"), /^org.gradle.java.home=\/usr\/lib\/jvm\/java-17-openjdk-amd64$/m)
    assert.equal(sdk.writeAndroidLocalProperties(appRoot, "/home/dev/Android/Sdk").changed, false)
    const skippedLimits = sdk.writeGradleCiLimits(appRoot, { env: {} })
    assert.equal(skippedLimits.changed, false)
    const missingApp = tmpDir()
    mkdirSync(path.join(missingApp, "android"), { recursive: true })
    const createdLimits = sdk.writeGradleCiLimits(missingApp, { env: { GITHUB_ACTIONS: "true" } })
    assert.equal(createdLimits.changed, true)
    assert.match(readFileSync(createdLimits.path, "utf8"), /^org\.gradle\.workers\.max=2$/m)
    const limitsWrite = sdk.writeGradleCiLimits(appRoot, { env: { MORPHOS_ANDROID_CI_LIMITS: "1" } })
    assert.equal(limitsWrite.changed, true)
    assert.match(readFileSync(limitsWrite.path, "utf8"), /^reactNativeArchitectures=arm64-v8a$/m)
    assert.equal(sdk.writeGradleCiLimits(appRoot, { env: { MORPHOS_ANDROID_CI_LIMITS: "1" } }).changed, false)
  })

  it("quotes JAVA_HOME for POSIX shells", () => {
    assert.equal(sdk.shellSingleQuote("/home/runner/.local/jdk/jdk-17.0.16+8"), "'/home/runner/.local/jdk/jdk-17.0.16+8'")
    assert.equal(sdk.shellSingleQuote("it's"), "'it'\\''s'")
  })

  it("injects JAVA_HOME into gradlew after the shebang so the wrapper can start", () => {
    const javaHome = "/home/runner/.local/jdk/jdk-17.0.16+8"
    const next = sdk.upsertGradlewJavaHome("#!/bin/sh\n# Copyright\n", javaHome)
    assert.equal(next.startsWith("#!/bin/sh\n"), true)
    assert.match(next, new RegExp(`^${sdk.GRADLEW_JAVA_HOME_BEGIN}$`, "m"))
    assert.match(next, /export JAVA_HOME='\/home\/runner\/\.local\/jdk\/jdk-17\.0\.16\+8'/)
    assert.match(next, /export PATH="\$JAVA_HOME\/bin:\$PATH"/)
    assert.match(next, /# Copyright/)
    const replaced = sdk.upsertGradlewJavaHome(next, "/jdk-b")
    assert.equal(replaced.includes(javaHome), false)
    assert.match(replaced, /JAVA_HOME='\/jdk-b'/)
    assert.equal(replaced.split(sdk.GRADLEW_JAVA_HOME_BEGIN).length, 2)
    assert.equal(sdk.upsertGradlewJavaHome("no shebang\n", "/jdk"), `${sdk.GRADLEW_JAVA_HOME_BEGIN}\nexport JAVA_HOME='/jdk'\nexport PATH="$JAVA_HOME/bin:$PATH"\n${sdk.GRADLEW_JAVA_HOME_END}\nno shebang\n`)
    assert.match(sdk.upsertGradlewJavaHome("#!/bin/sh", "/jdk"), /^# morphos-java-home-begin\n/)
  })

  it("writes gradlew when present and skips when the wrapper is missing", () => {
    const appRoot = tmpDir()
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    const missing = sdk.writeGradlewJavaHome(appRoot, "/jdk")
    assert.equal(missing.changed, false)
    writeFileSync(path.join(appRoot, "android", "gradlew"), "#!/bin/sh\necho gradle\n")
    const first = sdk.writeGradlewJavaHome(appRoot, "/home/runner/.local/jdk/jdk-17.0.16+8")
    assert.equal(first.changed, true)
    assert.match(readFileSync(first.path, "utf8"), /export JAVA_HOME='\/home\/runner\/\.local\/jdk\/jdk-17\.0\.16\+8'/)
    assert.equal(sdk.writeGradlewJavaHome(appRoot, "/home/runner/.local/jdk/jdk-17.0.16+8").changed, false)
  })
})

describe("prepareAndroidLocalBuild", () => {
  it("skips when android/ does not exist", () => {
    assert.deepEqual(sdk.prepareAndroidLocalBuild(tmpDir(), { env: {} }), { skipped: "no-android" })
  })

  it("throws when the Linux Android SDK is missing", () => {
    const appRoot = tmpDir()
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    assert.throws(
      () => sdk.prepareAndroidLocalBuild(appRoot, { env: {}, platform: "linux", homedir: () => path.join(appRoot, "no-sdk"), existsSync: (p: string) => p === path.join(appRoot, "android") }),
      new RegExp(sdk.MISSING_SDK_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    )
  })

  it("throws when javac is missing", () => {
    const appRoot = tmpDir()
    const sdkRoot = writeSdk(path.join(appRoot, "Sdk"))
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    assert.throws(
      () =>
        sdk.prepareAndroidLocalBuild(appRoot, {
          env: { ANDROID_HOME: sdkRoot },
          existsSync: (p: string) => p === path.join(appRoot, "android") || p.startsWith(sdkRoot),
          readdirSync: (p: string) => (p.includes("platforms") ? ["android-35"] : p.includes("build-tools") ? ["35.0.0"] : []),
          spawnSync: () => ({ status: 1, stdout: "", stderr: "" }),
        }),
      new RegExp(sdk.MISSING_JDK_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    )
  })

  it("writes SDK and JDK locations when both exist", () => {
    const appRoot = tmpDir()
    const sdkRoot = writeSdk(path.join(appRoot, "Sdk"))
    const javaHome = writeJdk(path.join(appRoot, "jdk"))
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    writeFileSync(path.join(appRoot, "android", "gradlew"), "#!/bin/sh\necho gradle\n")
    const result = sdk.prepareAndroidLocalBuild(appRoot, {
      env: { ANDROID_HOME: sdkRoot, JAVA_HOME: javaHome, EAS_BUILD_PLATFORM: "android" },
      platform: "linux",
    })
    assert.equal(result.skipped, null)
    assert.equal(result.sdkRoot, sdkRoot)
    assert.equal(result.javaHome, javaHome)
    assert.equal(existsSync(path.join(appRoot, "android", "local.properties")), true)
    assert.equal(result.wrapper?.changed, true)
    assert.equal(result.limits?.changed, false)
    assert.match(readFileSync(path.join(appRoot, "android", "gradlew"), "utf8"), /export JAVA_HOME=/)
  })

  it("writes ABI and worker limits into gradle.properties during prepare on CI", () => {
    const appRoot = tmpDir()
    const sdkRoot = writeSdk(path.join(appRoot, "Sdk"))
    const javaHome = writeJdk(path.join(appRoot, "jdk"))
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    writeFileSync(path.join(appRoot, "android", "gradle.properties"), "reactNativeArchitectures=x86,x86_64\n")
    writeFileSync(path.join(appRoot, "android", "gradlew"), "#!/bin/sh\necho gradle\n")
    const result = sdk.prepareAndroidLocalBuild(appRoot, {
      env: {
        ANDROID_HOME: sdkRoot,
        JAVA_HOME: javaHome,
        EAS_BUILD_PLATFORM: "android",
        MORPHOS_ANDROID_CI_LIMITS: "1",
      },
      platform: "linux",
    })
    assert.equal(result.skipped, null)
    assert.equal(result.limits?.changed, true)
    assert.match(readFileSync(path.join(appRoot, "android", "gradle.properties"), "utf8"), /^reactNativeArchitectures=arm64-v8a$/m)
  })

  it("skips on EAS iOS even when android/ is present and no Linux SDK exists", () => {
    const appRoot = tmpDir()
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    assert.equal(sdk.easBuildPlatform({ env: { EAS_BUILD_PLATFORM: "ios" } }), "ios")
    assert.equal(sdk.easBuildPlatform({ env: { EAS_BUILD_PLATFORM: "Android" } }), "android")
    assert.equal(sdk.isEasBuild({ env: { EAS_BUILD: "true" } }), true)
    assert.equal(sdk.isEasBuild({ env: {} }), false)
    assert.equal(
      sdk.androidPrepareSkipReason(appRoot, { env: { EAS_BUILD_PLATFORM: "ios" }, platform: "darwin" }),
      "eas-ios",
    )
    assert.deepEqual(
      sdk.prepareAndroidLocalBuild(appRoot, {
        env: { EAS_BUILD: "true", EAS_BUILD_PLATFORM: "ios" },
        platform: "darwin",
        existsSync: () => true,
      }),
      { skipped: "eas-ios" },
    )
  })

  it("skips on macOS EAS when the platform is not Android", () => {
    const appRoot = tmpDir()
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    assert.equal(
      sdk.androidPrepareSkipReason(appRoot, {
        env: { EAS_BUILD: "true" },
        platform: "darwin",
        existsSync: () => true,
      }),
      "darwin",
    )
    assert.equal(
      sdk.androidPrepareSkipReason(appRoot, {
        env: { EAS_BUILD: "true", EAS_BUILD_PLATFORM: "android" },
        platform: "darwin",
        existsSync: () => true,
      }),
      null,
    )
  })

  it("still requires a Linux SDK on EAS Android when android/ exists", () => {
    const appRoot = tmpDir()
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    assert.equal(
      sdk.androidPrepareSkipReason(appRoot, {
        env: { EAS_BUILD: "true", EAS_BUILD_PLATFORM: "android" },
        platform: "linux",
        existsSync: (p: string) => p === path.join(appRoot, "android"),
      }),
      null,
    )
    assert.throws(
      () =>
        sdk.prepareAndroidLocalBuild(appRoot, {
          env: { EAS_BUILD: "true", EAS_BUILD_PLATFORM: "android" },
          platform: "linux",
          homedir: () => path.join(appRoot, "no-sdk"),
          existsSync: (p: string) => p === path.join(appRoot, "android"),
        }),
      new RegExp(sdk.MISSING_SDK_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    )
  })
})

describe("ensure Android SDK", () => {
  it("skips JDK install when javac is already present", () => {
    const javaHome = writeJdk(path.join(tmpDir(), "jdk"))
    const result = sdk.ensureJdk({ env: { JAVA_HOME: javaHome } })
    assert.deepEqual(result, { installed: false, javaHome })
  })

  it("installs OpenJDK 17 when javac is missing", () => {
    const javaHome = "/usr/lib/jvm/java-17-openjdk-amd64"
    let installed = false
    const result = sdk.ensureJdk({
      env: {},
      log: () => undefined,
      existsSync: (p: string) => installed && p === path.join(javaHome, "bin", "javac"),
      spawnSync: (cmd: string, args: string[]) => {
        if (cmd === "sudo" && args.includes("openjdk-17-jdk-headless")) {
          installed = true
          return { status: 0, stdout: "", stderr: "" }
        }
        return { status: 1, stdout: "", stderr: "" }
      },
    })
    assert.equal(result.installed, true)
    assert.equal(result.javaHome, javaHome)
  })

  it("downloads Temurin 17 when sudo apt is unavailable", () => {
    const home = tmpDir()
    const javaHome = path.join(home, ".local", "jdk", "jdk-17.0.16+8")
    let extracted = false
    const result = sdk.ensureJdk({
      env: {},
      homedir: () => home,
      log: () => undefined,
      existsSync: (p: string) => {
        if (p === path.join(javaHome, "bin", "javac")) return extracted
        if (p === path.join(home, ".local", "jdk")) return true
        return false
      },
      readdirSync: (p: string) =>
        extracted && p === path.join(home, ".local", "jdk") ? ["jdk-17.0.16+8"] : [],
      spawnSync: (cmd: string) => {
        if (cmd === "sudo") return { status: 1, stdout: "", stderr: "sudo: a password is required" }
        if (cmd === "curl" || cmd === "tar" || cmd === "rm") {
          extracted = true
          return { status: 0, stdout: "", stderr: "" }
        }
        return { status: 1, stdout: "", stderr: "" }
      },
    })
    assert.equal(result.installed, true)
    assert.equal(result.javaHome, javaHome)
  })

  it("reuses an RN 0.76 SDK that is already installed", () => {
    const sdkRoot = writeSdk(path.join(tmpDir(), "Sdk"))
    const javaHome = writeJdk(path.join(tmpDir(), "jdk"))
    const result = sdk.ensureAndroidSdk({ env: { ANDROID_HOME: sdkRoot, JAVA_HOME: javaHome } })
    assert.deepEqual(result, { sdkRoot, javaHome, installed: false })
  })

  it("downloads command-line tools and installs RN 0.76 packages", () => {
    const root = tmpDir()
    const sdkRoot = path.join(root, "Android", "Sdk")
    const javaHome = writeJdk(path.join(root, "jdk"))
    const calls: string[] = []
    const result = sdk.ensureAndroidSdk({
      env: { JAVA_HOME: javaHome, HTTPS_PROXY: "http://egress-proxy:3128" },
      homedir: () => root,
      log: () => undefined,
      spawnSync: (cmd: string, args: string[]) => {
        calls.push([cmd, ...args].join(" "))
        if (cmd === "curl") return { status: 0, stdout: "", stderr: "" }
        if (cmd === "python3") {
          mkdirSync(path.join(sdkRoot, ".cmdline-tools-staging", "cmdline-tools", "bin"), { recursive: true })
          writeFileSync(path.join(sdkRoot, ".cmdline-tools-staging", "cmdline-tools", "bin", "sdkmanager"), "ok\n")
          return { status: 0, stdout: "", stderr: "" }
        }
        if (cmd === "rm" || cmd === "mv" || cmd === "chmod") {
          if (cmd === "mv") {
            mkdirSync(path.join(sdkRoot, "cmdline-tools", "latest", "bin"), { recursive: true })
            writeFileSync(path.join(sdkRoot, "cmdline-tools", "latest", "bin", "sdkmanager"), "ok\n")
          }
          return { status: 0, stdout: "", stderr: "" }
        }
        if (String(args[0] || "").startsWith("--sdk_root=") && args.includes("platforms;android-35")) {
          writeSdk(sdkRoot)
          return { status: 0, stdout: "", stderr: "" }
        }
        if (String(args[0] || "").startsWith("--sdk_root=")) return { status: 0, stdout: "", stderr: "" }
        return { status: 1, stdout: "", stderr: "unexpected" }
      },
    })
    assert.equal(result.installed, true)
    assert.equal(result.sdkRoot, sdkRoot)
    assert.match(calls.join("\n"), /curl /)
    assert.match(calls.join("\n"), /platforms;android-35/)
    assert.match(calls.join("\n"), /--proxy_host=egress-proxy/)
  })

  it("throws when a spawned install command fails", () => {
    const javaHome = writeJdk(path.join(tmpDir(), "jdk"))
    assert.throws(
      () =>
        sdk.ensureJdk({
          env: {},
          log: () => undefined,
          existsSync: () => false,
          spawnSync: (cmd: string) =>
            cmd === "sudo" ? { status: 0, stdout: "installed", stderr: "" } : { status: 1, stdout: "", stderr: "" },
        }),
      /JDK not found/,
    )
    assert.throws(
      () =>
        sdk.ensureJdk({
          env: {},
          homedir: () => tmpDir(),
          log: () => undefined,
          existsSync: () => false,
          spawnSync: () => ({ status: 1, stdout: "", stderr: "apt down" }),
        }),
      /curl .* failed\napt down/,
    )
    assert.throws(
      () =>
        sdk.ensureCommandLineTools(path.join(tmpDir(), "Sdk"), {
          env: { JAVA_HOME: javaHome },
          log: () => undefined,
          spawnSync: () => ({ status: 1, stdout: "nope", stderr: "" }),
        }),
      /curl .* failed\nnope/,
    )
  })

  it("throws when sdkmanager is missing after extract", () => {
    const sdkRoot = path.join(tmpDir(), "Sdk")
    assert.throws(
      () =>
        sdk.ensureCommandLineTools(sdkRoot, {
          log: () => undefined,
          spawnSync: () => ({ status: 0, stdout: "", stderr: "" }),
        }),
      /sdkmanager missing after extracting/,
    )
  })

  it("throws when packages install but the SDK is still incomplete", () => {
    const root = tmpDir()
    const sdkRoot = path.join(root, "Android", "Sdk")
    const javaHome = writeJdk(path.join(root, "jdk"))
    mkdirSync(path.join(sdkRoot, "cmdline-tools", "latest", "bin"), { recursive: true })
    writeFileSync(sdk.sdkmanagerBin(sdkRoot), "ok\n")
    assert.throws(
      () =>
        sdk.ensureAndroidSdk({
          env: { JAVA_HOME: javaHome },
          homedir: () => root,
          log: () => undefined,
          spawnSync: () => ({ status: 0, stdout: "", stderr: "" }),
        }),
      /still missing RN 0.76/,
    )
  })

  it("skips downloading command-line tools when sdkmanager already exists", () => {
    const sdkRoot = path.join(tmpDir(), "Sdk")
    mkdirSync(path.dirname(sdk.sdkmanagerBin(sdkRoot)), { recursive: true })
    writeFileSync(sdk.sdkmanagerBin(sdkRoot), "ok\n")
    const result = sdk.ensureCommandLineTools(sdkRoot, {
      spawnSync: () => {
        throw new Error("should not spawn")
      },
    })
    assert.equal(result.installed, false)
    assert.equal(result.bin, sdk.sdkmanagerBin(sdkRoot))
  })

  it("passes Squid HTTP proxy flags to sdkmanager", () => {
    assert.deepEqual(sdk.sdkmanagerProxyArgs({ env: {} }), [])
    assert.deepEqual(sdk.sdkmanagerProxyArgs({ env: { HTTPS_PROXY: "not a url" } }), [])
    assert.deepEqual(sdk.sdkmanagerProxyArgs({ env: { HTTPS_PROXY: "http://egress-proxy:3128" } }), [
      "--proxy=http",
      "--proxy_host=egress-proxy",
      "--proxy_port=3128",
    ])
    assert.deepEqual(sdk.sdkmanagerProxyArgs({ env: { http_proxy: "http://127.0.0.1" } }), [
      "--proxy=http",
      "--proxy_host=127.0.0.1",
      "--proxy_port=80",
    ])
    const javaHome = "/home/runner/.local/jdk/jdk-17.0.16+8"
    const env = sdk.jdkProcessEnv({ env: { PATH: "/usr/bin", HTTPS_PROXY: "http://egress-proxy:3128" } }, javaHome)
    assert.equal(env.JAVA_HOME, javaHome)
    assert.equal(env.PATH.startsWith(`${javaHome}/bin:`), true)
    assert.equal(env.HTTPS_PROXY, "http://egress-proxy:3128")
    const sdkRoot = path.join(tmpDir(), "Sdk")
    mkdirSync(path.join(sdkRoot, "ndk", "26.1.10909125"), { recursive: true })
    const withNdk = sdk.androidBuildEnv(
      { env: { PATH: "/usr/bin" }, existsSync: (p: string) => p === path.join(sdkRoot, "ndk", "26.1.10909125") },
      javaHome,
      sdkRoot,
    )
    assert.equal(withNdk.ANDROID_HOME, sdkRoot)
    assert.equal(withNdk.ANDROID_SDK_ROOT, sdkRoot)
    assert.equal(withNdk.ANDROID_NDK_HOME, path.join(sdkRoot, "ndk", "26.1.10909125"))
    const noSdk = sdk.androidBuildEnv({ env: { PATH: "/usr/bin" }, existsSync: () => false }, javaHome, null)
    assert.equal(noSdk.ANDROID_HOME, undefined)
    assert.equal(noSdk.ANDROID_NDK_HOME, undefined)
    const noNdk = sdk.androidBuildEnv({ env: { PATH: "/usr/bin" }, existsSync: () => false }, javaHome, sdkRoot)
    assert.equal(noNdk.ANDROID_HOME, sdkRoot)
    assert.equal(noNdk.ANDROID_NDK_HOME, undefined)
  })
})

describe("android-sdk CLI", () => {
  it("prints a resolved SDK path", () => {
    const sdkRoot = writeSdk(path.join(tmpDir(), "Sdk"))
    const logs: string[] = []
    const code = sdk.main(["node", "android-sdk.cjs", "resolve"], {
      env: { ANDROID_HOME: sdkRoot },
      log: (msg: string) => logs.push(msg),
    })
    assert.equal(code, 0)
    assert.equal(logs[0], sdkRoot)
  })

  it("exits 1 when resolve finds no SDK", () => {
    const errors: string[] = []
    let exitCode: number | undefined
    const code = sdk.main(["node", "android-sdk.cjs", "resolve"], {
      env: {},
      homedir: () => path.join(tmpDir(), "none"),
      existsSync: () => false,
      error: (msg: string) => errors.push(msg),
      exit: (n: number) => {
        exitCode = n
      },
    })
    assert.equal(code, 1)
    assert.equal(exitCode, 1)
    assert.match(errors.join("\n"), /Android SDK not found/)
  })

  it("prepare skips without android/ and writes when the SDK exists", () => {
    const logs: string[] = []
    const skip = sdk.main(["node", "android-sdk.cjs", "prepare"], {
      appRoot: tmpDir(),
      env: {},
      log: (msg: string) => logs.push(msg),
    })
    assert.equal(skip, 0)
    assert.match(logs.join("\n"), /Skipping Android SDK local.properties \(no-android\)/)

    const appRoot = tmpDir()
    const sdkRoot = writeSdk(path.join(appRoot, "Sdk"))
    const javaHome = writeJdk(path.join(appRoot, "jdk"))
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    writeFileSync(path.join(appRoot, "android", "gradlew"), "#!/bin/sh\necho gradle\n")
    logs.length = 0
    const code = sdk.main(["node", "android-sdk.cjs", "prepare"], {
      appRoot,
      env: { ANDROID_HOME: sdkRoot, JAVA_HOME: javaHome, EAS_BUILD_PLATFORM: "android" },
      platform: "linux",
      log: (msg: string) => logs.push(msg),
    })
    assert.equal(code, 0)
    assert.match(logs.join("\n"), /Wrote Android SDK location/)
    assert.match(logs.join("\n"), /injected JAVA_HOME into android\/gradlew/)
  })

  it("prepare no-ops on EAS iOS so cloud macOS builders do not need a Linux SDK", () => {
    const appRoot = tmpDir()
    mkdirSync(path.join(appRoot, "android"), { recursive: true })
    const logs: string[] = []
    const ios = sdk.main(["node", "android-sdk.cjs", "prepare"], {
      appRoot,
      env: { EAS_BUILD: "true", EAS_BUILD_PLATFORM: "ios" },
      platform: "darwin",
      log: (msg: string) => logs.push(msg),
    })
    assert.equal(ios, 0)
    assert.match(logs.join("\n"), /Skipping Android SDK local.properties \(eas-ios\)/)

    logs.length = 0
    const darwin = sdk.main(["node", "android-sdk.cjs", "prepare"], {
      appRoot,
      env: { EAS_BUILD: "true" },
      platform: "darwin",
      log: (msg: string) => logs.push(msg),
    })
    assert.equal(darwin, 0)
    assert.match(logs.join("\n"), /Skipping Android SDK local.properties \(darwin\)/)
  })

  it("ensure logs whether it installed or reused the SDK", () => {
    const sdkRoot = writeSdk(path.join(tmpDir(), "Sdk"))
    const javaHome = writeJdk(path.join(tmpDir(), "jdk"))
    const logs: string[] = []
    const code = sdk.main(["node", "android-sdk.cjs", "ensure"], {
      env: { ANDROID_HOME: sdkRoot, JAVA_HOME: javaHome },
      log: (msg: string) => logs.push(msg),
    })
    assert.equal(code, 0)
    assert.match(logs.join("\n"), /already present/)
  })

  it("ensure logs an install and usage errors stringify", () => {
    const logs: string[] = []
    const root = tmpDir()
    const sdkRoot = path.join(root, "Android", "Sdk")
    const javaHome = writeJdk(path.join(root, "jdk"))
    const installed = sdk.main(["node", "android-sdk.cjs", "ensure"], {
      env: { JAVA_HOME: javaHome },
      homedir: () => root,
      log: (msg: string) => logs.push(msg),
      spawnSync: (cmd: string, args: string[]) => {
        if (cmd === "curl" || cmd === "python3" || cmd === "rm" || cmd === "chmod") return { status: 0, stdout: "", stderr: "" }
        if (cmd === "mv") {
          mkdirSync(path.join(sdkRoot, "cmdline-tools", "latest", "bin"), { recursive: true })
          writeFileSync(path.join(sdkRoot, "cmdline-tools", "latest", "bin", "sdkmanager"), "ok\n")
          return { status: 0, stdout: "", stderr: "" }
        }
        if (String(args[0] || "").startsWith("--sdk_root=") && args.includes("platforms;android-35")) {
          writeSdk(sdkRoot)
          return { status: 0, stdout: "", stderr: "" }
        }
        if (String(args[0] || "").startsWith("--sdk_root=")) return { status: 0, stdout: "", stderr: "" }
        return { status: 1, stdout: "", stderr: "unexpected" }
      },
    })
    assert.equal(installed, 0)
    assert.match(logs.join("\n"), /Installed Android SDK/)

    const errors: string[] = []
    let exitCode: number | undefined
    const usage = sdk.main(["node", "android-sdk.cjs"], {
      error: (msg: string) => errors.push(msg),
      exit: (n: number) => {
        exitCode = n
      },
    })
    assert.equal(usage, 1)
    assert.equal(exitCode, 1)
    assert.match(errors.join("\n"), /Usage:/)

    errors.length = 0
    const boom = sdk.main(["node", "android-sdk.cjs", "prepare"], {
      appRoot: tmpDir(),
      env: {},
      existsSync: () => {
        throw "boom"
      },
      error: (msg: string) => errors.push(msg),
      exit: () => {},
    })
    assert.equal(boom, 1)
    assert.equal(errors.join("\n"), "boom")
  })

  it("print-env exports JAVA_HOME and SDK roots for GitHub Actions eval", () => {
    const sdkRoot = writeSdk(path.join(tmpDir(), "Sdk"))
    const javaHome = writeJdk(path.join(tmpDir(), "jdk"))
    mkdirSync(path.join(sdkRoot, "ndk", "26.1.10909125"), { recursive: true })
    const logs: string[] = []
    const code = sdk.main(["node", "android-sdk.cjs", "print-env"], {
      env: { ANDROID_HOME: sdkRoot, JAVA_HOME: javaHome },
      log: (msg: string) => logs.push(msg),
    })
    assert.equal(code, 0)
    assert.equal(logs[0], `export JAVA_HOME='${javaHome}'`)
    assert.equal(logs[1], `export PATH='${path.join(javaHome, "bin")}':"$PATH"`)
    assert.equal(logs[2], `export ANDROID_HOME='${sdkRoot}'`)
    assert.equal(logs[3], `export ANDROID_SDK_ROOT='${sdkRoot}'`)
    assert.equal(logs[4], `export ANDROID_NDK_HOME='${path.join(sdkRoot, "ndk", "26.1.10909125")}'`)

    const jdkOnlyLogs: string[] = []
    const jdkOnly = sdk.main(["node", "android-sdk.cjs", "print-env"], {
      env: { JAVA_HOME: javaHome },
      homedir: () => path.join(tmpDir(), "empty-home"),
      existsSync: (p: string) => p === path.join(javaHome, "bin", "javac"),
      log: (msg: string) => jdkOnlyLogs.push(msg),
    })
    assert.equal(jdkOnly, 0)
    assert.equal(jdkOnlyLogs.some((line) => line.startsWith("export ANDROID_HOME=")), false)

    const noNdkLogs: string[] = []
    const noNdkSdk = writeSdk(path.join(tmpDir(), "Sdk-no-ndk"))
    const noNdkCode = sdk.main(["node", "android-sdk.cjs", "print-env"], {
      env: { ANDROID_HOME: noNdkSdk, JAVA_HOME: javaHome },
      log: (msg: string) => noNdkLogs.push(msg),
    })
    assert.equal(noNdkCode, 0)
    assert.equal(noNdkLogs.some((line) => line.startsWith("export ANDROID_HOME=")), true)
    assert.equal(noNdkLogs.some((line) => line.startsWith("export ANDROID_NDK_HOME=")), false)

    const ciLogs: string[] = []
    const ciCode = sdk.main(["node", "android-sdk.cjs", "print-env"], {
      env: { ANDROID_HOME: noNdkSdk, JAVA_HOME: javaHome, GITHUB_ACTIONS: "true" },
      log: (msg: string) => ciLogs.push(msg),
    })
    assert.equal(ciCode, 0)
    assert.equal(ciLogs.some((line) => line.startsWith("export ORG_GRADLE_PROJECT_reactNativeArchitectures=")), true)
    assert.equal(ciLogs.some((line) => line.startsWith("export CMAKE_BUILD_PARALLEL_LEVEL=")), true)
    assert.equal(ciLogs.some((line) => line.startsWith("export NINJAFLAGS=")), true)
    assert.equal(ciLogs.some((line) => line.startsWith("export GRADLE_OPTS=")), true)

    const errors: string[] = []
    let exitCode: number | undefined
    const missing = sdk.main(["node", "android-sdk.cjs", "print-env"], {
      env: {},
      existsSync: () => false,
      spawnSync: () => ({ status: 1, stdout: "", stderr: "" }),
      error: (msg: string) => errors.push(msg),
      exit: (n: number) => {
        exitCode = n
      },
    })
    assert.equal(missing, 1)
    assert.equal(exitCode, 1)
    assert.match(errors.join("\n"), /JDK not found/)
  })

  it("with-jdk spawns eas-cli with JAVA_HOME on PATH", () => {
    const appRoot = tmpDir()
    const sdkRoot = writeSdk(path.join(appRoot, "Sdk"))
    const javaHome = writeJdk(path.join(appRoot, "jdk"))
    let captured:
      | { cmd: string; args: string[]; opts: { env?: Record<string, string>; cwd?: string; stdio?: string } }
      | undefined
    const code = sdk.main(
      ["node", "android-sdk.cjs", "with-jdk", "--", "npx", "--yes", "eas-cli@22.2.0", "build"],
      {
        appRoot,
        env: { ANDROID_HOME: sdkRoot, JAVA_HOME: javaHome, PATH: "/usr/bin" },
        spawnSync: (cmd: string, args: string[], opts: { env?: Record<string, string>; cwd?: string; stdio?: string }) => {
          captured = { cmd, args, opts }
          return { status: 0, stdout: "", stderr: "" }
        },
      },
    )
    assert.equal(code, 0)
    assert.equal(captured?.cmd, "npx")
    assert.deepEqual(captured?.args, ["--yes", "eas-cli@22.2.0", "build"])
    assert.equal(captured?.opts.env?.JAVA_HOME, javaHome)
    assert.equal(captured?.opts.env?.ANDROID_HOME, sdkRoot)
    assert.equal(captured?.opts.env?.ORG_GRADLE_PROJECT_reactNativeArchitectures, undefined)

    let ciCaptured:
      | { opts: { env?: Record<string, string> } }
      | undefined
    const ciCode = sdk.main(["node", "android-sdk.cjs", "with-jdk", "npx", "eas-cli"], {
      appRoot,
      env: { ANDROID_HOME: sdkRoot, JAVA_HOME: javaHome, PATH: "/usr/bin", MORPHOS_ANDROID_CI_LIMITS: "1" },
      spawnSync: (_cmd: string, _args: string[], opts: { env?: Record<string, string> }) => {
        ciCaptured = { opts }
        return { status: 0, stdout: "", stderr: "" }
      },
    })
    assert.equal(ciCode, 0)
    assert.equal(ciCaptured?.opts.env?.ORG_GRADLE_PROJECT_reactNativeArchitectures, "arm64-v8a")
    assert.equal(ciCaptured?.opts.env?.CMAKE_BUILD_PARALLEL_LEVEL, "2")
    assert.equal(captured?.opts.stdio, "inherit")
    assert.equal(captured?.opts.cwd, appRoot)

    const errors: string[] = []
    let exitCode: number | undefined
    const usage = sdk.main(["node", "android-sdk.cjs", "with-jdk"], {
      error: (msg: string) => errors.push(msg),
      exit: (n: number) => {
        exitCode = n
      },
    })
    assert.equal(usage, 1)
    assert.equal(exitCode, 1)
    assert.match(errors.join("\n"), /with-jdk <command>/)

    errors.length = 0
    exitCode = undefined
    const noJdk = sdk.main(["node", "android-sdk.cjs", "with-jdk", "npx"], {
      env: {},
      existsSync: () => false,
      spawnSync: () => ({ status: 1, stdout: "", stderr: "" }),
      error: (msg: string) => errors.push(msg),
      exit: (n: number) => {
        exitCode = n
      },
    })
    assert.equal(noJdk, 1)
    assert.equal(exitCode, 1)
    assert.match(errors.join("\n"), /JDK not found/)

    exitCode = undefined
    const failed = sdk.main(["node", "android-sdk.cjs", "with-jdk", "npx", "eas-cli"], {
      env: { JAVA_HOME: javaHome },
      spawnSync: () => ({ status: 7, stdout: "", stderr: "" }),
      exit: (n: number) => {
        exitCode = n
      },
    })
    assert.equal(failed, 7)
    assert.equal(exitCode, 7)

    exitCode = undefined
    const signaled = sdk.main(["node", "android-sdk.cjs", "with-jdk", "npx"], {
      env: { JAVA_HOME: javaHome },
      spawnSync: () => ({ status: null, stdout: "", stderr: "" }),
      exit: (n: number) => {
        exitCode = n
      },
    })
    assert.equal(signaled, 1)
    assert.equal(exitCode, 1)
  })

  it("runs from the command line with MORPHOS_MOBILE_APP_ROOT", () => {
    const result = spawnSync(process.execPath, [scriptPath, "prepare"], {
      encoding: "utf8",
      env: { ...process.env, MORPHOS_MOBILE_APP_ROOT: tmpDir(), EAS_BUILD_PLATFORM: "" },
    })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Skipping Android SDK/)
  })
})
