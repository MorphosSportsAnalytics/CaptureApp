/**
 * Remap deep-link / cold-start paths from the custom scheme to in-app routes.
 * Used by React Navigation linking when Android/iOS open morphoscapture://…
 * OAuth returns must keep their query string so the token exchange can finish.
 */
export function resolveSystemPath(path: string): string {
  const queryIndex = path.indexOf("?")
  const pathname = (queryIndex === -1 ? path : path.slice(0, queryIndex)).replace(/^\//, "").trim()
  const query = queryIndex === -1 ? "" : path.slice(queryIndex)

  if (pathname === "" || pathname === "/") {
    return "/home"
  }

  if (pathname === "auth" || pathname === "capture/auth") {
    return `/sign-in${query}`
  }

  return path.startsWith("/") ? path : `/${path}`
}
