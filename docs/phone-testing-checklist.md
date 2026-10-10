# Morphos Capture — phone testing checklist

Use after installing a **preview** APK / IPA on physical iOS and Android devices.

**Backend:** Portal API at `https://api.morphosanalytics.com` (set via `PORTAL_API_URL` in `write-build-config`).

**Test accounts:** one athlete with an **active** subscription (upload path) and one **signed-in without** a subscription (picker must stay closed).

## Preflight (developer machine)

```bash
npm run verify:phone-config
npm run smoke:portal-api
./scripts/build-preview.sh android
```

iOS archive needs a Mac (`ios/MorphosCapture.xcodeproj`). Public CI compiles an unsigned `xcodebuild` on `macos-latest`.

## Per device

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| 1 | Open **Morphos Capture** | ☐ | Home-screen icon is the Morphos **M** mark; cold start lands on **Home** |
| 2 | **Account** → Sign in with Microsoft | ☐ | In-app browser opens; returns via `morphoscapture://auth` |
| 2a | **Account** → Sign in with Google | ☐ | Native Google account sheet appears — **no** browser and **no** intermediate web page on iOS or Android |
| 2d | Force-quit and relaunch after Google sign-in | ☐ | Still signed in; Google restores the account silently |
| 2b | Signed in **without** subscription: Home shows empty state; subscribe opens website | ☐ | Tap Subscribe → Safari / Chrome to `portal.morphosanalytics.com/subscription` |
| 2c | **Videos** and **Alerts** still load without a subscription | ☐ | Read-only; no photo picker |
| 2e | Signed in **with** subscription: Home shows athlete/ward/team cards with upload actions | ☐ | Cards only for active subscriptions; happening-now events listed first |
| 3 | Tap a card upload action → **Capture** form opens with event pre-filled | ☐ | Event type / venue / link filled when available; **Back to Home** returns to cards |
| 4 | Capture shows max upload duration | ☐ | `GET /v1/portal/upload-limits` |
| 5 | Calendar event picker reflects the Home selection (or “not linked” for generic upload) | ☐ | `GET /v1/portal/video-upload/linkable-events` |
| 5a | Import a short video from the system photo library | ☐ | iCloud originals may download first; 720p H.264 clips skip re-encode |
| 5b | Import a 4K (or high-fps) **game** clip | ☐ | Device prepares H.264 1080p **30 fps** with progress + Cancel; same on iPhone and Android |
| 5c | Import a high-fps clip with **Skill clip mode** on | ☐ | Keeps source fps up to 60 while capping 1080p |
| 6 | Over-max clip is rejected with a friendly duration message | ☐ | No snake_case in the alert; transcode does not run |
| 7 | Link the clip to Saturday’s (or suggested) game, or leave unlinked | ☐ | Event type / venue fill from the event when linked |
| 8 | QC gate — if quality fails, friendly message + override | ☐ | |
| 9 | Complete upload (presign + ticket PUT + complete) | ☐ | Game-length files must not crash the app |
| 10 | **Videos** tab lists submission | ☐ | `GET /v1/portal/my-videos` |
| 11 | Tap submission → stat progress loads | ☐ | `/v1/portal/video-submissions/:id/stat-progress` |
| 12 | **Alerts** tab shows notifications (if any) | ☐ | |

## Common failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Sign-in fails after browser / `redirect_uri` is not valid | Missing Entra public-client redirect `morphoscapture://auth` | Register the redirect on the Capture public client in the Morphos Entra tenant. Close the Microsoft error page (X) to return to Capture. |
| Microsoft returns to **Sign in** after a successful account pick | OAuth bounce closed the browser as “dismiss” before the session was saved | Reload Metro (JS). Capture must finish `morphoscapture://auth?code=…` into a Morphos session. Close the browser if it is still open and retry. |
| Google sign-in fails with `DEVELOPER_ERROR` (Android) | The build's signing SHA-1 is not on the Android OAuth client | Run `./scripts/print-google-oauth-setup.sh`. Register **Play App Signing** SHA-1 on the Play-facing Android client. Do **not** put the committed debug keystore SHA on that client. |
| Google sign-in opens a browser | Stale build from the old OAuth flow | Rebuild; the native SDK shows an in-app account sheet on both OS. |
| Google sign-in returns `Invalid Google sign-in token` (iOS) | iOS Google client id not accepted by Portal API | Portal API must allow the iOS audience (`MOBILE_GOOGLE_IOS_CLIENT_ID`). |
| Unmatched Route on launch | Missing `/` route or stale APK | Rebuild preview APK; cold start should open **Home** |
| Network / API errors | localhost in build | Set `PORTAL_API_URL` and re-run `write-build-config` |
| Upload 401 | Wrong scope | `MSAL_PORTAL_API_SCOPE=api://{portal-api-app-id}/portal.read` |
| Upload 403 on PUT/complete | Missing upload ticket | Rebuild with current `@morphos/portal-api-client` |
| Upload 503 on complete | GCS staging not configured | Portal upload pipeline on API host |
| iOS link won't install | Simulator / unsigned CI build | Archive a device IPA on a Mac with distribution signing secrets |
| `verify:phone-config` fails | Empty MSAL client / loopback Portal URL | See `.env.example` |

## Install links

After `./scripts/build-preview.sh android`:

- **Android:** Install `android/app/build/outputs/apk/release/app-release.apk` (allow unknown sources).
- **iOS:** Archive on a Mac (`ios/MorphosCapture.xcworkspace`) for TestFlight or ad hoc.

See [README.md](../README.md) for build setup.
