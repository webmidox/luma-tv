# Luma TV

**Een eigen IPTV-app voor Android TV en Google TV: live tv, tv-gids, films, series en verder kijken in één rustige, glazen interface.**

Luma TV is een speler, geen aanbieder. Je voert zelf de gegevens van je eigen IPTV-abonnement in (M3U-link of Xtream Codes), en alleen op jouw apparaat verschijnt dan je bibliotheek. Er wordt geen content, afspeellijst of account meegeleverd.

> Status: eerste versie (0.1). Gebouwd voor de Chromecast met Google TV. Nog niet op alle apparaten getest.

---

## Wat kan het

| Onderdeel | Omschrijving |
|---|---|
| **Instellingen** | Bron toevoegen als M3U-link of Xtream-gegevens; optioneel een eigen gids-link (XMLTV) en user-agent. Meerdere bronnen, verversen, verwijderen, cache wissen. |
| **Live TV** | Zenders per categorie, met logo en wat er nu op staat. Zappen in de speler met omhoog/omlaag of kanaal +/-. |
| **Gids (EPG)** | Programma's van de komende uren per zender, gekoppeld via het gids-id van je lijst of anders via de zendernaam. |
| **Films** | Posterraster per categorie, hervatten waar je gebleven was. |
| **Series** | Per serie seizoenen en afleveringen; bij Xtream worden afleveringen pas geladen als je een serie opent. |
| **Verder kijken** | Gestarte films en afleveringen met voortgangsbalk op Home. |
| **Recente zenders** | Snel terug naar wat je laatst keek. |
| **Koppeling met de launcher** | Terwijl je kijkt, toont de [tvOS Glass Launcher](https://github.com/webmidox/tvos-glass-launcher) op Home bijvoorbeeld "RTL Nieuws op RTL 4". |
| **Updates** | Een knop in Instellingen haalt nieuwe versies van de app én de launcher op via GitHub-releases. |

## Bediening (afstandsbediening)

- **Pijltjes**: door het scherm bewegen.
- **OK**: kiezen / afspelen.
- **Terug**: een stap terug; op Home sluit het de app.
- **In de speler**: omhoog/omlaag = vorige/volgende zender (live), links = 10 s terug, rechts = 30 s vooruit (films), OK = pauze.

## Hoe werkt het

- De interface is een webpagina (HTML, CSS, JavaScript zonder frameworks) in een WebView, uit de app zelf geladen.
- Afspeellijsten, gidsen en afbeeldingen gaan via een ingebouwde proxy met schijfcache. Zo spelen CORS en mixed-content geen rol en zijn grote lijsten snel.
- Video speelt in een eigen scherm met ExoPlayer (Media3), inclusief HLS en MPEG-TS, met automatische herstelpogingen bij live-uitval.
- Wat er nu speelt gaat via een alleen-lezen content provider naar de launcher.
- Al je instellingen en je voortgang blijven op het apparaat.

## Installeren

Je hebt een Mac (of ander systeem met Java 17 en de Android SDK) en een Chromecast met Google TV nodig.

1. **Chromecast**: Instellingen → Systeem → Info → zeven keer op "Android TV OS-build" tikken. Zet daarna "Draadloos foutopsporen" aan onder Ontwikkelaarsopties en koppel met een koppelcode.
2. **Mac**:
   ```
   brew install openjdk@17 android-commandlinetools android-platform-tools git
   export JAVA_HOME="$(brew --prefix openjdk@17)"
   export ANDROID_HOME="$(brew --prefix)/share/android-commandlinetools"
   yes | sdkmanager --licenses
   sdkmanager "platforms;android-34" "build-tools;34.0.0"
   ```
   Geef Terminal toegang onder Systeeminstellingen → Privacy en beveiliging → Lokaal netwerk.
3. **Verbinden**: `adb pair IP:KOPPELPOORT` en daarna `adb connect IP:POORT`.
4. **Bouwen en installeren**:
   ```
   ./gradlew assembleDebug
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
5. Open Luma TV → Instellingen → vul je gegevens in.

## Configuratie van updates

In `app/src/main/assets/www/js/config.js` staan de twee GitHub-repo's waar updates vandaan komen:

```js
window.LUMA_CONFIG = {
  appRepo: 'webmidox/luma-tv',
  launcherRepo: 'webmidox/tvos-glass-launcher'
};
```

## Een update uitrollen

1. Verhoog `versionCode` en `versionName` in `app/build.gradle`.
2. Bouw met `./gradlew assembleDebug`, commit en push.
3. Maak op GitHub een release met tag `v0.2` (gelijk aan `versionName`) en voeg `app-debug.apk` toe.
4. Op de Chromecast: Instellingen → Updates → "Controleer op update (Luma TV)".

Voor de launcher gaat het hetzelfde in de repo `tvos-glass-launcher`, met de knop "Controleer op update (launcher)". De eerste keer vraagt Android toestemming om apps uit Luma TV te installeren.

**Belangrijk:** bouw altijd op dezelfde computer. Elke computer maakt een eigen debug-sleutel aan, en Android weigert een update met een andere sleutel (je moet dan eerst deïnstalleren, en verliest je gegevens).

## Projectstructuur

```
app/src/main/java/com/luma/tv/     Java: MainActivity, PlayerActivity, FetchProxy, NowProvider, LumaBridge, Updater
app/src/main/assets/www/           De interface: index.html, style.css, js/*
app/src/main/res/                  Thema, banner, pictogram, module-kaart, bestandspaden
tests/core.test.cjs                Tests voor de logica (Node)
```

## Tests

De logica (M3U, XMLTV, gids, Xtream, opslag, updates) heeft tests:

```
node --test tests/core.test.cjs
```

De Android-kant en het afspelen zijn niet automatisch getest; die vragen een echt toestel.

## Beperkingen

- Op een Chromecast kan het opstartscherm (de Google-animatie) niet vervangen worden; Luma is een app plus launcher, geen eigen besturingssysteem.
- Tijdens het zappen in de speler blijft de launcher de zender tonen waarmee je begon.
- Het zijmenu en het "Mijn Home"-paneel zitten (nog) niet in de launcher.
- Gidsgegevens worden alleen getoond voor zenders die aan de gids gekoppeld kunnen worden.

## Juridisch

Luma TV levert of verspreidt geen tv-zenders, films of series en bevat geen afspeellijsten. Het speelt alleen af wat jij zelf met je eigen toegangsgegevens binnenhaalt. Zorg dat je gebruik past bij de voorwaarden van je aanbieder en de wetten in je land.

## Licentie

MIT, zie [LICENSE](LICENSE).
