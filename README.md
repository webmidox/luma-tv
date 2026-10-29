# Luma TV

IPTV-app voor Android TV / Google TV. Je voert zelf je M3U-link of Xtream-gegevens in; er wordt geen content meegeleverd.

- Live TV, gids (XMLTV), films, series en verder kijken
- Gekoppeld aan de launcher: tijdens het kijken toont Home "programma op zender" (via game_day = com.luma.tv)
- Bouwen: `./gradlew assembleDebug` -> app/build/outputs/apk/debug/app-debug.apk
- Installeren: `adb connect IP:PORT && adb install -r app-debug.apk`
- Tests van de logica: `node --test tests/core.test.cjs`

Niet getest op een echt toestel: eerste build kan kleine aanpassingen vragen.

## Updates uitrollen via GitHub
1. Maak een publieke repo, bijvoorbeeld `jouwnaam/luma-tv`, en push dit project (zie hieronder).
2. Verhoog `versionCode` en `versionName` in `app/build.gradle`, bouw met `./gradlew assembleDebug`.
3. Maak op GitHub een release met tag `v0.2` (zelfde nummer als versionName) en voeg `app-debug.apk` toe.
4. In Luma TV: Instellingen -> Updates -> vul `jouwnaam/luma-tv` in -> Controleer op update.
Bouw altijd op dezelfde Mac (zelfde debug-sleutel), anders weigert Android de update.

### Twee repo's
- `luma-tv`: deze app. Release-tag `v0.2` met `app-debug.apk`.
- `tvos-glass-launcher`: de launcher. Release-tag `v3.3` met een `.apk` (bijvoorbeeld `launcher.apk`).
Zet beide namen in `app/src/main/assets/www/js/config.js` voordat je bouwt.
