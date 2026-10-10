import {
  DEFAULT_GOOGLE_IOS_CLIENT_ID,
  DEFAULT_GOOGLE_WEB_CLIENT_ID,
  DEFAULT_PORTAL_API_URL,
  DEFAULT_PORTAL_WEB_URL,
  mergeBuildExtra,
  type BuildExtraEnv,
} from "./buildExtra"
import { generatedBuildConfig } from "./generated/buildConfig"

const extra = mergeBuildExtra(generatedBuildConfig, process.env as BuildExtraEnv)

export const portalApiUrl = extra.portalApiUrl ?? DEFAULT_PORTAL_API_URL
export const portalWebUrl = extra.portalWebUrl ?? DEFAULT_PORTAL_WEB_URL
export const msalClientId = extra.msalClientId ?? ""
export const msalTenant = extra.msalTenant ?? "common"
export const msalPortalApiScope = extra.msalPortalApiScope ?? ""
export const msalRedirectUri = "morphoscapture://auth"
export const googleWebClientId = extra.googleWebClientId ?? DEFAULT_GOOGLE_WEB_CLIENT_ID
export const googleIosClientId = extra.googleIosClientId ?? DEFAULT_GOOGLE_IOS_CLIENT_ID
