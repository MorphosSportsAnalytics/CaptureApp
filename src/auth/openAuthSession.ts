import InAppBrowser from "react-native-inappbrowser-reborn"

export type AuthSessionResult = {
  type: string
  url?: string
}

export async function openAuthSession(authorizeUrl: string, redirectUri: string): Promise<AuthSessionResult> {
  const available = await InAppBrowser.isAvailable()
  if (!available) {
    return { type: "error" }
  }
  const result = await InAppBrowser.openAuth(authorizeUrl, redirectUri, {
    ephemeralWebSession: true,
    showTitle: false,
    enableUrlBarHiding: true,
    enableDefaultShare: false,
    forceCloseOnRedirection: true,
  })
  if (result.type === "success") {
    return { type: "success", url: result.url }
  }
  if (result.type === "cancel") return { type: "cancel" }
  if (result.type === "dismiss") return { type: "dismiss" }
  return { type: result.type }
}
