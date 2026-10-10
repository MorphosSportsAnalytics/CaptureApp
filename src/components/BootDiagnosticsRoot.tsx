import { useEffect, useSyncExternalStore } from "react"
import { useI18n } from "@/i18n/I18nProvider"
import { AppErrorBoundary } from "@/components/AppErrorBoundary"
import { CrashReportScreen } from "@/components/CrashReportScreen"
import {
  clearFatalError,
  getBootLogSnapshot,
  recordBootPhase,
  subscribeBootLog,
} from "@/diagnostics/bootLog"
import { hideNativeSplash } from "@/diagnostics/nativeSplash"

export function BootDiagnosticsRoot({ children }: { children: React.ReactNode }) {
  const { messages } = useI18n()
  const snapshot = useSyncExternalStore(subscribeBootLog, getBootLogSnapshot)

  useEffect(() => {
    recordBootPhase("rootLayout")
    void hideNativeSplash()
  }, [])

  const report = (error: unknown, onRetry: () => void) => (
    <CrashReportScreen
      error={error}
      phase={snapshot.phase}
      componentStack={snapshot.componentStack}
      messages={messages}
      onRetry={onRetry}
    />
  )

  if (snapshot.fatalError) {
    return report(snapshot.fatalError, clearFatalError)
  }

  return (
    <AppErrorBoundary fallback={(error, retry) => report(error, retry)}>
      {children}
    </AppErrorBoundary>
  )
}
