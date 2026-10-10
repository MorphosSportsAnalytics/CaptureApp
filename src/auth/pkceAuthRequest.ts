import { sha256 } from "js-sha256"

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytes
}

export type PkceAuthRequest = {
  url: string
  state: string
  codeVerifier: string
  redirectUri: string
}

export function createPkceAuthRequest(input: {
  clientId: string
  redirectUri: string
  authorizationEndpoint: string
  scopes: string[]
  extraParams?: Record<string, string>
}): PkceAuthRequest {
  const codeVerifier = base64UrlEncode(randomBytes(32))
  const digest = sha256.array(codeVerifier)
  const codeChallenge = base64UrlEncode(new Uint8Array(digest))
  const state = base64UrlEncode(randomBytes(16))
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    scope: input.scopes.join(" "),
    ...input.extraParams,
  })
  return {
    url: `${input.authorizationEndpoint}?${params.toString()}`,
    state,
    codeVerifier,
    redirectUri: input.redirectUri,
  }
}

export function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
