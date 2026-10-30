#!/bin/bash
# Bewaart je debug-sleutel. Zonder deze sleutel kan een nieuwe build niet over de oude heen worden geïnstalleerd.
set -e
SRC="$HOME/.android/debug.keystore"
DST="$HOME/Documents/luma-sleutel-backup"
if [ ! -f "$SRC" ]; then
  echo "Geen sleutel gevonden op $SRC. Bouw de app eerst één keer met ./gradlew assembleDebug."
  exit 1
fi
mkdir -p "$DST"
cp "$SRC" "$DST/debug-$(date +%Y%m%d).keystore"
echo "Sleutel bewaard in $DST"
echo "Zet die map ook in iCloud of op een andere schijf."
