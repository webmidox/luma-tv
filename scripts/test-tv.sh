#!/bin/bash
# Bouwt, installeert en start Luma TV op de Chromecast en toont daarna alleen de fouten uit het logboek.
# Gebruik:  ./scripts/test-tv.sh            (standaard 192.168.178.30)
#           ./scripts/test-tv.sh 192.168.1.5
#           ./scripts/test-tv.sh 192.168.178.30:41234   (adres en poort van Draadloos foutopsporen)
set -e
cd "$(dirname "$0")/.."
ARG="${1:-192.168.178.30}"
case "$ARG" in *:*) TV="$ARG" ;; *) TV="$ARG:5555" ;; esac

echo "1/5 Tests (JavaScript)"
node --check app/src/main/assets/www/js/app.js
node --test tests/*.test.cjs 2>&1 | grep -E "^# (pass|fail)" || true

echo "2/5 Bouwen"
./gradlew clean assembleDebug -q

echo "3/5 Verbinden met $TV"
adb connect "$TV" >/dev/null
adb -s "$TV" logcat -c

echo "4/5 Installeren en starten"
adb -s "$TV" install -r app/build/outputs/apk/debug/app-debug.apk
adb -s "$TV" shell am start -n com.luma.tv/.MainActivity

echo "5/5 Fouten uit het logboek (20 seconden, Ctrl+C om te stoppen)"
timeout 20 adb -s "$TV" logcat -v time '*:E' 'chromium:W' 'LumaTV:*' 2>/dev/null | grep -iE "luma|chromium|AndroidRuntime|FATAL" || true
echo "Klaar. Geen regels hierboven = geen fouten gezien."
