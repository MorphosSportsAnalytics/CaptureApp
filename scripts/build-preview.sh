#!/usr/bin/env bash
# Build a preview APK on this machine (arm64-v8a). iOS waits for a Mac + xcodebuild.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PLATFORM="${1:-android}"

npm run write-build-config
npm run verify:phone-config

case "$PLATFORM" in
  android|all)
    npm run android:assemble:release
    echo
    echo "Android APK: android/app/build/outputs/apk/release/"
    ;;
  ios)
    echo "iOS preview: open ios/MorphosCapture.xcworkspace on a Mac and archive, or run xcodebuild."
    echo "This Linux runner cannot compile iOS."
    exit 1
    ;;
  *)
    echo "Usage: $0 [android]"
    exit 1
    ;;
esac

echo "See docs/phone-testing-checklist.md for device verification."
