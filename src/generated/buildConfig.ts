import type { BuildExtra } from "../buildExtra"

/** Public runtime defaults bundled into the app. Overwritten by scripts/write-build-config.cjs. */
export const generatedBuildConfig: BuildExtra = {
  "portalApiUrl": "https://api.morphosanalytics.com",
  "portalWebUrl": "https://portal.morphosanalytics.com",
  "msalClientId": "a6023341-d99d-48b1-83a3-c657cf791981",
  "msalTenant": "common",
  "msalPortalApiScope": "api://b8d3dc3c-5589-460e-af7e-30a2e6b46bbb/portal.read",
  "googleWebClientId": "79042994996-ccbdj2h3gjsd0rtjci0bgt3tij1l2ha3.apps.googleusercontent.com",
  "googleIosClientId": "79042994996-m23rnjus94uo1uvqn8pd1dft7iaqenml.apps.googleusercontent.com"
}
