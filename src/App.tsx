import { SafeAreaProvider } from "react-native-safe-area-context"
import { AuthProvider } from "@/auth/AuthProvider"
import { BootDiagnosticsRoot } from "@/components/BootDiagnosticsRoot"
import { I18nProvider } from "@/i18n/I18nProvider"
import { RootNavigator } from "@/navigation/RootNavigator"

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <BootDiagnosticsRoot>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </BootDiagnosticsRoot>
      </I18nProvider>
    </SafeAreaProvider>
  )
}
