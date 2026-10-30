# Luma TV

**Een eigen IPTV-app voor Android TV en Google TV: live tv, tv-gids, films, series en verder kijken in één rustige, glazen interface.**

Luma TV is een speler, geen aanbieder. Je voert zelf de gegevens van je eigen IPTV-abonnement in (M3U-link of Xtream Codes), en alleen op jouw apparaat verschijnt dan je bibliotheek. Er wordt geen content, afspeellijst of account meegeleverd.

> Status: eerste versie (0.1). Gebouwd voor de Chromecast met Google TV. Nog niet op alle apparaten getest.

---

## 0.38: Voor jou compact + streaming

- Hero compact: titel, regel, 2 regels beschrijving (met ...), OK = kijken.
- Rijen schuiven onder de vaste hero door; de rij waar je op staat staat steeds bovenaan.
- Streaming-rij: vierkante tegels voor groepen op de server met Netflix, Videoland, Prime, Disney+, Max, Peacock, Canal+ enz. Eigen logo: zet `img/streaming/<naam>.png` (bv. netflix.png) neer.
- Slideshow met zwarte verloop onder en boven.

## 0.37: Bovenbalk en foto's

- Bovenbalk effen zwart over de volle breedte (Ziggo-ontwerp), oranje selectie blijft.
- Slideshow Voor jou met 5 scherpere foto's (1920 breed).
- Het label LIVE bovenin de hero is weg; geen achtergrond-animatie meer bij het scrollen terwijl de slideshow draait; de Sport-tab verschijnt zonder het scherm opnieuw te tekenen.

## 0.36: Sport zonder vastlopen

- De sport-hub scant zenders nu op de achtergrond in kleine stukjes, zodat grote IPTV-lijsten het scherm niet meer vastzetten. De Sport-tab verschijnt als het klaar is.

## 0.35: Fotoslideshow bij Live TV

- Live TV krijgt een eigen set van 5 foto's (gedimd). Foto's toevoegen: `SLIDESETS.live` in `js/app.js`. Apart uit te zetten bij Instellingen, Uiterlijk.

## 0.34: Slideshow met 5 foto's

- Nieuwe Spider-Man-foto, The Walking Dead en een basketbalfoto erbij.

## 0.33: Fotoslideshow op Voor jou

- Achtergrondfoto's op Voor jou, elke 10 seconden een andere (vloeiende overgang). Andere schermen houden de rustige kleurwas.
- Foto's toevoegen: zet het bestand in `app/src/main/assets/www/img/slides/` en voeg het pad toe aan `SLIDES` in `js/app.js`.
- Uitzetten kan bij Instellingen, Uiterlijk.

## 0.32: Live-infobalk

- Druk je tijdens live tv op OK, dan zie je een balk onderin met het vorige programma, het huidige programma (zenderlogo, NU, begin- en eindtijd, oranje voortgangsbalk, oranje knop) en het volgende programma.
- Bovenin staan 'SPEELT NU - LIVE TV' en de klok.
- De actieknoppen staan onder de balk zodra je op OK drukt; na een zap zie je alleen de balk.
- De gids-gegevens van de app bevatten nu ook het vorige programma.

## 0.31: Sport-hub

- Nieuwe tab **Sport** (verschijnt zodra de gids sport bevat; uit te zetten met de instelling `nav_sport`).
- Sporttegels (voetbal, motorsport, tennis, wielrennen, darts, vechtsport, overig), Nu live-rij, aftrapkaarten ("Ajax - PSV"), programma per dag (Vandaag, Morgen, ...).
- Mijn teams en sporten: rij Jouw wedstrijden (ook op Voor jou), melding 10 minuten voor de aftrap en een banner met Naar zender.
- Gemist en opnames van sport, uitgelichte wedstrijd bovenaan, kleur per sport.
- Sport wordt herkend aan titel/genre in de gids en aan zenders die als sportzender zijn gemarkeerd.

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

## 0.18
- Speler: alle actieknoppen bereikbaar (tijdverschuiving, live, nacht, opname, slaap), duidelijke foutmeldingen, OK bij een fout springt naar de volgende zender, radio blijft spelen op de achtergrond.
- Afstandsbediening: zoektoets opent zoeken; rood/groen/geel/blauw = Live/Films/Series/Radio.

## 0.19
- Speler: nachtmodus in drie standen (uit/licht/sterk), kleur van ondertitels (Instellingen > Afspelen), actie "Aftiteling over", radioscherm met zendernaam, nu-spelend (ICY) en bewegende balkjes.
- Opnames: "Bewaren in galerij" kopieert naar Movies/Luma.
- Kinderprofielen: leeftijdsgrens voor films (6/9/12/16) via de TMDB-leeftijdsclassificatie.

## 0.20
- Home: rij "Volgende aflevering"; episodelijst met voortgangsbalkjes.
- Speler: aftelscherm naar de volgende aflevering (OK = nu, Terug = stoppen), taal en ondertitels per serie onthouden, volume per zender (actie "Volume"), laatste-zender-toets.
- Gids: sportknop (voetbal, F1, tennis, ...); herinnering heeft "Nu kijken".
- Beheer: Zenders & fouten (logboek, verbergen), opslagoverzicht met opruimen, nachtstand op schema, back-up bij elke update.
- Home lang indrukken: snelmenu.

## 0.21
- Home: rijen Samen kijken (gedeeld door alle profielen), Gezien deze week en Nieuw toegevoegd.
- Profielkeuze toont wat elk profiel laatst keek.
- Uiterlijk: klok in de hoek en rustige modus.

## 0.22
- Live TV: categorie lang indrukken = groep afspelen of groep testen op dode zenders.
- Zoeken: knop Stemming (grappig, spannend, romantisch, gezin, echt, fantasierijk).
- Seriekaart: "3 van 10 gezien". Favorieten sorteren op tijdstip. Nieuwsrij via RSS-link.
- Na het toevoegen van een bron: proefcontrole van zes zenders.
- Back-up per dag, de laatste vijf blijven bewaard.
- Speler: audio- en ondertiteltoets van de afstandsbediening.

## 0.23
- Live: kijkgedrag per uur sorteert "Nu op tv"; sportalarm op namen; zender die vastloopt wordt na 15 s automatisch opnieuw verbonden.
- Films: dubbele titels samenvoegen met keuze van versie.
- Opnames: eerder beginnen en later stoppen. Kijktijd per profiel. Wekelijkse samenvatting op Home (maandag en dinsdag).
- Speler: ondertitels later tonen (+0,5 tot +3 s).

## 0.24
- Live: pauzeren en daarna "Hervatten bij live" (verbindt opnieuw na 4 s), beeldformaat per zender onthouden, dubbele zenders (HD/SD) samenvoegen, favorieten in een eigen groep zetten (categorie Favorieten lang indrukken).
- Back-up terugzetten met keuze uit de laatste back-ups; ouderlijk log (wat een kinderprofiel gisteren keek).
- Nieuwe aflevering van een gevolgde serie: venster met knop Bekijken.

## 0.25
- Zoeken: programma's in de gids (met opnemen en herinneren), opnames als afspeellijst, zenderlijst exporteren (m3u).
- Speler: intro automatisch overslaan per serie; fix: serie-id wordt nu aan de speler meegegeven (taal en ondertitels per serie werken daardoor echt).

## 0.26
- Speler: volgende zender met programma rechtsonder tijdens zappen.
- Series: "Waar was ik gebleven?" (TMDB). Gids: ↻ bij herhalingen. Sportzenders markeren en filter ⚽ Sport.
- Instellingen: startscherm na 18:00, zachte kijkwaarschuwing. Home: "Omdat jullie dit samen keken".

## 0.27
- Home: Nu iets goeds op tv (TMDB-score), Aankomende films op tv, Film van de avond, bronstatus.
- Snelmenu (Home lang indrukken): Verras me met een zender, Laatste zenders.
- Gids: acteurs en regisseur bij een programma. Instellingen: tekstgrootte.
- Speler: twee keer snel OK = favoriet (live, zonder balk).

## 0.28
- Zelfcontrole bij het opstarten; "Wat is er nieuw" toont alle versies sinds je laatste update.
- `scripts/test-tv.sh`: test, bouwt, installeert, start en toont fouten uit het logboek in één keer.
- Extra tests (`tests/store.test.cjs`); alles draaien met `node --test tests/*.test.cjs`.

## 0.29
- Probleem melden: toont ook de laatste afspeelfouten en een QR-code naar het rapport op je telefoon.
- Updates: herinnering over de app-sleutel; `scripts/bewaar-sleutel.sh` en `scripts/release.sh <versie>`.

## 0.30
- Home: Live en straks (LIVE-label, voortgang, straks), ronde Groepen, Alles bekijken bij elke rij.
- Gids: Nu / Straks-weergave naast het tijdrooster. Films en Series: uitgelichte kaarten.
- Navigatie als oranje pil; profielscherm met grote focus.
