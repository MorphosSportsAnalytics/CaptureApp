#!/usr/bin/env bash
# Print Google Cloud Console values for Morphos Capture Google sign-in.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYSTORE="$ROOT/android/app/debug.keystore"

ANDROID_PACKAGE="com.morphosanalytics.capture"
IOS_BUNDLE="com.morphosanalytics.capture"
WEB_CLIENT_ID="79042994996-ccbdj2h3gjsd0rtjci0bgt3tij1l2ha3.apps.googleusercontent.com"

echo "Morphos Capture — Google sign-in setup"
echo "======================================"
echo
echo "Capture uses the native Google Sign-In SDK, not a browser."
echo "No custom URI scheme is needed on Android — do NOT enable that setting."
echo
echo "Android OAuth client (identifies the app; not referenced in app config)"
echo "  Application type: Android"
echo "  Package name:     $ANDROID_PACKAGE"
echo
echo "  Google Cloud allows ONE SHA-1 per Android client, so create a separate"
echo "  Android client for each signing certificate you ship."
echo
echo "  Do NOT register the committed debug.keystore SHA-1 on the Play-facing"
echo "  Android OAuth client. That keystore is local debug only (password is in"
echo "  Gradle). Production Google Sign-In must use Play App Signing SHA-1."
echo

APK="$(ls -t "$ROOT"/android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1 || true)"
if [[ -n "$APK" ]]; then
  APKSIGNER="$(ls -1 "${ANDROID_HOME:-$HOME/Android/Sdk}"/build-tools/*/apksigner 2>/dev/null | tail -1 || true)"
  echo "  SHA-1 of the most recent local release APK ($(basename "$APK")) — the fingerprint"
  echo "  the installed app actually presents to Google:"
  if [[ -n "$APKSIGNER" ]]; then
    "$APKSIGNER" verify --print-certs "$APK" 2>/dev/null \
      | awk -F': ' '/SHA-1 digest/ {gsub(/../, "&:", $2); sub(/:$/, "", $2); print "    " toupper($2)}'
  else
    echo "    apksigner not found under ${ANDROID_HOME:-$HOME/Android/Sdk}/build-tools/"
  fi
  echo
fi

if [[ -f "$KEYSTORE" ]]; then
  echo "  SHA-1 (debug.keystore — debug 'npm run android' builds):"
  keytool -list -v -keystore "$KEYSTORE" -alias androiddebugkey -storepass android -keypass android 2>/dev/null \
    | awk -F': ' '/SHA1:/ {print "    " $2}'
  echo
fi

echo "  SHA-1 for Play App Signing: Play Console → App integrity → App signing key."
echo
echo "  A SHA-1 mismatch is what causes Android DEVELOPER_ERROR: Google shows the"
echo "  account sheet, then refuses to issue a token."
echo
echo "Web OAuth client (ID token audience for Android sign-in)"
echo "  Already configured: $WEB_CLIENT_ID"
echo
echo "iOS OAuth client"
echo "  Application type: iOS"
echo "  Bundle ID:        $IOS_BUNDLE"
echo "  iOS uses the reverse-DNS URL scheme baked into Info.plist."
echo
echo "After creating the iOS client, set GOOGLE_IOS_CLIENT_ID and re-run"
echo "write-build-config."
echo
echo "Portal API prod environment (ID token audience verification):"
echo "  MOBILE_GOOGLE_IOS_CLIENT_ID=<same ios client id>"
echo "  Android needs no extra Portal API setting — its tokens use the web client id."
