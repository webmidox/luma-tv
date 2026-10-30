#!/bin/bash
# Maakt een GitHub-release met de APK, zodat de tv zichzelf kan bijwerken (Instellingen > Updates).
# Gebruik:  ./scripts/release.sh 0.29
set -e
cd "$(dirname "$0")/.."
V="$1"
if [ -z "$V" ]; then echo "Gebruik: ./scripts/release.sh 0.29"; exit 1; fi
if ! grep -q "versionName '$V'" app/build.gradle; then echo "versionName in app/build.gradle is niet '$V'"; exit 1; fi
./gradlew clean assembleDebug -q
APK=app/build/outputs/apk/debug/app-debug.apk
git add -A
git commit -m "Luma TV $V" || true
git push
git tag "v$V"
git push origin "v$V"
if command -v gh >/dev/null; then
  gh release create "v$V" "$APK" --title "Luma TV $V" --notes "Luma TV $V"
  echo "Release v$V staat online. Op de tv: Instellingen > Updates."
else
  echo "Installeer de GitHub CLI (brew install gh) of maak de release op github.com en voeg $APK toe."
fi
