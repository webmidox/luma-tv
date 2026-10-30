# Luma TV

**Een eigen IPTV-app voor Android TV en Google TV: live tv, tv-gids, films, series en verder kijken in één rustige, glazen interface.**

Luma TV is een speler, geen aanbieder. Je voert zelf de gegevens van je eigen IPTV-abonnement in (M3U-link of Xtream Codes), en alleen op jouw apparaat verschijnt dan je bibliotheek. Er wordt geen content, afspeellijst of account meegeleverd.

> Status: eerste versie (0.1). Gebouwd voor de Chromecast met Google TV. Nog niet op alle apparaten getest.

---

## Wat kan het

| Onderdeel | Omschrijving |
|---|---|
| **Bovenbalk** | Zoeken, Voor jou, Live TV, Gids, Films, Series en Instellingen in een bovenbalk, met groot beeld erachter dat meebeweegt met wat je selecteert. |
| **Profielen** | Meerdere profielen met eigen favorieten, voortgang, herinneringen, verborgen categorieën en uiterlijk. Kinderprofiel met pincode. Keuzescherm "Wie kijkt er?" bij het opstarten. |
| **Uiterlijk** | Thema donker, zwart (OLED), licht of automatisch (op tijd); 8 accentkleuren of een eigen hex-kleur; tekstgrootte; animaties en achtergrondbeeld uit voor oudere tv's. Per profiel. |
| **Instellingen** | Bronnen (M3U of Xtream, ook invullen met je telefoon via een QR-code), live tv en gids, afspelen, ouderlijk toezicht, updates en onderhoud. |
| **Live TV** | Zenders per categorie met logo, zendernummer, wat er nu op staat en een voortgangsbalk. Favorieten: houd OK ingedrukt op een zender. |
| **Gids (EPG)** | Tijdlijn zoals bij een digitale tv-aanbieder: zenders onder elkaar, programma's op tijd, een lijn voor "nu", uitleg onderaan. OK op een programma dat nog komt zet een herinnering; OK op wat nu loopt opent de zender. Instelbaar op 3, 6 of 12 uur. |
| **Live-speler** | Tijdens live tv toont OK de zenderbalk: wat er nu en straks is met voortgang, laatst bekeken zenders, zendernummer en knoppen voor zenderlijst, favoriet, vorige zender en info. Omhoog/omlaag zapt, cijfers kiezen een zender. |
| **Films en series** | Posterraster per categorie, seizoenen en afleveringen, hervatten waar je gebleven was. |
| **Verder kijken en favorieten** | Gestarte films en afleveringen en je favoriete zenders op Voor jou. |
| **Herinneringen** | Een melding vlak voordat een programma begint terwijl de app open staat. |
| **Ouderlijk toezicht** | Pincode, vergrendelde woorden in categorienamen (standaard xxx, adult, 18+, erotic, porn) en een kinderprofiel dat die nooit ziet. |
| **Koppeling met de launcher** | Terwijl je kijkt, toont de [tvOS Glass Launcher](https://github.com/webmidox/tvos-glass-launcher) op Home bijvoorbeeld "RTL Nieuws op RTL 4". |
| **Updates** | Een knop in Instellingen haalt nieuwe versies van de app én de launcher op via GitHub-releases. |

## Bediening (afstandsbediening)

- **Pijltjes**: door het scherm bewegen. In de gids blijven omhoog en omlaag op hetzelfde tijdstip.
- **OK**: kiezen / afspelen. **OK ingedrukt houden** op een zender: favoriet aan of uit.
- **Terug**: een stap terug; op Voor jou sluit het de app.
- **In de speler (live)**: omhoog/omlaag of kanaal +/- = zappen, cijfers = zendernummer, OK = zenderbalk (links/rechts kiezen, OK bevestigt), Menu of Gids = zenderlijst, Terug sluit eerst de balk.
- **In de speler (films)**: links en rechts spoelen (in Instellingen te kiezen), OK = pauze.

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
app/src/main/assets/www/           De interface: index.html, style.css, js/* (app, store met profielen, theme, epg, m3u, xtream, update)
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


## Nieuw in 0.4

- Startintro met laadstatus (bron, gids); uit te zetten onder Uiterlijk.
- Echte beelden: programma-afbeeldingen uit de gids op live-kaarten (zenderlogo als badge), optioneel TMDB-posters en achtergronden (eigen API-sleutel onder Beelden & info).
- Zendermenu (OK ingedrukt houden): favoriet, zapplijst, eigen nummer en naam, verbergen. Titelmenu: Mijn lijst, gezien, uit Verder kijken.
- Gids: genrekleuren, genrefilter, zoeken, Morgen/Overmorgen/Vanavond, compacte rijen, tijdcorrectie, aftelling en afbeelding in het infovak.
- Speler: beeldverhouding (passend/vullen/rekken), audio- en ondertitelspoor met taalvoorkeur, slaaptimer, snelheid, intro overslaan, volgende aflevering automatisch, technische info, maximale kwaliteit. Bij films: pijl omlaag opent de actiebalk.
- Voor jou instelbaar, Mijn lijst, "Omdat je X keek", Radio-tab, zoekgeschiedenis, kijkgeschiedenis en statistieken, kijktijdlimiet en bedtijd voor kinderprofielen, extra thema's, hoog contrast, kaartgrootte, wat-is-nieuw en stille updatecontrole.

## Gids, zoeken, films en meer (0.17)
- Gids: posters en ★ bij programma's, tot 2 dagen vooruit, meerdere gidsbronnen (spatie ertussen), gids ververs-interval en elke nacht verversen, gidszender handmatig koppelen, zenderlogo's uit de gids als de lijst ze mist, terugkijken (catch-up) bij Xtream-aanbieders die dat bieden.
- Herinneringen: geluidje en optioneel automatisch de zender openen; opnames voor elke uitzending van een programma; vrije ruimte in Opnames.
- Live TV: cijfers en letters (T9) om een zender te zoeken, tegels in plaats van een lijst, wekker.
- Zoeken: toetsenbord op het scherm, typfouten toegestaan, zoeken op naam én categorie, acteurs (met TMDB).
- Films en series: filter op jaar en taal, verzamelingen, sorteren op beoordeling (met TMDB), trailer en acteurs, serie volgen met melding bij nieuwe aflevering, afleveringsbeschrijving, alles afspelen.
- Radio: podcasts via je eigen RSS-links.
- Voor jou: rijvolgorde, eigen rijen ("Als rij op Voor jou"), "Wat het gezin kijkt".
- Uiterlijk: eigen achtergrondafbeelding, achtergrondstijl, doorzichtigheid bovenbalk, seizoensthema, kleurenblind-vriendelijke accenten, profielpatroon, lang drukken op de profielknop wisselt van profiel.
- Bronnen: bron tijdelijk uitzetten, lokale .m3u-lijsten, back-up maken en terugzetten, jaaroverzicht.

## Timeshift en meer (0.16)
- Live pauzeren en terugkijken: pauzeren in live tv bewaart de zender vanaf dat moment (tot 90 min), met ⏪ 30 s, 30 s ⏩ en ● Live in de actiebalk. Wil je ook terugspoelen zonder te pauzeren, zet dan "Terugkijken bij live tv" aan bij Afspelen (gebruikt een tweede verbinding).
- Zenders in een eigen map zetten, eigen logo per zender.
- Bron per profiel, kinderen zien alleen favorieten, ondertitelgrootte, lettertype, klikgeluidjes, welkomstregel in de intro, opnames automatisch wissen, verversinterval en laadtijd van je bron.

## Opnemen, controleren en samenvoegen (0.15)
- Opnemen: knop in de speler (pijl omlaag), of houd OK ingedrukt op een programma in de gids om een opname te plannen (de app moet dan aanstaan). Opnames staan onder Instellingen → Opnames, met afspelen en verwijderen. Opslag: de eigen map van de app.
- Herhalende herinnering: "Elke week herinneren" in dat gidsmenu.
- Zenders controleren (Live TV & gids): zoekt zenders die niet reageren en kan ze verbergen.
- Zenders verplaatsen met de pijltjes (zendermenu → Verplaatsen).
- Meerdere bronnen samenvoegen (Bronnen).

## Speler en zenders (0.14)
- Speler: nachtmodus (zachtere pieken), herhalen, stoppen na deze aflevering, verbindingssnelheid en buffer in het infoscherm, melding bij 20 s geen beeld.
- Reservezender: start een zender niet, dan probeert de app automatisch een andere versie (HD/FHD/4K) van dezelfde zender.
- Zenders sorteren op je eigen nummers.

## Extra's uit de ideeënlijst (0.13)
- Dubbele zenders en films samenvoegen (HD/FHD/4K, houdt de beste), onder Live TV & gids.
- 4K/HDR-label en "nog X min" op filmkaarten, "Meer zoals dit" in het titelmenu.
- Zoeken met filter "Alleen wat ik nog niet zag".
- Profielen: kopiëren, favorieten delen, gastprofiel dat zichzelf wist.
- Updatemelding bovenaan Voor jou.

## Menu links, plaatjes rechts (0.12)
Films, series en radio gebruiken dezelfde indeling als Live TV. De achtergrond is nu altijd een rustige kleurwas in plaats van een uitvergrote cover.

## Live TV in drie kolommen (0.11)
Links de IPTV-categorieën, in het midden de zenders (met logo en voortgang), rechts wat er nu op is met de gids eronder.

## Opknapbeurt 0.10

Zachte poster- en achtergrondbeelden met een geblurde kleurlaag eromheen (niets lijkt meer afgekapt), betere animaties (titels schuiven in, kaarten komen omhoog, tab-streep tekent zich, pop-ups), een bovenbalk waar rijen netjes onderdoor schuiven en een live-stip bij "NU LIVE".
