import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const root = new URL("../../", import.meta.url)

describe("startup diagnostics entry", () => {
  it("installs JS error handlers before the React Native app registers", () => {
    const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8")) as {
      main: string
      dependencies: Record<string, string>
    }
    assert.equal(pkg.main, "index.js")
    assert.ok(pkg.dependencies["react-native-bootsplash"])
    const entry = readFileSync(new URL("index.js", root), "utf8")
    const handlerIdx = entry.indexOf("./src/diagnostics/autoInstallJsErrorHandlers")
    const registryIdx = entry.indexOf("AppRegistry.registerComponent")
    assert.ok(handlerIdx >= 0, "missing auto-install import")
    assert.ok(registryIdx > handlerIdx, "AppRegistry must load after the crash handler")
    const autoInstall = readFileSync(new URL("src/diagnostics/autoInstallJsErrorHandlers.ts", root), "utf8")
    assert.match(autoInstall, /installJsErrorHandlers\(\)/)
  })

  it("keeps the same diagnostic UI source for iOS and Android", () => {
    const files = [
      "src/components/CrashReportScreen.tsx",
      "src/components/AppBootScreen.tsx",
      "src/components/BootDiagnosticsRoot.tsx",
      "src/components/AppErrorBoundary.tsx",
      "src/App.tsx",
    ]
    for (const rel of files) {
      const src = readFileSync(new URL(rel, root), "utf8")
      assert.doesNotMatch(src, /Platform\.OS/)
      assert.doesNotMatch(src, /Platform\.select/)
      assert.doesNotMatch(src, /\.ios\.|\.android\./)
    }
  })
})
