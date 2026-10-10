import type { CaptureRouteParams } from "./captureParams"
import { serializeCaptureParams } from "./captureParams"
import { setCaptureIntent } from "./captureIntent"

type CaptureRouter = {
  navigate: (
    name: "Main",
    params: { screen: "Capture"; params: Record<string, string> },
  ) => void
}

/** Store the picked event, then open Capture. Tab search params alone are not reliable. */
export function openCapture(router: CaptureRouter, params: CaptureRouteParams): void {
  setCaptureIntent(params)
  router.navigate("Main", {
    screen: "Capture",
    params: serializeCaptureParams(params),
  })
}
