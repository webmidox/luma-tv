(function () {
  'use strict';
  const U = window.LumaUtil;
  const h = U.h;
  const M3U = window.LumaM3u;
  const XT = window.LumaXtream;
  const XMLTV = window.LumaXmltv;
  const Epg = window.LumaEpg.Epg;
  const UPD = window.LumaUpdate;
  const TH = window.LumaTheme;
  const META = window.LumaMeta;
  const CFG = window.LUMA_CONFIG || {};

  let storage = null;
  try { storage = window.localStorage; } catch (e) { storage = null; }
  if (!storage) {
    const mem = {};
    storage = { getItem: function (k) { return mem[k] || null; }, setItem: function (k, v) { mem[k] = v; } };
  }
  let storeCorrupt = false;
  try { const rawStore = storage.getItem('luma.v1'); if (rawStore) JSON.parse(rawStore); } catch (e) { storeCorrupt = true; }
  const store = window.LumaStore.createStore(storage);
  const native = window.LumaNative || null;

  /** A repo typed in Settings wins; otherwise the one built into js/config.js (unless it is still the placeholder). */
  function updateRepo(kind) {
    const own = store.pref(kind === 'launcher' ? 'repoLauncher' : 'repo');
    if (own) return own;
    const v = (kind === 'launcher' ? CFG.launcherRepo : CFG.appRepo) || '';
    return /JOUWNAAM/i.test(v) ? '' : v;
  }

  const PAGE = 48;
  const PCOL = ['#ff8a1f', '#4d8dff', '#2fd08a', '#ff4f9a', '#9b7bff', '#ff4d4d', '#27d3d3', '#e0b43a'];
  const NAV = [['home', 'Voor jou'], ['live', 'Live TV'], ['radio', 'Radio'], ['guide', 'Gids'], ['sport', 'Sport'], ['vod', 'Films'], ['series', 'Series']];
  const ICONS = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
  };
  const GPX = 0.9; // rem per minute in the guide
  const RELEASES = [
    ['0.42', ['Nieuw laadscherm met foto en zwart verloop: wacht tot zenders, gids en sport klaar zijn', 'Daarna pas de profielkeuze, en Voor jou is meteen compleet']],
    ['0.41', ['Momentopname van wat er nu op tv is in de live-kaarten, ipv het logo (een voor een op de achtergrond, 10 minuten bewaard)']],
    ['0.40', ['Live beeld in de geselecteerde live-kaart (gedempt, na 1,5 seconde)', 'Uit te zetten bij Instellingen > Uiterlijk > Live beeld in kaarten']],
    ['0.39', ['Rijen lopen nu door tot de rand van het scherm, op dezelfde plek', 'Omhoog en omlaag springt niet meer een rij over (o.a. Sport live)', 'Streaming-rij voorlopig weg']],
    ['0.38', ['Voor jou compact: titel, regel eronder, twee regels beschrijving en OK = kijken', 'De rijen schuiven onder de vaste bovenkant door', 'Streaming-rij met vierkante tegels (Netflix, Videoland, Prime enz.) uit de groepen op je server', 'Zwartere slideshow onderaan en bovenaan']],
    ['0.37', ['Bovenbalk weer effen zwart over de hele breedte, met de oranje selectie', 'Nieuwe, scherpere foto\'s in de slideshow op Voor jou', 'Het label LIVE bovenin de hero is weg; minder gespring bij het scrollen']],
    ['0.36', ['Sport op de achtergrond opgebouwd in kleine stukjes: geen vastlopen meer bij grote IPTV-lijsten']],
    ['0.35', ['Live TV: eigen fotoslideshow op de achtergrond (gedimd voor leesbaarheid), apart uit te zetten bij Uiterlijk']],
    ['0.34', ['Voor jou: slideshow met 5 foto\'s (nieuwe Spider-Man, The Walking Dead en basketbal erbij)']],
    ['0.33', ['Voor jou: fotoslideshow op de achtergrond, elke 10 seconden een andere foto (uit te zetten bij Instellingen, Uiterlijk)']],
    ['0.32', ['Live tv: nieuwe infobalk in Ziggo-stijl met logo, NU-label met tijden, oranje voortgangsbalk, vorig en volgend programma', 'Bovenin "Speelt nu - Live TV" en de klok; de acties staan onder de balk na OK']],
    ['0.31', ['Sport-hub: nieuwe Sport-tab met sporttegels, Nu live, aftrapkaarten en een programma per dag', 'Mijn teams en sporten: rij Jouw wedstrijden, melding 10 minuten voor de aftrap en een banner op Voor jou', 'Gemist en opnames van sport, uitgelichte wedstrijd en een eigen kleur per sport']],
    ['0.30', ['Home: Live en straks met LIVE-label, ronde groepen en Alles bekijken bij elke rij', 'Gids: Nu / Straks-weergave naast het tijdrooster', 'Films en Series: uitgelichte kaarten bovenaan', 'Oranje pil in de navigatie en een profielscherm met grote focus']],
    ['0.29', ['Foutrapport met QR-code: open het rapport op je telefoon en kopieer het', 'Herinnering om je app-sleutel te bewaren, release-script voor updates zonder Mac']],
    ['0.28', ['Zelfcontrole bij het opstarten (beschadigde gegevens of ontbrekende onderdelen)', 'Wat is er nieuw toont alle versies sinds je laatste update', 'Testscript en meer automatische tests voor de ontwikkelaar']],
    ['0.27', ['Nu iets goeds op tv, aankomende films op tv en film van de avond', 'Verras me met een zender en laatste zenders (Home lang indrukken)', 'Tekstgrootte, bronstatus op Home, acteurs bij een programma, twee keer OK = favoriet']],
    ['0.26', ['Volgende zender rechtsonder tijdens zappen', 'Waar was ik gebleven bij series, herhalingen in de gids, sportzenders', 'Startscherm na 18:00, zachte kijkwaarschuwing, samen gekeken titels']],
    ['0.25', ['Programma\'s zoeken in de gids', 'Opnames achter elkaar afspelen, zenderlijst exporteren', 'Intro automatisch overslaan per serie']],
    ['0.24', ['Pauzeren bij live tv met Hervatten bij live, beeldformaat per zender', 'Dubbele zenders samenvoegen, back-up kiezen, ouderlijk log']],
    ['0.23', ['Kijkgedrag per uur, sportalarm, zender die vastloopt herstelt zichzelf', 'Dubbele titels samenvoegen, opnemen met marge, kijktijd per profiel', 'Ondertitels later tonen']],
    ['0.22', ['Groep afspelen en testen, stemming-zoeken, nieuwsrij', 'Proefcontrole bij een nieuwe bron, back-up per dag']],
    ['0.21', ['Samen kijken, Gezien deze week, Nieuw toegevoegd', 'Rustige modus']],
    ['0.20', ['Volgende aflevering, aftelscherm, taal per serie, volume per zender', 'Zenders en fouten, opslagoverzicht, nachtstand, snelmenu']],
    ['0.19', ['Nachtmodus in standen, ondertitelkleur, radioscherm', 'Opnames bewaren in de galerij, leeftijdsgrens voor kinderen']],
    ['0.17', ['Nieuwe startintro, echte beelden via TMDB, zendermenu, gids met genres', 'Speler: snelheid, beeldverhouding, ondertitels, slaaptimer, intro overslaan']]
  ];
  function versionKey(v) { return String(v).split('.').map(function (x) { return +x || 0; }); }
  function newerThan(a, b) { const x = versionKey(a), y = versionKey(b); for (let k = 0; k < 3; k++) { if ((x[k] || 0) !== (y[k] || 0)) return (x[k] || 0) > (y[k] || 0); } return false; }
  const GNAME = 36; // rem, width of the channel column in the guide

  const state = {
    corrupt: storeCorrupt,
    view: 'home', lib: null, epg: null, source: null, loading: '', error: '',
    group: { live: '', vod: '', series: '', guide: '', radio: '' }, shown: {}, show: null, form: { type: 'm3u' }, playMeta: {},
    query: '', setTab: 'profiles', unlocked: false, rev: 0, cache: {}, remote: null, booted: false, remoteError: '',
    guideDay: 0, guideStart: 0, guideCat: '', guideQ: '', lastError: '', sub: null
  };

  const $ = function (id) { return document.getElementById(id); };
  const viewEl = $('view');
  const navEl = $('nav');
  const modalEl = $('modal');

  // ---------- helpers ----------
  function enc(s) { return encodeURIComponent(s); }

  function proxied(url, ttl, ua) {
    if (!native) return url;
    return '/proxy?u=' + enc(url) + '&ttl=' + (ttl || 0) + (ua ? '&ua=' + enc(ua) : '');
  }

  async function fetchText(url, ttl, ua) {
    if (/^file:\/\//i.test(url)) {
      if (!native || !native.readText) throw new Error('Lokale lijsten werken alleen in de Luma TV-app');
      return native.readText(url.replace(/^file:\/\//i, ''));
    }
    const res = await fetch(proxied(url, ttl, ua));
    if (!res.ok) throw new Error('Server antwoordde ' + res.status);
    return res.text();
  }

  async function fetchJson(url, ttl, ua) {
    const t = await fetchText(url, ttl, ua);
    try { return JSON.parse(t); } catch (e) { throw new Error('Onverwacht antwoord van de server'); }
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function btn(text, onclick, cls) {
    return h('button', { class: cls || 'btn', onclick: onclick, type: 'button' }, [text]);
  }

  function icon(name) {
    const s = h('span');
    s.innerHTML = '<svg viewBox="0 0 24 24">' + ICONS[name] + '</svg>';
    return s.firstChild;
  }

  function art(url) {
    return "url('" + proxied(url, 604800).replace(/'/g, '%27') + "')";
  }

  function rgba(hex, a) {
    const c = TH.normHex(hex) || '#ff8a1f';
    return 'rgba(' + parseInt(c.slice(1, 3), 16) + ',' + parseInt(c.slice(3, 5), 16) + ',' + parseInt(c.slice(5, 7), 16) + ',' + a + ')';
  }

  /** A calm gradient that is always the same for the same name, for items without artwork. */
  function tint(seed) {
    const x = parseInt(U.hash(seed || 'x'), 36) % 360;
    return 'linear-gradient(135deg, hsl(' + x + ',48%,36%), hsl(' + ((x + 45) % 360) + ',52%,15%))';
  }

  /** Colour wash for the screen behind a title: a soft glow plus a deep gradient, always the same for the same name. */
  function wash(seed) {
    const x = parseInt(U.hash(seed || 'x'), 36) % 360;
    return 'radial-gradient(90rem 70rem at 78% 28%, hsla(' + x + ',62%,46%,0.42), transparent 70%), radial-gradient(60rem 50rem at 100% 100%, hsla(' + ((x + 50) % 360) + ',60%,30%,0.45), transparent 70%), ' + tint(seed);
  }

  function seasonAccent() {
    if (store.ui('season', 'off') !== 'on') return '';
    const d = new Date();
    const m = d.getMonth() + 1, day = d.getDate();
    if (m === 12 && day >= 5 && day <= 26) return '#d94a4a';
    if ((m === 12 && day >= 27) || (m === 1 && day <= 2)) return '#ffd23f';
    if (m === 4 && day >= 20 && day <= 27) return '#ff7a00';
    return '';
  }
  function accent() { return seasonAccent() || TH.normHex(store.ui('accent', '#ff8a1f')) || '#ff8a1f'; }
  function on(key, def) { return store.ui(key, def || 'on') !== 'off'; }

  // ---------- start intro ----------
  const intro = { t0: Date.now(), done: false, epgPending: false };
  function introStatus(t) { const e = $('intro-status'); if (e) e.textContent = t; }
  /** Closes the loading screen once the library, the guide and the sport list are ready (or when forced). */
  function introDone(force) {
    if (intro.done) return;
    if (!force) {
      if (state.loading || intro.epgPending || sportBuild.busy) return;
    }
    intro.done = true;
    const el = $('intro');
    const next = function () {
      if (state.askWho && !document.querySelector('.who')) showWho(true);
      state.askWho = false;
    };
    if (!el) { next(); return; }
    introStatus('Klaar');
    const wait = Math.max(0, (store.pref('intro') === 'off' ? 0 : 2200) - (Date.now() - intro.t0));
    setTimeout(function () {
      next();
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 700);
    }, wait);
  }

  // ---------- theme and profile ----------
  function applyTheme() {
    const mode = TH.resolveMode(store.ui('theme', 'dark'));
    document.body.className = mode + (on('effects') ? '' : ' noanim') + (on('hc', 'off') ? ' hc' : '');
    const cs = { small: 0.84, normal: 1, large: 1.16 }[store.ui('cardsize', 'normal')] || 1;
    document.body.style.setProperty('--cs', cs);
    document.body.style.setProperty('--topa', store.ui('topalpha', '1'));
    document.body.style.setProperty('--grow', on('compact', 'off') ? '6.6rem' : '8.6rem');
    const ac = accent();
    document.body.style.setProperty('--ac', ac);
    document.body.style.setProperty('--acrgb', parseInt(ac.slice(1, 3), 16) + ',' + parseInt(ac.slice(3, 5), 16) + ',' + parseInt(ac.slice(5, 7), 16));
    document.body.style.setProperty('--acx', TH.onColor(ac));
    document.documentElement.style.fontSize = (TH.SIZES[store.ui('size', 'normal')] || TH.SIZES.normal) + 'vw';
    document.body.style.fontFamily = { serif: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, Menlo, monospace', round: '"Trebuchet MS", "Segoe UI", sans-serif' }[store.ui('font', 'sans')] || '';
    $('clock').style.display = on('clock') ? '' : 'none';
    const p = store.profile();
    const pb = $('prof');
    pb.style.background = avatarBg(p);
    pb.textContent = p.sym || (p.name || '?').trim().slice(0, 1).toUpperCase();
  }

  function pin() { return store.pref('pin'); }
  function isKid() { return !!store.profile().kid; }

  function lockWords() {
    const v = store.pref('lock');
    if (v === '-') return [];
    return (v || 'xxx,adult,18+,erotic,porn').toLowerCase().split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function lockedNow(group) {
    const g = (group || '').toLowerCase();
    if (!lockWords().some(function (w) { return g.indexOf(w) >= 0; })) return false;
    if (isKid()) return true;
    return !!pin() && !state.unlocked;
  }

  function bump() { state.rev++; state.cache = {}; state.altIdx = null; }

  /** The library as this profile may see it: hidden and locked categories removed, channels sorted as chosen. */
  function vis(kind) {
    if (!state.lib) return [];
    const c = state.cache[kind];
    if (c) return c;
    let list = state.lib[kind].filter(function (it) {
      const g0 = it.group0 || it.group;
      if (store.isHidden(g0) || lockedNow(g0)) return false;
      return kind !== 'live' || !store.chan(it.id).hide;
    });
    if (kind === 'vod' && store.ui('dedupe', 'off') === 'on') {
      const seen = {};
      list = list.filter(function (it) {
        const k = META.keyOf('vod', it.name);
        if (!seen[k]) { seen[k] = it; it.alts = []; return true; }
        seen[k].alts.push(it);
        return false;
      });
    }
    if (kind === 'live' && store.ui('dedupelive', 'off') === 'on') {
      const best = {};
      list.forEach(function (c2) {
        const k = baseName(c2.name0 || c2.name);
        if (k && (!best[k] || quality(c2.name0 || c2.name) > quality(best[k].name0 || best[k].name))) best[k] = c2;
      });
      list = list.filter(function (c2) { const k = baseName(c2.name0 || c2.name); return !k || best[k] === c2; });
    }
    if (kind === 'live') {
      list.forEach(function (c2) {
        const o = store.chan(c2.id);
        c2.no = o.num ? +o.num : c2.no0;
        c2.name = o.name || c2.name0;
        c2.group = o.folder || c2.group0 || c2.group;
        c2.logo = o.logo || c2.logo0 || (state.epg && state.epg.icons.get(c2.id)) || c2.logo;
      });
      const pr = store.profile();
      if (pr.kid && pr.onlyFavs) list = list.filter(function (c2) { return store.isFav(c2.id); });
      if (store.ui('sort', 'list') === 'name') list = list.slice().sort(function (x, y) { return x.name.localeCompare(y.name); });
      else if (store.ui('sort', 'list') === 'num') list = list.slice().sort(function (x, y) { return x.no - y.no; });
    } else {
      const so = store.ui('vsort', 'list');
      if (so === 'name') list = list.slice().sort(function (x, y) { return x.name.localeCompare(y.name); });
      else if (so === 'nameDesc') list = list.slice().sort(function (x, y) { return y.name.localeCompare(x.name); });
      else if (so === 'newest') list = list.slice().reverse();
    }
    if (store.ui('dedupe', 'off') === 'on' && kind !== 'series') list = dedupe(list, kind === 'live');
    state.cache[kind] = list;
    return list;
  }

  function baseName(n) {
    return fold(String(n || '').replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|h264|raw|1080p?|720p?|2160p?|50fps|60fps)\b/gi, ' '));
  }

  /** Other versions of the same channel (HD, FHD, 4K, other list entries), best quality first, to fall back on when a stream fails. */
  function altUrls(it) {
    if (!state.altIdx) {
      state.altIdx = {};
      state.lib.live.forEach(function (c) { const k = baseName(c.name0 || c.name); if (k) (state.altIdx[k] = state.altIdx[k] || []).push(c); });
    }
    const list = (state.altIdx[baseName(it.name0 || it.name)] || []).filter(function (c) { return c.url !== it.url; });
    list.sort(function (x, y) { return quality(y.name0 || y.name) - quality(x.name0 || x.name); });
    return list.slice(0, 2).map(function (c) { return c.url; });
  }

  function quality(n) {
    n = String(n || '').toLowerCase();
    return /\b(4k|uhd|2160p?)\b/.test(n) ? 4 : /\b(fhd|1080p?)\b/.test(n) ? 3 : /\b(hd|720p?)\b/.test(n) ? 2 : /\bsd\b/.test(n) ? 0 : 1;
  }

  /** Same channel or film in several qualities (HD, FHD, 4K): keep the best one, at the place of the first. */
  function dedupe(list, withGroup) {
    const at = {};
    const out = [];
    list.forEach(function (x) {
      const base = baseName(x.name0 || x.name);
      const k = base + (withGroup ? '|' + x.group : '');
      if (!base) { out.push(x); return; }
      if (at[k] == null) { at[k] = out.length; out.push(x); }
      else if (quality(x.name0 || x.name) > quality(out[at[k]].name0 || out[at[k]].name)) out[at[k]] = x;
    });
    return out;
  }

  /** "4K" or "HDR" when the title says so. */
  function qualityTag(n) {
    n = String(n || '');
    const t = [];
    if (/\b(4k|uhd|2160p?)\b/i.test(n)) t.push('4K');
    if (/\b(hdr10?\+?|dolby ?vision)\b/i.test(n)) t.push('HDR');
    return t.join(' ');
  }

  // ---------- tiles and hero ----------
  /**
   * One tile. o: kind ('live' | 'vod' | 'series'), title, sub, logo, photo (real picture), key, progress (0..1), onclick,
   * lp (long press), badge, and for the big picture behind the screen: heroTitle, heroSub, desc, tag, hint, photo.
   */
  function card(o) {
    const poster = !o.wide && (o.kind === 'vod' || o.kind === 'series');
    const img = o.photo || o.logo;
    const bg = img ? art(img) + ',' + tint(o.key || o.title) : tint(o.key || o.title);
    const a = h('div', { class: 'art' + (o.photo ? ' photo' : ''), style: { backgroundImage: bg } }, img ? [] : [h('span', { class: 'ini', text: (o.title || '?').trim().slice(0, 2).toUpperCase() })]);
    if (o.photo && o.logo) a.appendChild(h('div', { class: 'chlogo', style: { backgroundImage: art(o.logo) } }));
    if (o.progress != null) a.appendChild(h('div', { class: 'bar' }, [h('i', { style: { width: Math.round(Math.min(1, o.progress) * 100) + '%' } })]));
    if (o.livebadge) a.appendChild(h('div', { class: 'livebadge', text: 'LIVE' }));
    const badge = o.badge || (o.fav ? '★' : '');
    if (badge) a.appendChild(h('div', { class: 'badge', text: badge }));
    const meta = [h('div', { class: 't', text: o.title })];
    if (o.sub) meta.push(h('div', { class: 's', text: o.sub }));
    const b = h('button', { class: 'card ' + (poster ? 'poster' : 'wide') + (o.kind === 'live' ? ' live' : ''), type: 'button', onclick: o.onclick }, [a, h('div', { class: 'meta' }, meta)]);
    b._info = { title: o.heroTitle || o.title, sub: o.heroSub || o.sub || '', desc: o.desc || '', logo: o.logo, photo: o.photo || '', backdrop: '', kind: o.kind, tag: o.tag || '', key: o.key || o.title, hint: o.hint || '', name: o.metaName || '', mkind: o.metaKind || '' };
    if (o.lp) b._lp = o.lp;
    return b;
  }

  // ---------- slideshows ----------
  /** Photos behind a screen, per screen. Add files to img/slides and list them here. */
  const SLIDESETS = {
    home: ['img/slides/s1.jpg', 'img/slides/s2.jpg', 'img/slides/s3.jpg', 'img/slides/s4.jpg', 'img/slides/s5.jpg'],
    live: ['img/slides/t1.jpg', 'img/slides/t2.jpg', 'img/slides/t3.jpg', 'img/slides/t4.jpg', 'img/slides/t5.jpg']
  };
  const SLIDE_MS = 10000;
  let slideSet = '';
  let slideIdx = -1;
  let slideTop = 0;

  function slideShow(i) {
    const box = $('slides');
    const list = SLIDESETS[slideSet];
    if (!box || !list) return;
    if (!box.firstChild) { box.appendChild(h('div', { class: 'sl' })); box.appendChild(h('div', { class: 'sl' })); }
    slideTop = 1 - slideTop;
    const layers = box.children;
    layers[slideTop].style.backgroundImage = 'url("' + list[i] + '")';
    layers[slideTop].classList.add('show');
    layers[1 - slideTop].classList.remove('show');
    slideIdx = i;
    try { const nx = new Image(); nx.src = list[(i + 1) % list.length]; } catch (e) { /* preloading is optional */ }
  }

  /** Shows the slideshow of the current screen (Voor jou, Live TV); other screens keep the calm colour wash. */
  function syncSlides() {
    const box = $('slides');
    if (!box) return;
    const key = state.view === 'home' && !state.show ? 'home' : state.view === 'live' && !state.show ? 'live' : '';
    const want = !!key && !!state.lib && on('homeslides') && on('slides_' + key) && SLIDESETS[key].length > 0;
    box.classList.toggle('on', want);
    box.classList.toggle('dim', key === 'live');
    if (want && slideSet !== key) { slideSet = key; slideIdx = -1; slideShow(0); }
    else if (want && slideIdx < 0) slideShow(0);
  }
  setInterval(function () {
    const box = $('slides');
    const list = SLIDESETS[slideSet];
    if (!box || !list || !box.classList.contains('on') || list.length < 2 || document.hidden) return;
    slideShow((slideIdx + 1) % list.length);
  }, SLIDE_MS);

  /** Puts the focused tile's colours and text behind the screen. The background is always a calm colour wash, never a picture. */
  function setHero(info) {
    if (!info) return;
    const bd = $('backdrop');
    const fill = $('bdfill');
    if (fill) fill.classList.remove('on');
    bd.classList.remove('photo', 'poster', 'logo');
    const seed = info.key || info.title;
    const slidesOn = !!(document.getElementById('slides') && document.getElementById('slides').classList.contains('on'));
    if (setHero.last !== seed && on('effects') && !slidesOn) {
      setHero.last = seed;
      bd.classList.remove('fade'); void bd.offsetWidth; bd.classList.add('fade');
    }
    bd.style.backgroundSize = 'cover';
    bd.style.backgroundPosition = 'center';
    const bgs = store.ui('bgstyle', 'wash');
    const bgu = store.ui('bgurl', '');
    if (bgu) { bd.style.backgroundImage = 'linear-gradient(rgba(8,8,12,0.62),rgba(8,8,12,0.62)), ' + art(bgu); }
    else if (bgs === 'plain') bd.style.backgroundImage = 'none';
    else if (bgs === 'accent' || !info.title) bd.style.backgroundImage = 'radial-gradient(70rem 50rem at 85% 5%, ' + rgba(accent(), 0.22) + ', transparent)';
    else bd.style.backgroundImage = wash(seed);
    const set = function (id, t) { const e = $(id); if (e) e.textContent = t || ''; };
    const compact = !!document.querySelector('.hmw');
    set('h-tag', compact || /^(NU )?LIVE$/i.test(info.tag || '') ? '' : info.tag);
    set('h-title', info.title);
    set('h-sub', info.sub);
    set('h-desc', info.desc);
    set('h-hint', compact ? (info.title ? (info.hint || 'OK = kijken').split(' · ')[0] : '') : info.hint);
    const hero = document.querySelector('.hero');
    if (hero && on('effects') && !slidesOn) { hero.classList.remove('swp'); void hero.offsetWidth; hero.classList.add('swp'); }
    const tg = $('h-tag');
    if (tg) tg.classList.toggle('livetag', /LIVE/.test(info.tag || ''));
  }

  // ---------- real pictures and info from TMDB (optional, with the owner's own key) ----------
  const metaCache = META.createCache(storage, 'luma.meta', 500);
  const metaBusy = {};

  function metaFor(kind, name, cb) {
    const key = store.pref('tmdb');
    if (!key || !name) return;
    const k = META.keyOf(kind, name);
    const hit = metaCache.get(k);
    if (hit !== undefined) { if (hit) cb(hit); return; }
    if (metaBusy[k]) return;
    metaBusy[k] = 1;
    META.lookup(kind, name, key, store.pref('tmdblang') || 'nl-NL', function (u) { return fetchJson(u, 86400); }).then(function (m) {
      metaCache.set(k, m || null);
      delete metaBusy[k];
      if (m) cb(m);
    }).catch(function () { delete metaBusy[k]; });
  }

  function metaAsync(kind, name) {
    const key = store.pref('tmdb');
    if (!key || !name) return Promise.resolve(null);
    const k = META.keyOf(kind, name);
    const hit = metaCache.get(k);
    if (hit !== undefined) return Promise.resolve(hit);
    return META.lookup(kind, name, key, store.pref('tmdblang') || 'nl-NL', function (u) { return fetchJson(u, 86400); }).then(function (m) {
      metaCache.set(k, m || null);
      return m || null;
    }).catch(function () { return null; });
  }

  // Real pictures on live tiles: the picture of the programme on now, found at TMDB when the guide has none.
  const GENERIC = /journaal|nieuws|news|weer|actualit|ochtend|avond|nacht|programma|reclame|teletekst|uitzending|herhaling|sluiting|tv ?shop|gesloten|muziek|radio/i;
  const artQueue = [];
  let artBusy = 0;
  let artObs = null;

  function artPump() {
    while (artBusy < 3 && artQueue.length) {
      const j = artQueue.shift();
      if (!j.el.isConnected) continue;
      artBusy++;
      const kinds = /serie|series|soap|drama/i.test(j.cat || '') ? ['series', 'vod'] : ['vod', 'series'];
      metaAsync(kinds[0], j.title).then(function (m) { return m && (m.backdrop || m.poster) ? m : metaAsync(kinds[1], j.title); }).then(function (m) {
        artBusy--;
        const url = m && (m.backdrop || m.poster);
        if (url && j.el.isConnected) {
          const ar = j.el.querySelector('.art');
          if (ar) {
            ar.style.backgroundImage = art(url) + ',' + tint(j.title);
            ar.classList.add('photo');
            ar.querySelectorAll('.ini').forEach(function (x) { x.remove(); });
            if (j.logo && !ar.querySelector('.chlogo')) ar.appendChild(h('div', { class: 'chlogo', style: { backgroundImage: art(j.logo) } }));
          }
          if (j.el._info) { j.el._info.photo = url; j.el._info.backdrop = m.backdrop || ''; }
        }
        artPump();
      });
    }
  }

  function liveArt(el, title, cat, logo) {
    if (!store.pref('tmdb') || !title || title.length < 3 || GENERIC.test(title)) return;
    const job = { el: el, title: title, cat: cat, logo: logo };
    if (!('IntersectionObserver' in window)) { artQueue.push(job); artPump(); return; }
    if (!artObs) {
      artObs = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          artObs.unobserve(e.target);
          artQueue.push(e.target._artJob);
        });
        artPump();
      }, { rootMargin: '400px' });
    }
    el._artJob = job;
    artObs.observe(el);
  }

  /** Shows a tile in the hero and, when a TMDB key is set, upgrades it with a real backdrop and description. */
  function heroFor(info) {
    setHero(info);
    if (!info || !info.name || !info.mkind) return;
    const apply = function (m) {
      if (m.backdrop) info.backdrop = m.backdrop;
      if (!info.desc && m.overview) info.desc = m.overview;
      const bits = [info.sub];
      if (m.year) bits.push(m.year);
      if (m.rating) bits.push('★ ' + m.rating);
      if (!info._meta) { info.sub = bits.filter(Boolean).join(' · '); info._meta = 1; }
      const f = document.activeElement;
      if (f && f._info === info) setHero(info);
    };
    metaFor(info.mkind, info.name, apply);
  }

  function shelf(title, cards, more) {
    const head = more ? h('div', { class: 'shh' }, [h('h2', { text: title }), h('button', { class: 'allbtn', type: 'button', onclick: more }, ['Alles bekijken'])]) : h('h2', { text: title });
    return h('section', { class: 'shelf' }, [head, h('div', { class: 'rail' }, cards)]);
  }

  function row(opts) {
    const b = h('button', { class: 'row', type: 'button', onclick: opts.onclick }, [
      opts.lead || null,
      h('div', { class: 'grow' }, [h('div', { class: 't', text: opts.title }), opts.sub ? h('div', { class: 'sub t', text: opts.sub }) : null]),
      opts.right ? (typeof opts.right === 'string' ? h('div', { class: 'sub', text: opts.right }) : opts.right) : null
    ]);
    return b;
  }

  function chips(list, current, onpick, extra) {
    const all = [['', 'Alles']].concat(extra || []).concat(list.map(function (g) { return [g, g]; }));
    return h('div', { class: 'chips' }, all.map(function (g) {
      return h('button', { class: 'chip' + (g[0] === current ? ' on' : ''), type: 'button', onclick: function () { onpick(g[0]); } }, [g[1]]);
    }));
  }

  function groupsOf(items) {
    const seen = {};
    const out = [];
    items.forEach(function (i) { if (!seen[i.group]) { seen[i.group] = 1; out.push(i.group); } });
    return out;
  }

  function more(key, total, rerender) {
    const n = state.shown[key] || PAGE;
    if (n >= total) return null;
    return btn('Meer tonen (' + (total - n) + ')', function () { state.shown[key] = n + PAGE; rerender(); }, 'btn sec');
  }

  // ---------- dialogs ----------
  let modalReturn = null;
  function openModal(node) {
    if (modalEl.hidden) modalReturn = document.activeElement;
    modalEl.textContent = '';
    modalEl.appendChild(node);
    modalEl.hidden = false;
    const f = modalEl.querySelector('button, input');
    if (f) f.focus({ preventScroll: true });
  }

  function closeModal() {
    modalEl.hidden = true;
    modalEl.textContent = '';
    modalEl.onkeydown = null;
    if (modalReturn && modalReturn.isConnected) modalReturn.focus({ preventScroll: true });
    modalReturn = null;
  }

  const modalOpen = function () { return !modalEl.hidden; };

  /** On-screen pin pad. cb(pin) is called with four digits; it may return false to keep the pad open (wrong pin). */
  function askPin(title, cb) {
    let val = '';
    const show = h('div', { class: 'pin', text: '' });
    const paint = function () { show.textContent = '●'.repeat(val.length) + '○'.repeat(4 - val.length); };
    const press = function (d) {
      if (d === 'del') val = val.slice(0, -1);
      else if (val.length < 4) val += d;
      paint();
      if (val.length === 4) {
        const done = val;
        val = '';
        const r = cb(done);
        if (r === false) { paint(); toast('Onjuiste pincode'); } else closeModal();
      }
    };
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', '0', 'del'];
    const pad = h('div', { class: 'pad' }, keys.map(function (k) {
      if (k === 'x') return btn('✕', function () { closeModal(); }, 'btn');
      return btn(k === 'del' ? '⌫' : k, function () { press(k); }, 'btn');
    }));
    paint();
    openModal(h('div', { class: 'dlg' }, [h('h2', { text: title }), show, pad]));
    modalEl.onkeydown = function (e) {
      if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { press('del'); e.preventDefault(); }
    };
  }

  /** Runs fn when the pin is right, or at once when no pin is set. */
  function needPin(title, fn) {
    if (!pin()) return fn();
    askPin(title, function (p) { if (p !== pin()) return false; fn(); return true; });
  }

  function pickList(title, items, current, onpick) {
    const list = h('div', { class: 'list', style: { maxHeight: '70rem', overflow: 'auto', padding: '0.6rem' } }, items.map(function (it) {
      return row({ title: it[1], right: it[0] === current ? '✓' : '', onclick: function () { closeModal(); onpick(it[0]); } });
    }));
    openModal(h('div', { class: 'dlg', style: { minWidth: '90rem' } }, [h('h2', { text: title }), list, btn('Sluiten', closeModal, 'btn sec')]));
    const sel = Array.prototype.find.call(modalEl.querySelectorAll('.row'), function (b) { return b.textContent.slice(-1) === '✓'; });
    if (sel) { sel.focus({ preventScroll: true }); sel.scrollIntoView({ block: 'center' }); }
  }

  // ---------- loading ----------
  /** Downloads one source and turns it into a library. Throws with a readable message when it fails. */
  async function fetchLib(src, force) {
    const ttl = force ? 0 : Math.round((+store.pref('refresh') || 1) * 3600);
    const ua = src.ua || '';
    let lib;
    let epgUrl = src.epg || '';
    if (src.type === 'xtream') {
      const auth = await fetchJson(XT.apiUrl(src, ''), 0, ua);
      const ok = auth && auth.user_info && (auth.user_info.auth === 1 || auth.user_info.auth === '1');
      if (!ok) throw new Error('Inloggen mislukt: controleer server, gebruikersnaam en wachtwoord');
      const get = function (a) { return fetchJson(XT.apiUrl(src, a), ttl, ua).catch(function () { return []; }); };
      const r = await Promise.all([
        get('get_live_categories'), get('get_live_streams'), get('get_vod_categories'),
        get('get_vod_streams'), get('get_series_categories'), get('get_series')
      ]);
      lib = { live: XT.normalizeLive(src, r[1], r[0]), vod: XT.normalizeVod(src, r[3], r[2]), series: XT.normalizeSeriesList(src, r[5], r[4]) };
      if (!epgUrl) epgUrl = XT.epgUrl(src);
    } else {
      const text = await fetchText(src.url, ttl, ua);
      const items = M3U.parseM3U(text);
      if (!items.length) throw new Error('Geen zenders of titels gevonden in deze afspeellijst');
      lib = M3U.buildLibrary(items, src.id);
      if (!epgUrl) epgUrl = M3U.epgFromHeader(text);
    }
    return { lib: lib, epgUrl: epgUrl, ua: ua };
  }

  async function loadSource(src, force) {
    state.loading = 'Bibliotheek laden…';
    state.error = '';
    introStatus('Zenders, films en series laden…');
    render();
    const ua = src.ua || '';
    let lib;
    let epgUrl = '';
    const t0 = Date.now();
    try {
      const merge = store.pref('merge') === 'on' && store.sources().length > 1;
      if (merge) {
        const got = [];
        for (const s of store.sources()) {
          if (s.off && s.id !== src.id) continue;
          try { got.push(await fetchLib(s, force)); } catch (e) { if (s.id === src.id) throw e; }
        }
        lib = { live: [], vod: [], series: [] };
        got.forEach(function (g) {
          ['live', 'vod', 'series'].forEach(function (k) { Array.prototype.push.apply(lib[k], g.lib[k]); });
          if (g.epgUrl) epgUrl += ' ' + g.epgUrl;
        });
      } else {
        const g = await fetchLib(src, force);
        lib = g.lib;
        epgUrl = g.epgUrl;
      }
    } catch (e) {
      state.loading = '';
      state.error = String(e.message || e);
      state.lib = null;
      state.lastError = state.error;
      bump();
      render();
      introDone(true);
      return;
    }
    lib.live.forEach(function (c, i) { c.no = i + 1; c.no0 = i + 1; c.name0 = c.name; c.group0 = c.group; c.logo0 = c.logo; });
    state.loadMs = Date.now() - t0;
    state.source = src;
    state.lib = lib;
    state.loadedAt = Date.now();
    state.epg = null;
    state.loading = '';
    bump();
    render();
    const before = store.seen(src.id);
    store.setSeen(src.id, lib.live.length);
    if (before && lib.live.length > before) toast((lib.live.length - before) + ' nieuwe zenders in je lijst');
    if (epgUrl) { intro.epgPending = true; introStatus('Programmagids laden…'); loadEpg(epgUrl, lib, ua, force); }
    else introDone();
    if (!state.booted) {
      state.booted = true;
      autoStart();
    }
    setTimeout(checkFollows, 4000);
  }

  function buildEpg() {
    if (!state.epgData || !state.lib) return;
    state.epg = new Epg(state.epgData, state.lib.live.map(function (c) { return { id: c.id, name: c.name0 || c.name, tvgId: c.tvgId, epgId: store.chan(c.id).epgId || '' }; }));
    bump();
  }

  async function loadEpg(url, lib, ua, force) {
    try {
      const urls = String(url).split(/[\s,]+/).filter(Boolean);
      const now = Date.now();
      const hours = Math.max(60, (+store.ui('hours', '6') || 6) + 12);
      const merged = { channels: {}, programmes: {} };
      const ttl = force ? 0 : (+store.pref('epgttl') || 6) * 3600;
      let okAny = false;
      for (const u of urls) {
        try {
          const text = await fetchText(u, ttl, ua);
          const data = XMLTV.parseXmltv(text, now - 3600000, now + hours * 3600000);
          Object.keys(data.channels).forEach(function (k) { if (!merged.channels[k]) merged.channels[k] = data.channels[k]; });
          Object.keys(data.programmes).forEach(function (k) {
            merged.programmes[k] = (merged.programmes[k] || []).concat(data.programmes[k]).sort(function (x, y) { return x.start - y.start; });
          });
          okAny = true;
        } catch (e2) { /* one guide failing is fine */ }
      }
      if (!okAny || state.lib !== lib) return;
      const off = (+store.pref('epgoff') || 0) * 60000;
      if (off) Object.keys(merged.programmes).forEach(function (k) { merged.programmes[k].forEach(function (p) { p.start += off; p.stop += off; }); });
      state.epgData = merged;
      buildEpg();
      introStatus('Sport klaarzetten…');
      applyRecRules();
      if (!modalOpen() && (state.view === 'home' || state.view === 'live' || state.view === 'guide')) render(true);
      sportList();
    } catch (e) {
      // The guide is optional; channels still work without it.
    } finally {
      intro.epgPending = false;
      introDone();
    }
  }

  /** Starts the last watched channel right away when the profile asks for it. */
  function autoStart() {
    if (!native || store.ui('autolive', 'off') !== 'on' || state.askWho || document.querySelector('.who')) return;
    const rid = store.recent()[0];
    const list = vis('live');
    const i = list.findIndex(function (c) { return c.id === rid; });
    if (i >= 0) play(list, i);
  }

  // ---------- playback ----------
  function nowInfo(c) {
    return state.epg ? state.epg.nowNext(c, Date.now()) : { now: null, next: null };
  }

  function nowLine(item) {
    const nn = nowInfo(item);
    return nn.now ? { line: nn.now.title + ' op ' + item.name, start: nn.now.start, end: nn.now.stop } : null;
  }

  /** Programmes of a channel from the one that just ended (for the 'previous' tile) up to n more. */
  function progsFor(c, n, desc) {
    if (!state.epg) return [];
    const now = Date.now();
    const all = state.epg.forChannel(c);
    let k = -1;
    for (let i = 0; i < all.length; i++) if (all[i].stop > now) { k = i; break; }
    if (k < 0) return [];
    const from = Math.max(0, k - 1);
    return all.slice(from, k + (n || 4)).map(function (p, i) {
      return [p.start, p.stop, p.title, from + i === k && desc !== false ? (p.desc || '').slice(0, 280) : ''];
    });
  }

  function hoursMap() { try { return JSON.parse(store.ui('hrs', '{}')); } catch (e) { return {}; } }
  function noteHour(id) {
    const m = hoursMap();
    const a = m[id] || (m[id] = new Array(24).fill(0));
    a[new Date().getHours()]++;
    const keys = Object.keys(m);
    if (keys.length > 250) {
      keys.sort(function (x, y) { return m[x].reduce(function (s2, v) { return s2 + v; }, 0) - m[y].reduce(function (s2, v) { return s2 + v; }, 0); }).slice(0, keys.length - 250).forEach(function (k) { delete m[k]; });
    }
    store.setUi('hrs', JSON.stringify(m));
  }
  function hourScore(id) {
    const a = hoursMap()[id];
    if (!a) return 0;
    const h0 = new Date().getHours();
    return a[h0] * 2 + a[(h0 + 23) % 24] + a[(h0 + 1) % 24];
  }

  function play(list, index, opts) {
    opts = opts || {};
    const live = list[index].kind === 'live';
    if (live) noteHour(list[index].id);
    // Thousands of channels would make the payload tens of MB and freeze the page: send a window around the chosen one.
    const WIN = 500;
    if (live && list.length > WIN) {
      const from = Math.max(0, Math.min(index - WIN / 2, list.length - WIN));
      list = list.slice(from, from + WIN);
      index -= from;
    }
    const payload = {
      live: live, position: opts.position || 0, ua: (state.source && state.source.ua) || '', index: index,
      accent: accent(), seekBack: +store.ui('seekBack', '10') * 1000, seekFwd: +store.ui('seekFwd', '30') * 1000,
      overlayMs: +store.ui('overlay', '5') * 1000,
      subScale: +store.ui('subsize', '1'), nightFrom: nightRange() ? nightRange()[0] : -1, nightTo: nightRange() ? nightRange()[1] : -1, subColor: store.ui('subcolor', 'wit'), autoIntro: store.ui('autointro', 'off') === 'on', tsAuto: store.ui('tsauto', 'off') === 'on', recMin: +store.ui('recmin', '60'), alang: store.ui('alang', ''), slang: store.ui('slang', 'off'), maxH: +store.ui('maxh', '0'), autoNext: on('autonext'), skipMs: +store.ui('skipsecs', '85') * 1000,
      favs: store.favs(), recent: store.recent().slice(0, 6),
      list: list.map(function (it, k) {
        state.playMeta[it.id] = it.meta || it;
        const o = { id: it.id, title: it.title || it.name, url: it.url, showId: it.showId || '' };
        if (live) { if (state.lib && on('backup')) o.alt = altUrls(it); o.logo = it.logo || ''; o.num = it.no || 0; o.group = it.group || ''; o.p = k === index ? progsFor(it, 4) : progsFor(it, 2, false); }
        return o;
      })
    };
    if (live) {
      store.pushRecent(list[index].id);
      const n = nowLine(list[index]);
      if (native && n) native.setNow(JSON.stringify(n));
    }
    if (!native) { toast('Afspelen werkt alleen in de Luma TV-app'); return; }
    const lim = kidBlock();
    if (lim) { toast(lim); return; }
    native.play(JSON.stringify(payload));
  }

  // Bedtime and daily limit for kid profiles.
  function kidBlock() {
    const pr = store.profile();
    if (!pr.kid) return '';
    const hr = new Date().getHours();
    if (pr.bed && (hr >= +pr.bed || hr < 6)) return 'Het is bedtijd: kijken kan morgen weer';
    if (pr.limit && store.statsFor(1).total >= pr.limit * 60000) return 'Je kijktijd van vandaag is op';
    return '';
  }

  window.lumaPlayerClosed = function (res) {
    if (native) native.clearNow();
    if (!res || !res.id) return;
    if (res.favs) store.setFavs(res.favs);
    if (res.watch) Object.keys(res.watch).forEach(function (id) {
      const mm = state.playMeta[id];
      store.addWatch(res.watch[id], mm ? (mm.showName || mm.title || mm.name || 'Onbekend') : 'Onbekend');
    });
    if (res.done) res.done.forEach(function (id) { store.markWatched(id); });
    const m = state.playMeta[res.id];
    if (res.live) {
      store.pushRecent(res.id);
    } else if (m) {
      const dur = res.duration || 0;
      store.setProgress(res.id, {
        id: res.id, kind: m.kind, title: m.title || m.name, sub: m.sub || '', logo: m.logo || '', url: m.url,
        showId: m.showId || '', pos: res.ended && dur ? dur : res.position || 0, dur: dur, ts: Date.now()
      });
      if (dur && (res.ended || res.position >= 0.95 * dur)) store.markWatched(res.id);
    }
    render(true);
  };

  window.lumaSearch = function () { if (modalOpen()) closeModal(); go('search'); };
  window.lumaGo = function (v) { if (modalOpen()) closeModal(); go(v); };
  window.lumaBack = function () {
    if (modalOpen()) { closeModal(); return true; }
    if (state.show) { state.show = null; render(); return true; }
    if (state.view === 'settings' && state.sub) { state.sub = null; render(); return true; }
    if (state.view !== 'home') { go('home'); return true; }
    return false;
  };

  const CERT = { AL: 0, G: 0, '0': 0, '6': 6, '9': 9, '12': 12, PG: 10, '14': 14, 'PG-13': 13, '16': 16, R: 17, '18': 18, 'NC-17': 18 };
  async function certAge(m) {
    const key = store.pref('tmdb');
    if (!key) return null;
    const info = await META.lookup('movie', m.name, key, store.pref('tmdblang') || 'nl-NL', function (u) { return fetchJson(u, 86400); });
    if (!info || !info.id) return null;
    const j = await fetchJson('https://api.themoviedb.org/3/movie/' + info.id + '/release_dates?api_key=' + encodeURIComponent(key), 86400);
    const res = (j && j.results) || [];
    const pickC = function (cc) { const r = res.filter(function (x) { return x.iso_3166_1 === cc; })[0]; const c = r && r.release_dates.map(function (d) { return d.certification; }).filter(Boolean)[0]; return c; };
    const c = pickC('NL') || pickC('US') || pickC('GB');
    return c && CERT[c] !== undefined ? CERT[c] : null;
  }

  function playMovie(m) {
    if (m.alts && m.alts.length && !m._picked) {
      const opts = [[m.id, m.name]].concat(m.alts.map(function (a) { return [a.id, a.name]; }));
      return pickList('Kies een versie', opts, '', function (v) {
        const chosen = v === m.id ? m : m.alts.filter(function (a) { return a.id === v; })[0];
        playMovie(Object.assign({}, chosen, { alts: null, _picked: true }));
      });
    }
    const max = store.profile().kid ? store.profile().maxAge || 0 : 0;
    if (max && m.kind !== 'series') {
      toast('Leeftijd controleren…');
      return certAge(m).then(function (a) { if (a !== null && a > max) toast('Niet geschikt: vanaf ' + a + ' jaar'); else playMovieNow(m); }, function () { playMovieNow(m); });
    }
    playMovieNow(m);
  }

  function playMovieNow(m) {
    const p = store.getProgress(m.id);
    play([Object.assign({ title: m.name }, m)], 0, { position: p && p.pos > 20000 && p.pos < 0.95 * (p.dur || Infinity) ? p.pos - 5000 : 0 });
  }

  function episodeList(show) {
    return show.episodes.map(function (ep) {
      return {
        id: ep.id, kind: 'series', url: ep.url, title: show.name + ' S' + U.pad(ep.s) + 'E' + U.pad(ep.e),
        logo: show.logo, showId: show.id, showName: show.name, sub: ep.title
      };
    });
  }

  function playEpisode(show, idx, position) {
    play(episodeList(show), idx, { position: position || 0 });
  }

  function resumeEntry(p) {
    if (p.kind === 'series' && state.lib) {
      const show = state.lib.series.find(function (s) { return s.id === p.showId; });
      if (show && show.episodes) {
        const idx = show.episodes.findIndex(function (e) { return e.id === p.id; });
        if (idx >= 0) return playEpisode(show, idx, Math.max(0, p.pos - 5000));
      }
    }
    play([{ id: p.id, kind: p.kind, url: p.url, title: p.title, logo: p.logo, sub: p.sub, showId: p.showId }], 0, { position: Math.max(0, p.pos - 5000) });
  }

  // ---------- reminders ----------
  function alarmCfg() { try { return JSON.parse(store.ui('alarm', 'null')); } catch (e) { return null; } }
  function checkAlarm() {
    const al = alarmCfg();
    if (!al || !al.on || !state.lib) return;
    const d = new Date();
    const hm = U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
    const day = d.toISOString().slice(0, 10);
    if (hm !== al.time || al.last === day) return;
    al.last = day;
    store.setUi('alarm', JSON.stringify(al));
    chime();
    const list = vis('live');
    const i = list.findIndex(function (c) { return c.id === al.chId; });
    if (i >= 0) play(list, i);
  }

  function alarmDialog() {
    const al = alarmCfg() || { on: false, time: '07:30', chId: '' };
    textDialog('Wekker: tijdstip (uu:mm, leeg = uit)', al.on ? al.time : '07:30', function (t) {
      if (!t) { al.on = false; store.setUi('alarm', JSON.stringify(al)); return render(true); }
      if (!/^\d{1,2}:\d{2}$/.test(t)) return toast('Typ de tijd als 07:30');
      al.time = U.pad(+t.split(':')[0]) + ':' + t.split(':')[1];
      const pool = vis('live').filter(function (c) { return isRadio(c) || store.isFav(c.id); }).slice(0, 40);
      const list = pool.length ? pool : vis('live').slice(0, 40);
      pickList('Welke zender?', list.map(function (c) { return [c.id, c.name]; }), al.chId, function (id) {
        al.chId = id; al.on = true; al.last = '';
        store.setUi('alarm', JSON.stringify(al));
        toast('⏰ Wekker om ' + al.time + ' (de app moet dan openstaan)');
        render(true);
      });
    });
  }

  function chime() {
    if (store.ui('remsound', 'on') === 'off') return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.22, 0.44].forEach(function (d, i) {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = [660, 880, 1100][i]; g.gain.value = 0.12;
        o.connect(g); g.connect(audio.destination);
        o.start(audio.currentTime + d); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d + 0.2); o.stop(audio.currentTime + d + 0.21);
      });
    } catch (e2) { /* no audio */ }
  }

  function remindersTick() {
    const due = store.dueReminders(Date.now(), 60000, +store.ui('recpre', '0') * 60000);
    due.forEach(function (r) {
      if (r.rec) {
        const ch = vis('live').filter(function (c) { return c.id === r.chId; })[0];
        if (ch) { toast('● Opname van ' + r.title + ' gestart: het programma begint over een minuut'); startRecording(ch, r.title, Math.max(5, Math.round(((r.end || r.start + 3600000) - Date.now()) / 60000) + 1 + +store.ui('recpost', '0'))); return; }
      }
      chime();
      if (modalOpen()) { toast('Zo begint: ' + r.title + ' op ' + r.chName); return; }
      const dlg = h('div', { class: 'dlg' }, [
        h('h2', { text: 'Zo begint ' + r.title }),
        h('div', { class: 'sub', text: r.chName + ' · ' + U.clock(r.start) }),
        h('div', { class: 'btns' }, [
          btn('Nu kijken', function () {
            closeModal();
            const list = vis('live');
            const i = list.findIndex(function (c) { return c.id === r.chId; });
            if (i >= 0) play(list, i);
          }),
          btn('Later', closeModal, 'btn sec')
        ])
      ]);
      openModal(dlg);
      if (store.ui('remauto', 'off') === 'on') {
        let left = 10;
        const note = h('div', { class: 'sub', text: 'De zender start vanzelf over ' + left + ' seconden' });
        dlg.insertBefore(note, dlg.lastChild);
        const iv = setInterval(function () {
          if (modalEl.hidden || !dlg.isConnected) { clearInterval(iv); return; }
          left--;
          note.textContent = 'De zender start vanzelf over ' + left + ' seconden';
          if (left <= 0) {
            clearInterval(iv);
            closeModal();
            const list = vis('live');
            const i = list.findIndex(function (c) { return c.id === r.chId; });
            if (i >= 0) play(list, i);
          }
        }, 1000);
      }
    });
  }

  function toggleFav(c) {
    const now = store.toggleFav(c.id);
    toast(now ? '★ ' + c.name + ' staat bij je favorieten' : c.name + ' is geen favoriet meer');
    bump();
    render(true);
  }

  // ---------- views ----------
  function isRadio(c) { return /radio/i.test(c.group || ''); }

  function liveCard(c, list, i) {
    const nn = nowInfo(c);
    const prog = nn.now ? (Date.now() - nn.now.start) / (nn.now.stop - nn.now.start) : null;
    const photo = nn.now && nn.now.img ? nn.now.img : '';
    const el = card({
      kind: 'live', title: (c.no ? c.no + '  ' : '') + c.name, sub: nn.now ? nn.now.title : c.group, logo: c.logo, photo: photo, key: c.name, tag: isRadio(c) ? 'RADIO' : 'NU LIVE',
      fav: store.isFav(c.id), progress: prog,
      heroTitle: nn.now ? nn.now.title : c.name,
      heroSub: nn.now ? c.name + ' · ' + U.clock(nn.now.start) + '–' + U.clock(nn.now.stop) + (nn.next ? ' · Hierna: ' + nn.next.title : '') : c.group,
      desc: nn.now ? nn.now.desc : '', hint: 'OK = kijken · OK ingedrukt houden = menu',
      onclick: function () { play(list, i); },
      lp: function () { channelMenu(c); }
    });
    if (!photo && nn.now) liveArt(el, nn.now.title, nn.now.cat, c.logo);
    if (c.url && !isRadio(c)) { el._pv = c.url; el._cid = c.id; const sn = snapGet(c.id); if (sn) applySnap(el, sn, c); }
    return el;
  }

  function itemBadge(id) { return store.isWatched(id) ? '✓' : store.inList(id) ? '♥' : ''; }

  function movieCard(m) {
    const p = store.getProgress(m.id);
    const qt = qualityTag(m.name);
    const left = p && p.dur ? Math.max(1, Math.round((p.dur - p.pos) / 60000)) : 0;
    return card({ kind: 'vod', title: m.name, sub: m.group + (qt ? ' · ' + qt : '') + (left ? ' · nog ' + left + ' min' : ''), logo: m.logo, tag: 'FILM' + (qt ? ' · ' + qt : ''), badge: itemBadge(m.id), metaKind: 'vod', metaName: m.name,
      hint: 'OK = kijken · OK ingedrukt houden = menu', onclick: function () { playMovie(m); }, lp: function () { titleMenu(m); } });
  }

  function showCard(s) {
    const seenN = s.episodes && s.episodes.length ? s.episodes.filter(function (e) { return store.isWatched(e.id); }).length : 0;
    return card({ kind: 'series', title: s.name, sub: seenN ? seenN + ' van ' + s.episodes.length + ' gezien' : s.group, logo: s.logo, tag: 'SERIE', desc: s.plot || '', badge: itemBadge(s.id), metaKind: 'series', metaName: s.name,
      hint: 'OK = openen · OK ingedrukt houden = menu', onclick: function () { openShow(s); }, lp: function () { titleMenu(s); } });
  }

  function heroBlock(withButton) {
    const kids = [h('div', { class: 'tag', id: 'h-tag' }), h('h1', { id: 'h-title' }), h('div', { class: 'meta', id: 'h-sub' }), h('p', { class: 'desc', id: 'h-desc' }), h('div', { class: 'hint', id: 'h-hint' })];
    if (withButton) kids.push(withButton);
    return h('div', { class: 'hero' }, kids);
  }

  function channelMenu(c) {
    const o = store.chan(c.id);
    const items = [
      ['fav', store.isFav(c.id) ? '★ Uit favorieten halen' : '☆ Toevoegen aan favorieten'],
      ['zap', store.zapList().indexOf(c.id) >= 0 ? 'Uit de zapplijst halen' : '⚡ Toevoegen aan de zapplijst'],
      ['num', 'Zendernummer wijzigen (nu ' + c.no + ')'],
      ['name', 'Naam wijzigen'],
      ['move', '↕ Verplaatsen met de pijltjes'],
      ['sport', o.sport ? 'Niet meer als sportzender markeren' : '⚽ Markeren als sportzender'],
      ['folder', 'In een eigen map zetten' + (o.folder ? ' (nu ' + o.folder + ')' : '')],
      ['logo', 'Eigen logo (link naar een plaatje)'],
      ['epg', 'Gidszender koppelen' + (o.epgId ? ' (nu ' + o.epgId + ')' : '')],
      ['hide', 'Zender verbergen']
    ];
    if (o.num || o.name || o.folder || o.logo || o.epgId) items.push(['reset', 'Eigen nummer, naam, map en logo terugzetten']);
    pickList(c.name, items, '', function (v) {
      if (v === 'fav') return toggleFav(c);
      if (v === 'zap') { toast(store.toggleZap(c.id) ? '⚡ ' + c.name + ' staat in je zapplijst' : c.name + ' staat niet meer in je zapplijst'); bump(); return render(true); }
      if (v === 'move') { if (store.ui('sort', 'list') !== 'num') store.setUi('sort', 'num'); state.moving = c.id; bump(); toast('Pijltje omhoog of omlaag verplaatst de zender, OK is klaar'); return render(true); }
      if (v === 'hide') { store.setChan(c.id, { hide: true }); toast(c.name + ' is verborgen (terug te zetten bij Instellingen → Live TV & gids)'); bump(); return render(true); }
      if (v === 'epg') return textDialog('Zoek de gidszender voor ' + c.name + ' (typ een deel van de naam; leeg = terugzetten)', '', function (t) {
        if (!t) { store.setChan(c.id, { epgId: '' }); buildEpg(); return render(true); }
        const q = fold(t);
        const found = Object.keys((state.epgData || { channels: {} }).channels).filter(function (id) {
          return matches(id + ' ' + state.epgData.channels[id].names.join(' '), q);
        }).slice(0, 14);
        if (!found.length) return toast('Niets gevonden in de gids');
        pickList('Kies de gidszender', found.map(function (id) { return [id, (state.epgData.channels[id].names[0] || id) + ' (' + id + ')']; }), '', function (id) {
          store.setChan(c.id, { epgId: id });
          buildEpg();
          toast('Gids gekoppeld');
          render(true);
        });
      });
      if (v === 'folder') return textDialog('Map voor ' + c.name + ' (leeg laten = terugzetten)', o.folder || '', function (t) { store.setChan(c.id, { folder: t }); bump(); render(true); });
      if (v === 'logo') return textDialog('Link naar logo (leeg laten = terugzetten)', o.logo || '', function (t) { store.setChan(c.id, { logo: t }); bump(); render(true); });
      if (v === 'sport') { store.setChan(c.id, { sport: !o.sport }); bump(); return render(true); }
      if (v === 'reset') { store.setChan(c.id, { num: '', name: '', folder: '', logo: '', epgId: '' }); bump(); return render(true); }
      if (v === 'num') textDialog('Zendernummer voor ' + c.name, String(c.no), function (t) { const n = parseInt(t, 10); if (n > 0) { store.setChan(c.id, { num: n }); bump(); render(true); } });
      if (v === 'name') textDialog('Nieuwe naam', c.name, function (t) { store.setChan(c.id, { name: t === c.name0 ? '' : t }); bump(); render(true); });
    });
  }

  function sharedList() { try { return JSON.parse(store.pref('shared') || '[]'); } catch (e) { return []; } }
  function sharedHas(id) { return sharedList().some(function (x) { return x.id === id; }); }
  function sharedToggle(it) {
    const l = sharedList();
    const i = l.findIndex(function (x) { return x.id === it.id; });
    if (i >= 0) l.splice(i, 1);
    else l.push({ id: it.id, kind: it.kind, name: it.name });
    store.setPref('shared', JSON.stringify(l));
    return i < 0;
  }

  /** Titles that appeared in the source since yesterday; compared once per day. */
  function newTitles() {
    if (!state.lib || !state.source) return [];
    const base = 'luma.seen.' + (state.source.id || 'x');
    const today = new Date().toISOString().slice(0, 10);
    try {
      const all = state.lib.vod.concat(state.lib.series);
      const seenRaw = localStorage.getItem(base);
      if (!seenRaw) { localStorage.setItem(base, JSON.stringify({ day: today, ids: all.map(function (x) { return x.id; }), fresh: [] })); return []; }
      const seen = JSON.parse(seenRaw);
      if (seen.day !== today) {
        const had = {};
        seen.ids.forEach(function (i) { had[i] = 1; });
        const fresh = all.filter(function (x) { return !had[x.id]; }).slice(0, 40).map(function (x) { return x.id; });
        localStorage.setItem(base, JSON.stringify({ day: today, ids: all.map(function (x) { return x.id; }), fresh: fresh }));
        return fresh;
      }
      return seen.fresh || [];
    } catch (e) { return []; }
  }

  function titleMenu(it) {
    const items = [
      ['list', store.inList(it.id) ? '♥ Uit Mijn lijst halen' : '♡ Toevoegen aan Mijn lijst'],
      ['shared', sharedHas(it.id) ? 'Uit Samen kijken halen' : '👥 Toevoegen aan Samen kijken'],
      ['seen', store.isWatched(it.id) ? 'Markeren als niet gezien' : '✓ Markeren als gezien']
    ];
    if (store.getProgress(it.id)) items.push(['clear', 'Uit Verder kijken halen']);
    if (it.group) items.push(['more', 'Meer zoals dit (' + it.group + ')']);
    const trailer = it.kind === 'vod' && state.lib ? state.lib.vod.find(function (x) { return x.id !== it.id && /trailer/i.test(x.group || '') && fold(x.name).indexOf(fold(META.cleanTitle(it.name).title)) >= 0; }) : null;
    if (trailer) items.push(['trailer', '▶ Trailer bekijken']);
    if (store.pref('tmdb')) items.push(['cast', 'Acteurs en regisseur']);
    pickList(it.name, items, '', function (v) {
      if (v === 'trailer') return playMovie(trailer);
      if (v === 'cast') return showCast(it);
      if (v === 'more') { state.group[it.kind === 'series' ? 'series' : 'vod'] = it.group; state.shown = {}; return go(it.kind === 'series' ? 'series' : 'vod'); }
      if (v === 'list') toast(store.toggleList({ id: it.id, kind: it.kind, name: it.name, logo: it.logo, group: it.group }) ? '♥ Toegevoegd aan Mijn lijst' : 'Uit Mijn lijst gehaald');
      if (v === 'shared') toast(sharedToggle(it) ? '👥 Toegevoegd aan Samen kijken' : 'Uit Samen kijken gehaald');
      if (v === 'seen') store.toggleWatched(it.id);
      if (v === 'clear') store.removeProgress(it.id);
      bump();
      render(true);
    });
  }

  async function showCast(it) {
    try {
      const key = store.pref('tmdb');
      const lang = store.pref('tmdblang') || 'nl-NL';
      const type = it.kind === 'series' ? 'tv' : 'movie';
      const c = META.cleanTitle(it.name);
      const s = await fetchJson('https://api.themoviedb.org/3/search/' + type + '?api_key=' + encodeURIComponent(key) + '&language=' + lang + '&query=' + encodeURIComponent(c.title), 86400);
      const r = s && s.results && s.results[0];
      if (!r) return toast('Geen gegevens gevonden');
      const cr = await fetchJson('https://api.themoviedb.org/3/' + type + '/' + r.id + '/credits?api_key=' + encodeURIComponent(key) + '&language=' + lang, 86400);
      const dir = (cr.crew || []).filter(function (x) { return x.job === 'Director'; }).map(function (x) { return x.name; }).slice(0, 2);
      const cast = (cr.cast || []).slice(0, 10).map(function (x) { return x.name + (x.character ? ' als ' + x.character : ''); });
      openModal(h('div', { class: 'dlg', style: { minWidth: '100rem' } }, [h('h2', { text: it.name }),
        dir.length ? h('div', { class: 'sub', text: 'Regie: ' + dir.join(', ') }) : null,
        h('div', { class: 'list' }, cast.map(function (t) { return h('div', { class: 'ln' }, [h('span', { class: 'lp', text: t })]); })),
        btn('Sluiten', closeModal, 'btn sec')]));
    } catch (e) { toast('Gegevens ophalen mislukt'); }
  }

  function textDialog(title, value, onsave) {
    const inp = h('input', { type: 'text', value: value || '', autocomplete: 'off', autocapitalize: 'off' });
    openModal(h('div', { class: 'dlg' }, [h('h2', { text: title }), inp, h('div', { class: 'btns' }, [
      btn('Opslaan', function () { closeModal(); onsave(inp.value.trim()); }), btn('Annuleren', closeModal, 'btn sec')])]));
    inp.focus({ preventScroll: true });
  }

  function lookupItems(entries) {
    const byId = {};
    state.lib.vod.forEach(function (x) { byId[x.id] = x; });
    state.lib.series.forEach(function (x) { byId[x.id] = x; });
    return entries.map(function (e) { return byId[e.id]; }).filter(Boolean);
  }

  /** For every series you were watching: the first episode after the last one you finished. */
  function nextUps() {
    if (!state.lib) return [];
    const out = [];
    const seen = {};
    store.historyList(60).forEach(function (e) {
      if (e.kind !== 'series' || !e.showId || seen[e.showId]) return;
      seen[e.showId] = 1;
      const show = state.lib.series.find(function (s) { return s.id === e.showId; });
      if (!show || !show.episodes) return;
      const i = show.episodes.findIndex(function (x) { return x.id === e.id; });
      if (i < 0 || i + 1 >= show.episodes.length) return;
      const finished = store.isWatched(e.id) || (e.dur > 0 && e.pos / e.dur >= 0.95);
      if (!finished) return;
      out.push({ show: show, ep: show.episodes[i + 1], idx: i + 1 });
    });
    return out.slice(0, 12);
  }

  /** Channels showing a film right now with a good TMDB rating (looked up in the background). */
  function goodNow() {
    const key = store.pref('tmdb');
    if (!key || !state.epg || !state.epg.size || !state.lib) return [];
    const now = Date.now();
    if (!state.good || now - state.good.at > 20 * 60000) {
      const keep = state.good;
      state.good = { at: now, list: keep ? keep.list : [] };
      const cand = [];
      const chans = vis('live');
      for (let i = 0; i < chans.length && i < 3000 && cand.length < 12; i++) {
        const pr = state.epg.forChannel(chans[i]).filter(function (p) { return p.start <= now && p.stop > now && p.cat && catOf(p.cat) === 'Film'; })[0];
        if (pr) cand.push({ c: chans[i], p: pr });
      }
      Promise.all(cand.map(function (g) { return metaAsync('vod', g.p.title).then(function (m) { g.rating = m && m.rating ? m.rating : 0; return g; }); })).then(function (all) {
        state.good.list = all.filter(function (g) { return g.rating >= 6.5; }).sort(function (x, y) { return y.rating - x.rating; }).slice(0, 10);
        if (state.view === 'home' && state.good.list.length) render(true);
      });
    }
    return state.good.list;
  }

  /** Films in the guide for the next three days. */
  function upcomingFilms() {
    if (!state.epg || !state.epg.size || !state.lib) return [];
    const now = Date.now();
    if (state.tvf && now - state.tvf.at < 300000) return state.tvf.list;
    const out = [];
    const chans = vis('live');
    for (let i = 0; i < chans.length && i < 3000 && out.length < 40; i++) {
      state.epg.forChannel(chans[i]).forEach(function (p) {
        if (p.start > now && p.start < now + 3 * 86400000 && p.cat && catOf(p.cat) === 'Film' && p.stop - p.start > 70 * 60000) out.push({ c: chans[i], p: p });
      });
    }
    out.sort(function (x, y) { return x.p.start - y.p.start; });
    state.tvf = { at: now, list: out.slice(0, 15) };
    return state.tvf.list;
  }

  /** One suggestion a day from My list (films only). */
  function eveningMovie() {
    const mine = lookupItems(store.listItems()).filter(function (it) { return it.kind !== 'series' && !store.isWatched(it.id); });
    if (!mine.length) return null;
    return mine[U.hash(new Date().toISOString().slice(0, 10)) % mine.length];
  }

  /** Picks a channel with something on that you often watch around now. */
  function surprise() {
    const list = vis('live');
    let pool = list.filter(function (c) { return hourScore(c.id) > 0; });
    if (!pool.length) pool = list.filter(function (c) { return store.isFav(c.id); });
    if (!pool.length) pool = list;
    if (!pool.length) return toast('Geen zenders gevonden');
    const c = pool[Math.floor(Math.random() * pool.length)];
    toast('Verrassing: ' + c.name);
    play(list, list.indexOf(c));
  }

  // ---------- streaming services (from the groups on the server) ----------
  const STREAMS = [
    ['netflix', /netflix/i, 'NETFLIX', '#e50914', '#fff'],
    ['videoland', /videoland/i, 'videoland', '#e3003a', '#fff'],
    ['prime', /prime|amazon/i, 'prime video', '#00a8e1', '#fff'],
    ['disney', /disney/i, 'Disney+', '#0b2a8a', '#fff'],
    ['max', /\bhbo\b|\bmax\b/i, 'max', '#5b21d6', '#fff'],
    ['apple', /apple/i, 'tv+', '#111114', '#fff'],
    ['peacock', /peacock/i, 'peacock', '#101010', '#fff'],
    ['canal', /canal/i, 'CANAL+', '#0d0d0d', '#fff'],
    ['paramount', /paramount/i, 'Paramount+', '#0a5cff', '#fff'],
    ['skyshowtime', /sky\s*show/i, 'SkyShowtime', '#1a1a5a', '#fff'],
    ['viaplay', /viaplay/i, 'viaplay', '#ff2d6f', '#fff'],
    ['hulu', /hulu/i, 'hulu', '#1ce783', '#06140c'],
    ['npo', /\bnpo\b/i, 'NPO', '#ff6a00', '#fff'],
    ['rtl', /\brtl\b/i, 'RTL', '#d5001c', '#fff'],
    ['discovery', /discovery/i, 'discovery+', '#1664ff', '#fff'],
    ['dazn', /dazn/i, 'DAZN', '#f0f0f0', '#111'],
    ['ziggo', /ziggo/i, 'Ziggo', '#f58220', '#fff'],
    ['kpn', /\bkpn\b/i, 'KPN', '#00b140', '#fff']
  ];

  function sqTile(name, word, count, sub, bg, fg, onclick, logoId) {
    const kids = [];
    if (logoId) kids.push(h('img', { class: 'sqimg', src: 'img/streaming/' + logoId + '.png', alt: '', onerror: function () { this.remove(); } }));
    kids.push(h('span', { class: 'sqw', text: word }));
    const b = h('button', { class: 'sq', type: 'button', onclick: onclick }, [h('div', { class: 'sqa', style: { background: bg, color: fg } }, kids), h('div', { class: 'sql', text: name })]);
    b._info = { title: name, sub: sub || '', desc: '', logo: '', photo: '', backdrop: '', kind: 'live', tag: '', key: name, hint: 'OK = openen', name: name };
    return b;
  }

  function streamTiles(goTo) {
    const out = [];
    const seen = {};
    [['vod', 'Films'], ['series', 'Series']].forEach(function (k) {
      groupsOf(vis(k[0])).forEach(function (g) {
        const def = STREAMS.filter(function (s) { return s[1].test(g); })[0];
        if (!def) return;
        const n = vis(k[0]).filter(function (x) { return x.group === g; }).length;
        const id = def[0] + '|' + k[0] + '|' + g;
        if (seen[id]) return;
        seen[id] = 1;
        out.push({ def: def, kind: k[0], g: g, n: n });
      });
    });
    out.sort(function (x, y) { return STREAMS.indexOf(x.def) - STREAMS.indexOf(y.def); });
    return out.slice(0, 20).map(function (o) {
      const both = out.filter(function (z) { return z.def === o.def; }).length > 1;
      const label = both ? o.def[2] + (o.kind === 'vod' ? ' films' : ' series') : o.g;
      return sqTile(o.g, o.def[2], o.n, (o.kind === 'vod' ? 'Films' : 'Series') + ' · ' + o.n + ' titels', o.def[3], o.def[4], goTo(o.kind, o.g), o.def[0]);
    });
  }

  function vHome() {
    const root = h('div');
    if (!state.lib) {
      root.appendChild(heroBlock(btn('Gegevens invoeren', function () { state.setTab = 'sources'; go('settings'); })));
      setHero({ title: 'Welkom bij Luma TV', sub: 'Live tv, films en series uit je eigen abonnement.', desc: 'Voeg je eigen IPTV-gegevens toe, ook makkelijk met je telefoon. Er wordt geen content meegeleverd.', tag: 'LUMA TV', key: 'luma' });
      return root;
    }
    const wrap = h('div', { class: 'hmw' });
    wrap.appendChild(heroBlock());
    const rowsEl = h('div', { class: 'rows' });
    wrap.appendChild(rowsEl);
    if (state.update) rowsEl.appendChild(h('div', { class: 'upd' }, [btn('⬆ Update ' + state.update + ' beschikbaar: nu installeren', function () { state.setTab = 'updates'; go('settings'); }, 'btn sec')]));
    const sb = sportBanner();
    if (sb) rowsEl.appendChild(sb);
    const first = [];
    const live = vis('live');
    const rows = [];
    const add = function (key, title, cards, more) {
      if (!cards.length || !on('row_' + key)) return;
      rows.push({ key: key, title: title, cards: cards, more: more });
    };
    const goTo = function (view, grp) { return function () { if (grp !== undefined) state.group[view] = grp; state.shown = {}; go(view); }; };

    const lnList = [];
    store.favs().forEach(function (id) { const c = live.filter(function (x) { return x.id === id; })[0]; if (c && lnList.indexOf(c) < 0) lnList.push(c); });
    store.recent().forEach(function (id) { const c = live.filter(function (x) { return x.id === id; })[0]; if (c && lnList.indexOf(c) < 0) lnList.push(c); });
    if (lnList.length < 8) live.forEach(function (c) { if (lnList.length < 12 && lnList.indexOf(c) < 0 && state.epg && state.epg.size && state.epg.forChannel(c).length) lnList.push(c); });
    add('livenow', 'Live en straks', lnList.slice(0, 12).filter(function (c) { return nowInfo(c).now; }).map(function (c) {
      const el = liveCard(c, lnList, lnList.indexOf(c));
      const nn = nowInfo(c);
      el.firstChild.appendChild(h('div', { class: 'livebadge', text: 'LIVE' }));
      const sub = el.querySelector('.s');
      if (sub) sub.textContent = nn.now.title + (nn.next ? ' · straks ' + U.clock(nn.next.start) + ' ' + nn.next.title : '');
      return el;
    }), goTo('live', ''));
    {
      const now0 = Date.now();
      const sl = sportList().filter(function (e) { return e.p.stop > now0; });
      add('mymatches', 'Jouw wedstrijden', sl.filter(isMine).slice(0, 10).map(function (e) { return matchCard(e, 'h'); }), goTo('sport'));
      add('sportlive', 'Sport live', sl.filter(function (e) { return e.p.start <= now0; }).slice(0, 10).map(function (e) { return matchCard(e, 'hl'); }), goTo('sport'));
    }
    {
      const svc = [];
      if (svc.length) add('groups', 'Streaming', svc);
      else {
        const grp = groupsOf(live).slice(0, 12);
        if (grp.length > 1) add('groups', 'Groepen', [['__vod', 'Films'], ['__series', 'Series']].concat(grp.map(function (g) { return [g, g]; })).map(function (g) {
          return sqTile(g[1], g[1].trim().slice(0, 14), '', '', '#2a2f3a', '#fff', function () {
            if (g[0] === '__vod') return goTo('vod', '')();
            if (g[0] === '__series') return goTo('series', '')();
            goTo('live', g[0])();
          });
        }));
      }
    }

    const cont = store.continueList(12);
    add('cont', 'Verder kijken', cont.map(function (p) {
      const left = p.dur ? Math.max(1, Math.round((p.dur - p.pos) / 60000)) : 0;
      return card({
        kind: p.kind, wide: true, title: p.title, logo: p.logo, progress: p.dur ? p.pos / p.dur : 0, tag: 'VERDER KIJKEN',
        sub: (p.sub ? p.sub + ' · ' : '') + (left ? 'nog ' + left + ' min' : 'Hervat'), onclick: function () { resumeEntry(p); }
      });
    }));

    const dow = new Date().getDay();
    if (dow === 1 || dow === 2) {
      const wk2 = store.statsFor(7);
      if (wk2.total > 600000) {
        const tt = wk2.top[0];
        add('weekly', 'Jouw week', [card({ kind: 'series', wide: true, title: (wk2.total / 3600000).toFixed(1) + ' uur gekeken', tag: 'SAMENVATTING', sub: tt ? 'Meest bekeken: ' + tt[0] : '', onclick: function () { state.sub = 'year'; state.setTab = 'maint'; go('settings'); } })]);
      }
    }
    add('next', 'Volgende aflevering', nextUps().map(function (n) {
      return card({
        kind: 'series', wide: true, title: n.show.name, logo: n.show.logo, tag: 'VOLGENDE',
        sub: 'S' + U.pad(n.ep.s) + 'E' + U.pad(n.ep.e) + (n.ep.title ? ' · ' + n.ep.title : ''), onclick: function () { playEpisode(n.show, n.idx, 0); }
      });
    }));

    const byId = {};
    live.forEach(function (c) { byId[c.id] = c; });
    const favs = store.favs().map(function (id) { return byId[id]; }).filter(Boolean);
    const hr = new Date().getHours();
    const pref = hr < 11 ? /nieuws|news|ochtend/i : hr >= 19 ? /film|movie|cinema/i : null;
    if (pref && store.ui('favtime', 'on') === 'on') favs.sort(function (a, b) { return (pref.test(b.group || '') ? 1 : 0) - (pref.test(a.group || '') ? 1 : 0); });
    add('fav', 'Mijn favoriete zenders', favs.slice(0, 20).map(function (c) { return liveCard(c, favs, favs.indexOf(c)); }), goTo('live', '__fav'));

    let chans = store.recent().map(function (id) { return byId[id]; }).filter(Boolean);
    chans.sort(function (a, b) { return hourScore(b.id) - hourScore(a.id); });
    if (state.epg && state.epg.size) {
      live.forEach(function (c) { if (chans.length < 16 && chans.indexOf(c) < 0 && state.epg.forChannel(c).length) chans.push(c); });
    }
    if (!chans.length) chans = live.slice(0, 16);
    chans = chans.slice(0, 16);
    add('live', 'Nu op tv', chans.map(function (c) { return liveCard(c, live, live.indexOf(c)); }), goTo('live', ''));

    const mine = lookupItems(store.listItems());
    add('list', 'Mijn lijst', mine.map(function (it) { return it.kind === 'series' ? showCard(it) : movieCard(it); }), goTo('vod', '__list'));

    add('news', 'Nieuws', (state.news || []).slice(0, 12).map(function (n) {
      return card({ kind: 'series', wide: true, title: n.title, tag: 'NIEUWS', sub: n.src, onclick: function () { openModal(h('div', { class: 'dlg' }, [h('h2', { text: n.title }), h('div', { class: 'sub', text: n.desc || '' }), h('div', { class: 'btns' }, [btn('Sluiten', closeModal)])])); } });
    }));
    if (store.profiles().length > 1) add('both', 'Omdat jullie dit samen keken', lookupItems(store.overlap().map(function (id) { return { id: id }; })).slice(0, 16).map(function (it) { return it.kind === 'series' ? showCard(it) : movieCard(it); }));
    if (state.lib && store.ui('row_status', 'on') !== 'off') {
      rowsEl.insertBefore(h('div', { class: 'srcst', text: (state.error ? '● Bron reageert niet' : '● Bron in orde') + (state.loadedAt ? ' · bijgewerkt ' + U.clock(state.loadedAt) : '') + (state.loadMs ? ' · geladen in ' + Math.round(state.loadMs / 100) / 10 + ' s' : '') , style: { color: state.error ? '#ff453a' : '#30d158' } }), rowsEl.firstChild);
    }
    add('good', 'Nu iets goeds op tv', goodNow().map(function (g) { return card({ kind: 'live', wide: true, title: g.p.title, logo: g.c.logo, tag: '★ ' + g.rating, sub: g.c.name, onclick: function () { const l = vis('live'); play(l, l.indexOf(g.c)); } }); }));
    add('tvfilms', 'Aankomende films op tv', upcomingFilms().map(function (g) { return card({ kind: 'live', wide: true, title: g.p.title, logo: g.c.logo, tag: 'FILM', sub: g.c.name + ' · ' + new Date(g.p.start).toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' }), onclick: function () { progMenu(g.c, g.p, g.p.start <= Date.now()); } }); }));
    const evening = eveningMovie();
    if (evening) add('evening', 'Film van de avond', [movieCard(evening)]);
    add('shared', 'Samen kijken', lookupItems(sharedList()).map(function (it) { return it.kind === 'series' ? showCard(it) : movieCard(it); }));
    const weekAgo = Date.now() - 7 * 86400000;
    const wk = {};
    const weekIds = [];
    store.historyList(80).forEach(function (e) {
      if (!(e.ts > weekAgo)) return;
      const id = e.kind === 'series' ? e.showId : e.id;
      if (id && !wk[id]) { wk[id] = 1; weekIds.push({ id: id }); }
    });
    add('week', 'Gezien deze week', lookupItems(weekIds).map(function (it) { return it.kind === 'series' ? showCard(it) : movieCard(it); }));
    const fresh = newTitles();
    add('fresh', 'Nieuw toegevoegd', lookupItems(fresh.map(function (id) { return { id: id }; })).map(function (it) { return it.kind === 'series' ? showCard(it) : movieCard(it); }));

    const hist = store.historyList(1)[0];
    if (hist) {
      const base = lookupItems([{ id: hist.kind === 'series' ? hist.showId : hist.id }])[0];
      if (base) {
        const same = vis(base.kind).filter(function (x) { return x.group === base.group && x.id !== base.id; }).slice(0, 16);
        add('because', 'Omdat je ' + (base.name || hist.title) + ' keek', same.map(function (it) { return it.kind === 'series' ? showCard(it) : movieCard(it); }));
      }
    }

    add('vod', 'Films', vis('vod').slice(0, 20).map(movieCard), goTo('vod', ''));
    add('series', 'Series', vis('series').slice(0, 20).map(showCard), goTo('series', ''));
    crows().forEach(function (r) {
      const items = vis(r.kind).filter(function (c) { return c.group === r.group; }).slice(0, 20);
      add(r.key, r.name, r.kind === 'live' ? items.map(function (c, i) { return liveCard(c, items, i); }) : items.map(r.kind === 'series' ? showCard : movieCard), goTo(r.kind, r.group));
    });
    if (store.profiles().length > 1 && store.ui('row_family', 'on') !== 'off') {
      const fam = store.others().map(function (o) {
        const c = byId[o.recent];
        if (c) return card({ kind: 'live', wide: true, title: o.name + ' kijkt', sub: c.name, logo: c.logo, tag: 'GEZIN', onclick: function () { play(live, live.indexOf(c)); } });
        if (o.cont) return card({ kind: o.cont.kind, wide: true, title: o.name + ': ' + o.cont.title, sub: o.cont.sub || '', logo: o.cont.logo, tag: 'GEZIN', onclick: function () { resumeEntry(o.cont); } });
        return null;
      }).filter(Boolean);
      add('family', 'Wat het gezin kijkt', fam);
    }
    const order = store.ui('rowsorder', '').split(',').filter(Boolean);
    rows.sort(function (p, q) { const i = order.indexOf(p.key), j = order.indexOf(q.key); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    rows.forEach(function (r) { first.push(r.cards[0]); rowsEl.appendChild(shelf(r.title, r.cards, r.more)); });
    if (!first.length) rowsEl.appendChild(h('div', { class: 'msg', text: 'Er is niets om te tonen voor dit profiel. Controleer Instellingen → Voor jou.' }));
    rowsEl.appendChild(h('div', { class: 'rowsend' }));
    root.appendChild(wrap);
    if (first[0]) heroFor(first[0]._info);
    return root;
  }

  function crows() { try { return JSON.parse(store.ui('crows', '[]')) || []; } catch (e) { return []; } }
  function addCustomRow(kind, group) {
    const rows = crows();
    if (rows.some(function (r) { return r.kind === kind && r.group === group; })) return toast('Deze rij staat al op Voor jou');
    rows.push({ key: 'c' + U.hash(kind + '|' + group), name: group, kind: kind, group: group });
    store.setUi('crows', JSON.stringify(rows));
    toast('📌 ' + group + ' staat nu op Voor jou');
  }

  /** True when the same programme already ran earlier on this channel in the guide. */
  function isRepeat(c, p) {
    const t = fold(p.title);
    if (t.length < 4) return false;
    return state.epg.forChannel(c).some(function (x) { return x.start < p.start && fold(x.title) === t; });
  }

  function liveFiltered() {
    const all = vis('live');
    const g = state.group.live;
    if (g === '__fav') return all.filter(function (c) { return store.isFav(c.id); });
    if (g === '__sport') return all.filter(function (c) { return store.chan(c.id).sport; });
    if (g === '__zap') return all.filter(function (c) { return store.zapList().indexOf(c.id) >= 0; });
    return g ? all.filter(function (c) { return c.group === g; }) : all;
  }

  function liveRowInfo(c) {
    const nn = nowInfo(c);
    return {
      title: nn.now ? nn.now.title : c.name, sub: c.name, desc: nn.now ? nn.now.desc : '', logo: c.logo, photo: nn.now && nn.now.img ? nn.now.img : '', backdrop: '',
      kind: 'live', tag: 'NU LIVE', key: c.name, hint: '', name: nn.now ? nn.now.title : '', mkind: nn.now && /serie/i.test(nn.now.cat || '') ? 'series' : 'vod'
    };
  }

  /** Live TV in three columns: categories, channels, and what is on (with the guide below). */
  function vLive() {
    if (!state.lib) return vHome();
    const all = vis('live');
    const g = state.group.live;
    const list = liveFiltered();
    const root = h('div', { class: 'live3' + (store.ui('livegrid', 'off') === 'on' ? ' tiles' : '') });

    const counts = {};
    all.forEach(function (c) { counts[c.group] = (counts[c.group] || 0) + 1; });
    const cats = [['', 'Alle zenders', all.length]];
    const nf = store.favs().length;
    if (nf) cats.push(['__fav', '★ Favorieten', all.filter(function (c) { return store.isFav(c.id); }).length]);
    const nsp = all.filter(function (c) { return store.chan(c.id).sport; }).length;
    if (nsp) cats.push(['__sport', '⚽ Sport', nsp]);
    if (store.zapList().length) cats.push(['__zap', '⚡ Zapplijst', all.filter(function (c) { return store.zapList().indexOf(c.id) >= 0; }).length]);
    groupsOf(all).forEach(function (x) { cats.push([x, x, counts[x]]); });
    root.appendChild(h('div', { class: 'lcol cats' }, cats.map(function (c) {
      const catBtn = h('button', { class: 'lcat' + (c[0] === g ? ' on' : ''), type: 'button', 'data-k': 'cat|' + c[0], onclick: function () {
        state.group.live = c[0];
        state.shown.live = 0;
        render();
        const f = document.querySelector('.lch');
        if (f) f.focus({ preventScroll: true });
      } }, [h('span', { class: 'nm', text: c[1] }), h('span', { class: 'ct', text: String(c[2]) })]);
      if (c[0] && c[0].indexOf('__') !== 0) catBtn._lp = function () { groupMenu(c[0]); };
      if (c[0] === '__fav') catBtn._lp = function () {
        textDialog('Naam voor een eigen groep van je favorieten', '', function (t) {
          t = t.trim();
          if (!t) return;
          store.favs().forEach(function (id) { store.setChan(id, { folder: t }); });
          bump();
          toast('Favorieten staan nu in de groep ' + t);
          render(true);
        });
      };
      return catBtn;
    })));

    const n = state.shown.live || 60;
    const chans = h('div', { class: 'lcol chans' });
    list.slice(0, n).forEach(function (c, i) {
      const nn = nowInfo(c);
      const prog = nn.now ? (Date.now() - nn.now.start) / (nn.now.stop - nn.now.start) : null;
      const b = h('button', { class: 'lch' + (state.moving === c.id ? ' moving' : ''), type: 'button', 'data-k': c.id, onclick: function () { play(list, i); } }, [
        h('span', { class: 'no', text: c.no || '' }),
        h('span', { class: 'lg', style: c.logo ? { backgroundImage: art(c.logo) } : null, text: c.logo ? '' : (c.name || '?').slice(0, 2).toUpperCase() }),
        h('span', { class: 'tx' }, [h('span', { class: 'nm', text: c.name }), h('span', { class: 'pg', text: nn.now ? nn.now.title : c.group })]),
        store.isFav(c.id) ? h('span', { class: 'fv', text: '★' }) : null,
        prog != null ? h('span', { class: 'pb' }, [h('i', { style: { width: Math.round(Math.min(1, Math.max(0, prog)) * 100) + '%' } })]) : null
      ]);
      b._lp = function () { channelMenu(c); };
      b._linfo = c;
      b._info = liveRowInfo(c);
      chans.appendChild(b);
    });
    if (g && g.charAt(0) !== '_' && list.length) chans.appendChild(btn('📌 Als rij op Voor jou', function () { addCustomRow('live', g); }, 'btn sec'));
    if (list.length > n) chans.appendChild(btn('Meer zenders (' + (list.length - n) + ')', function () { state.shown.live = n + 60; render(true); }, 'btn sec'));
    if (!list.length) chans.appendChild(h('div', { class: 'msg', text: g === '__fav' ? 'Nog geen favorieten: houd OK ingedrukt op een zender.' : 'Geen zenders in deze categorie.' }));
    root.appendChild(chans);

    root.appendChild(h('div', { class: 'linfo' }, [
      h('div', { class: 'lchn', id: 'li-ch' }), h('h1', { id: 'li-t' }), h('div', { class: 'lwhen', id: 'li-w' }),
      h('div', { class: 'lbar' }, [h('i', { id: 'li-b' })]), h('p', { class: 'ldesc', id: 'li-d' }),
      h('h2', { text: 'Straks op deze zender' }), h('div', { class: 'lnext', id: 'li-n' })
    ]));
    return root;
  }

  /** Fills the right column for a channel: what is on now, and the next programmes. */
  function liveInfo(c) {
    const set = function (id, t) { const e = $(id); if (e) e.textContent = t || ''; };
    const nn = nowInfo(c);
    set('li-ch', (c.no ? c.no + '  ' : '') + c.name);
    set('li-t', nn.now ? nn.now.title : c.name);
    set('li-w', nn.now ? U.clock(nn.now.start) + ' – ' + U.clock(nn.now.stop) + '  ·  nog ' + Math.max(1, Math.round((nn.now.stop - Date.now()) / 60000)) + ' min' : c.group);
    set('li-d', nn.now ? nn.now.desc : (state.epg && state.epg.size ? '' : 'De gids wordt geladen, of is niet ingesteld.'));
    const b = $('li-b');
    if (b) b.style.width = nn.now ? Math.round(100 * Math.min(1, Math.max(0, (Date.now() - nn.now.start) / (nn.now.stop - nn.now.start)))) + '%' : '0%';
    const box = $('li-n');
    if (!box) return;
    box.textContent = '';
    const now = Date.now();
    const next = state.epg ? state.epg.forChannel(c).filter(function (p) { return p.stop > now && !(p.start <= now); }).slice(0, 7) : [];
    next.forEach(function (p) {
      box.appendChild(h('div', { class: 'ln' }, [h('span', { class: 'lt', text: U.clock(p.start) }), h('span', { class: 'lp', text: p.title }), h('span', { class: 'ld', text: Math.round((p.stop - p.start) / 60000) + ' min' })]));
    });
    if (!next.length) box.appendChild(h('div', { class: 'sub', text: 'Geen gidsgegevens beschikbaar.' }));
  }

  /** Two columns used by films, series and radio: menu on the left, pictures on the right. */
  function vSplit(o) {
    const root = h('div', { class: 'live3 split' });
    root.appendChild(h('div', { class: 'lcol cats' }, o.menu.map(function (c) {
      return h('button', { class: 'lcat' + (c.on ? ' on' : '') + (c.action ? ' act' : ''), type: 'button', 'data-k': 'cat|' + c.key, onclick: function () {
        c.run();
        const f = c.action ? null : document.querySelector('.split .card');
        if (f) f.focus({ preventScroll: true });
      } }, [h('span', { class: 'nm', text: c.label }), c.count != null ? h('span', { class: 'ct', text: String(c.count) }) : null]);
    })));
    const right = h('div', { class: 'lcol items' }, [h('h1', { class: 'sh', text: o.title })]);
    if (o.feature) right.appendChild(o.feature);
    if (o.raw) right.appendChild(o.raw);
    else if (o.cards.length) right.appendChild(h('div', { class: 'grid' + (o.posters ? ' posters' : '') }, o.cards));
    else right.appendChild(h('div', { class: 'msg', text: o.empty }));
    if (o.moreBtn) right.appendChild(o.moreBtn);
    root.appendChild(right);
    return root;
  }

  function pods() { try { return JSON.parse(store.ui('pods', '[]')) || []; } catch (e) { return []; } }

  /** Podcasts from RSS links you add yourself. */
  function vPodcasts(menu) {
    setHero({ title: '', key: 'luma' });
    const raw = h('div');
    if (!state.pod) {
      raw.appendChild(btn('+ Podcast toevoegen (RSS-link)', function () {
        textDialog('Link naar de RSS-feed', '', function (t) {
          if (!/^https?:\/\//i.test(t)) return toast('Dat is geen geldige link');
          const l = pods(); l.push({ name: t.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40), url: t });
          store.setUi('pods', JSON.stringify(l)); render(true);
        });
      }));
      pods().forEach(function (pd, i) {
        raw.appendChild(row({ title: pd.name, sub: pd.url, right: 'Openen', onclick: function () { openPod(pd); } }));
      });
      if (!pods().length) raw.appendChild(h('div', { class: 'msg', text: 'Nog geen podcasts. Voeg de RSS-link van een podcast toe.' }));
    } else {
      raw.appendChild(h('div', { class: 'btns' }, [btn('Terug', function () { state.pod = null; render(true); }, 'btn sec'), btn('Podcast verwijderen', function () {
        store.setUi('pods', JSON.stringify(pods().filter(function (z) { return z.url !== state.pod.url; }))); state.pod = null; render(true);
      }, 'btn sec')]));
      (state.pod.items || []).forEach(function (ep) {
        raw.appendChild(row({ title: ep.title, sub: ep.date + (ep.dur ? ' · ' + ep.dur : ''), right: 'Afspelen', onclick: function () {
          play([{ id: 'pod' + U.hash(ep.url), kind: 'vod', title: ep.title, sub: state.pod.name, url: ep.url }], 0);
        } }));
      });
      if (!(state.pod.items || []).length) raw.appendChild(h('div', { class: 'msg', text: state.pod.loading ? 'Laden…' : 'Geen afleveringen gevonden.' }));
    }
    return vSplit({ menu: menu, title: state.pod ? state.pod.name : 'Podcasts', cards: [], raw: raw, empty: '' });
  }

  async function openPod(pd) {
    state.pod = { name: pd.name, url: pd.url, items: [], loading: true };
    render();
    try {
      const doc = new DOMParser().parseFromString(await fetchText(pd.url, 1800), 'text/xml');
      const t = doc.querySelector('channel > title');
      if (t) state.pod.name = t.textContent.trim();
      state.pod.items = Array.prototype.slice.call(doc.querySelectorAll('item')).slice(0, 60).map(function (it) {
        const en = it.querySelector('enclosure');
        const du = it.getElementsByTagName('itunes:duration')[0];
        const dt = it.querySelector('pubDate');
        return { title: ((it.querySelector('title') || {}).textContent || '').trim(), url: en ? en.getAttribute('url') : '', date: dt ? new Date(dt.textContent).toLocaleDateString('nl-NL') : '', dur: du ? du.textContent.trim() : '' };
      }).filter(function (e) { return e.url; });
    } catch (e) { toast('Podcast laden mislukt'); }
    state.pod.loading = false;
    render(true);
  }

  function vRadio() {
    if (!state.lib) return vHome();
    const all = vis('live').filter(isRadio);
    const g = state.group.radio || '';
    const list = g && g !== '__pod' ? all.filter(function (c) { return c.group === g; }) : all;
    const counts = {};
    all.forEach(function (c) { counts[c.group] = (counts[c.group] || 0) + 1; });
    const menu = [{ key: '__pod', label: '🎙 Podcasts', on: g === '__pod', run: function () { state.group.radio = '__pod'; state.pod = null; render(); } },
      { key: '', label: 'Alle radio', count: all.length, on: !g, run: function () { state.group.radio = ''; state.shown.radio = PAGE; render(); } }];
    if (g === '__pod') return vPodcasts(menu);
    groupsOf(all).forEach(function (x) { menu.push({ key: x, label: x, count: counts[x], on: x === g, run: function () { state.group.radio = x; state.shown.radio = PAGE; render(); } }); });
    const n = state.shown.radio || PAGE;
    setHero({ title: '', key: 'luma' });
    return vSplit({ menu: menu, title: g || 'Radio', cards: list.slice(0, n).map(function (c, i) { return liveCard(c, list, i); }), empty: 'Geen radiozenders gevonden (categorieën met "radio" in de naam).', moreBtn: more('radio', list.length, function () { render(true); }) });
  }

  const GENRES = { 'Film': 1, 'Serie': 2, 'Sport': 3, 'Nieuws': 4, 'Kids': 5, 'Documentaire': 6, 'Muziek': 7 };
  function catOf(c) {
    const s = fold(c);
    if (/movie|film|spiel/.test(s)) return 'Film';
    if (/serie|drama|soap|comed/.test(s)) return 'Serie';
    if (/sport|voetbal|football|soccer/.test(s)) return 'Sport';
    if (/news|nieuws|actual/.test(s)) return 'Nieuws';
    if (/kid|child|jeugd|cartoon|anim/.test(s)) return 'Kids';
    if (/doc|natuur|nature|histor/.test(s)) return 'Documentaire';
    if (/music|muziek|concert/.test(s)) return 'Muziek';
    return '';
  }

  function groupLabel(g) { return g === '__fav' ? '★ Favorieten' : g === '__sport' ? '⚽ Sport' : g === '__zap' ? '⚡ Zapplijst' : g || 'Alle zenders'; }

  /** True when a programme title looks like something from your list or recent history. */
  function favTitle(title) {
    if (!favTitle.set || favTitle.rev !== state.rev) {
      favTitle.rev = state.rev;
      favTitle.set = store.listItems().map(function (x) { return fold(x.name); }).concat(store.historyList(40).map(function (x) { return fold(x.sub ? x.title : x.title); })).filter(function (x) { return x.length >= 4; });
    }
    const t = fold(title);
    return t.length >= 4 && favTitle.set.some(function (x) { return t === x || t.indexOf(x) >= 0; });
  }

  // ---------- sport hub ----------
  const SPORT_DEFS = [
    ['Voetbal', /voetbal|football|soccer|eredivisie|keuken kampioen|premier league|champions league|europa league|conference league|la liga|bundesliga|serie a|ligue 1|jupiler|knvb|nations league|wk kwalificatie|ek kwalificatie/],
    ['Motorsport', /formule 1|formula 1|formule1|\bf1\b|grand prix|motogp|moto gp|moto2|superbike|rally|dakar|formule e/],
    ['Tennis', /tennis|\batp\b|\bwta\b|roland garros|wimbledon|australian open|us open/],
    ['Wielrennen', /wielren|tour de france|giro d|vuelta|cycling|ronde van|amstel gold|parijs roubaix|veldrijden|\buci\b/],
    ['Darts', /darts|\bpdc\b/],
    ['Vechtsport', /\bufc\b|\bmma\b|boksen|boxing|kickbox|wrestling|\bwwe\b/]
  ];
  const SPORT_OTHER = /basketbal|\bnba\b|\bnfl\b|golf|hockey|schaatsen|skien|biatlon|atletiek|volleybal|handbal|rugby|zwemmen|turnen|paardensport|snooker|honkbal|\bmlb\b|\bnhl\b|sport/;
  const SPORT_COL = { Voetbal: '#2e9b4f', Motorsport: '#d63a2f', Tennis: '#a6b92e', Wielrennen: '#2f7fd6', Darts: '#8a4fd0', Vechtsport: '#c2561d', Overig: '#6b7280' };
  const SPORT_ICO = { Voetbal: '⚽', Motorsport: '🏎', Tennis: '🎾', Wielrennen: '🚴', Darts: '🎯', Vechtsport: '🥊', Overig: '🏅' };
  const DAYN = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

  /** Splits "Eredivisie: Ajax - PSV" into teams and competition; null when the title is not a match. */
  function parseMatch(title) {
    const t = String(title || '').trim();
    let comp = '';
    let rest = t;
    const ci = t.indexOf(':');
    if (ci > 0 && ci < 34) { comp = t.slice(0, ci).trim(); rest = t.slice(ci + 1).trim(); }
    const re = /^(.{2,32}?)\s+(?:-|–|—|vs\.?|v|tegen)\s+(.{2,32})$/i;
    const strip = function (s) { return s.replace(/\s*[(\[].*$/, '').trim(); };
    const m = strip(rest).match(re);
    if (m) return { a: m[1].trim(), b: m[2].trim(), comp: comp };
    const m2 = comp ? strip(t).match(re) : null;
    return m2 ? { a: m2[1].trim(), b: m2[2].trim(), comp: '' } : null;
  }

  const SPORT_QUICK = new RegExp(SPORT_DEFS.map(function (d) { return d[1].source; }).join('|') + '|sport');
  const SPORT_CHAN = /sport|espn|eurosport|viaplay|dazn/;

  /** Which sport a programme belongs to, or '' when it is not sport. tl is the lowercase title and genre. */
  function sportOf(flagged, p, tl) {
    for (let i = 0; i < SPORT_DEFS.length; i++) if (SPORT_DEFS[i][1].test(tl)) return SPORT_DEFS[i][0];
    if (p.cat && /sport|voetbal|football|soccer/.test(String(p.cat).toLowerCase())) return 'Overig';
    if (flagged && p.stop - p.start >= 45 * 60000) return 'Overig';
    return '';
  }

  /**
   * All sport programmes from 24 hours ago to a week ahead, sorted by start.
   * Built in small slices in the background so a large source never freezes the screen;
   * until the first build is ready the list is empty.
   */
  const sportBuild = { key: '', list: [], busy: false };
  function sportList() {
    if (!state.lib || !state.epg || !state.epg.size) return sportBuild.list;
    const key = state.epg.size + '|' + state.lib.live.length + '|' + Math.floor(Date.now() / 600000);
    if (sportBuild.key !== key && !sportBuild.busy) startSportBuild(key);
    return sportBuild.list;
  }

  function startSportBuild(key) {
    sportBuild.busy = true;
    sportBuild.key = key;
    const chans = vis('live');
    const now = Date.now();
    const lo = now - 86400000;
    const hi = now + 7 * 86400000;
    const out = [];
    const seen = {};
    let i = 0;
    const step = function () {
      try {
        const t0 = Date.now();
        while (i < chans.length && i < 4000 && Date.now() - t0 < 20) {
          const c = chans[i++];
          if (isRadio(c)) continue;
          const pr = state.epg.forChannel(c);
          if (!pr.length) continue;
          const flagged = !!store.chan(c.id).sport || SPORT_CHAN.test((c.group || '').toLowerCase() + ' ' + (c.name || '').toLowerCase());
          for (let j = 0; j < pr.length; j++) {
            const p = pr[j];
            if (p.stop < lo || p.start > hi) continue;
            const tl = (p.title + ' ' + (p.cat || '')).toLowerCase();
            if (!flagged && !SPORT_QUICK.test(tl)) continue;
            const sp = sportOf(flagged, p, tl);
            if (!sp) continue;
            const dk = tl + '|' + p.start;
            if (seen[dk]) continue;
            seen[dk] = 1;
            const pm = sp === 'Motorsport' || sp === 'Wielrennen' ? null : parseMatch(p.title);
            out.push({ c: c, p: p, sport: sp, teams: pm ? [pm.a, pm.b] : null, comp: pm ? pm.comp : '' });
          }
        }
        if (i < chans.length && i < 4000) { setTimeout(step, 40); return; }
        out.sort(function (x, y) { return x.p.start - y.p.start; });
        const hadAny = sportBuild.list.length > 0;
        sportBuild.list = out;
        sportBuild.busy = false;
        if (state.view === 'sport' && !modalOpen()) render(true);
        else if (state.view === 'home' && !intro.done && !modalOpen()) render(true);
        else if (!hadAny && out.length) buildNav();
        introDone();
      } catch (e) {
        sportBuild.busy = false;
        introDone();
        if (window.console) console.error('sport', e);
      }
    };
    setTimeout(step, intro.done ? 1500 : 30);
  }

  function myTeams() {
    const raw = store.ui('myteams', '[]');
    if (myTeams.raw !== raw) { myTeams.raw = raw; try { myTeams.val = JSON.parse(raw); } catch (e) { myTeams.val = []; } }
    return myTeams.val.slice();
  }
  function isMine(e) {
    const m = myTeams();
    if (!m.length) return false;
    if (m.indexOf('s:' + e.sport) >= 0) return true;
    if (e.teams) return e.teams.some(function (t) { return m.indexOf('t:' + fold(t)) >= 0; });
    return false;
  }
  function sameDay(ms) { return new Date(ms).toDateString() === new Date().toDateString(); }

  function matchCard(e, tag, big) {
    const now = Date.now();
    const live = e.p.start <= now && e.p.stop > now;
    const ended = e.p.stop <= now;
    const when = live ? 'LIVE' : (sameDay(e.p.start) ? '' : DAYN[new Date(e.p.start).getDay()] + ' ') + U.clock(e.p.start);
    const title = e.teams ? e.teams[0] + ' – ' + e.teams[1] : e.p.title;
    const sub = [e.comp || e.sport, e.c.name].filter(Boolean).join(' · ');
    const kids = [
      h('div', { class: 'mw' }, [h('div', { class: 'mwt', text: ended ? 'Gemist' : when })]),
      h('div', { class: 'mb' }, [h('div', { class: 'mn', text: (isMine(e) ? '★ ' : '') + title }), h('div', { class: 'ms', text: sub })]),
      h('div', { class: 'ml', style: { backgroundImage: e.c.logo ? art(e.c.logo) : 'none' } }, e.c.logo ? [] : [h('span', { text: e.c.name.trim().slice(0, 2).toUpperCase() })])
    ];
    if (live) kids.push(h('div', { class: 'bar' }, [h('i', { style: { width: Math.round(100 * (now - e.p.start) / (e.p.stop - e.p.start)) + '%' } })]));
    const b = h('button', { class: 'mcard' + (big ? ' big' : '') + (live ? ' islive' : '') + (ended ? ' ended' : ''), type: 'button', 'data-k': 'm' + (tag || '') + '|' + e.c.id + '|' + e.p.start, onclick: function () {
      if (live) { const l = vis('live'); return play(l, l.indexOf(e.c)); }
      if (ended && e.c.archive) return playCatchup(e.c, e.p);
      progMenu(e.c, e.p, false);
    }}, kids);
    b.style.setProperty('--sc', SPORT_COL[e.sport] || SPORT_COL.Overig);
    b._lp = function () { progMenu(e.c, e.p, live); };
    b._info = { title: title, sub: sub, desc: (e.p.desc || '').slice(0, 280), logo: e.c.logo, photo: '', backdrop: '', kind: 'live', tag: e.sport.toUpperCase(), key: e.sport, hint: live ? 'OK = kijken' : 'OK = herinnering of opnemen', name: '' };
    return b;
  }

  /** A match of your teams (or one with a reminder) that starts within ten minutes. */
  function sportSoon() {
    const now = Date.now();
    const list = sportList();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.p.start > now && e.p.start - now <= 10 * 60000 && (isMine(e) || store.hasReminder(e.c.id, e.p.start)) && !(state.sportOff || {})[e.c.id + e.p.start]) return e;
    }
    return null;
  }
  function sportBanner() {
    const e = sportSoon();
    if (!e) return null;
    const min = Math.max(1, Math.round((e.p.start - Date.now()) / 60000));
    const t = e.teams ? e.teams[0] + ' – ' + e.teams[1] : e.p.title;
    return h('div', { class: 'upd sbar' }, [
      h('span', { class: 'sbt', text: SPORT_ICO[e.sport] + ' ' + t + ' begint over ' + min + ' min op ' + e.c.name }),
      btn('Naar zender', function () { const l = vis('live'); play(l, l.indexOf(e.c)); }),
      btn('Later', function () { (state.sportOff = state.sportOff || {})[e.c.id + e.p.start] = 1; render(true); }, 'btn sec')
    ]);
  }

  function checkSport() {
    if (!state.lib || modalOpen()) return;
    const now = Date.now();
    const list = sportList();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.p.start <= now || e.p.start - now > 10 * 60000 || !isMine(e)) continue;
      const k = 's' + e.c.id + '|' + e.p.start;
      if (alerted[k]) continue;
      alerted[k] = 1;
      chime();
      openModal(h('div', { class: 'dlg' }, [
        h('h2', { text: (e.teams ? e.teams[0] + ' – ' + e.teams[1] : e.p.title) }),
        h('div', { class: 'sub', text: e.sport + ' · ' + e.c.name + ' · begint om ' + U.clock(e.p.start) }),
        h('div', { class: 'btns' }, [btn('Nu kijken', function () { closeModal(); const l = vis('live'); play(l, l.indexOf(e.c)); }), btn('Later', closeModal, 'btn sec')])
      ]));
      return;
    }
  }
  setInterval(checkSport, 60000);

  function teamsMenu() {
    const mine = myTeams();
    const list = sportList();
    const teams = {};
    const sports = {};
    list.forEach(function (e) { sports[e.sport] = 1; if (e.teams) { teams[e.teams[0]] = 1; teams[e.teams[1]] = 1; } });
    const flip = function (k) { const a = myTeams(); const i = a.indexOf(k); if (i >= 0) a.splice(i, 1); else a.push(k); setUi('myteams', JSON.stringify(a)); return i < 0; };
    const mk = function (label, k) {
      const b = row({ title: label, right: mine.indexOf(k) >= 0 ? '✓' : '○', onclick: function () { b.querySelector('.sub').textContent = flip(k) ? '✓' : '○'; } });
      return b;
    };
    const items = Object.keys(sports).sort().map(function (s) { return mk(SPORT_ICO[s] + ' Alle ' + s.toLowerCase(), 's:' + s); })
      .concat(Object.keys(teams).sort().slice(0, 80).map(function (t) { return mk(t, 't:' + fold(t)); }));
    openModal(h('div', { class: 'dlg', style: { minWidth: '90rem' } }, [
      h('h2', { text: 'Mijn teams en sporten' }),
      h('div', { class: 'sub', text: 'Je krijgt een melding 10 minuten voor de aftrap en een rij Jouw wedstrijden.' }),
      h('div', { class: 'list', style: { maxHeight: '60rem', overflow: 'auto', padding: '0.6rem' } }, items.length ? items : [h('div', { class: 'msg', text: 'Nog geen wedstrijden in de gids gevonden.' })]),
      btn('Klaar', function () { closeModal(); render(true); })
    ]));
  }

  function vSport() {
    const root = h('div', { class: 'page sportpg' });
    const all = sportList();
    const now = Date.now();
    root.appendChild(h('h1', { class: 'ph', text: state.sport ? SPORT_ICO[state.sport] + ' ' + state.sport : 'Sport' }));
    const bn = sportBanner();
    if (bn) root.appendChild(bn);
    if (!all.length) {
      root.appendChild(h('div', { class: 'msg', text: 'Geen sport in de gids gevonden. Laad een gids en markeer zenders als sportzender (houd OK ingedrukt op een zender).' }));
      setHero({ title: '', key: 'luma' });
      return root;
    }
    // 1. sport tiles
    const counts = {};
    all.forEach(function (e) { const o = counts[e.sport] || (counts[e.sport] = { n: 0, live: 0 }); if (e.p.stop > now) o.n++; if (e.p.start <= now && e.p.stop > now) o.live++; });
    const names = Object.keys(counts).sort(function (a, b) { return (counts[b].live - counts[a].live) || (counts[b].n - counts[a].n); });
    const tile = function (key, label, ico, col, sub) {
      const b = h('button', { class: 'rnd' + (state.sport === key ? ' sel' : ''), type: 'button', 'data-k': 'st|' + key, onclick: function () { state.sport = key; state.sportDay = 0; state.shown.sp = 0; render(); const f = document.querySelector('.rnd.sel'); if (f) f.focus({ preventScroll: true }); } }, [
        h('div', { class: 'rc', style: { backgroundImage: 'linear-gradient(135deg,' + col + ',#14151b)', backgroundSize: 'cover' } }, [h('span', { text: ico })]),
        h('div', { class: 'rl', text: label }), h('div', { class: 'rs', text: sub })]);
      b._info = { title: label, sub: sub, desc: '', logo: '', photo: '', backdrop: '', kind: 'live', tag: 'SPORT', key: key || 'sport', hint: '', name: '' };
      return b;
    };
    const tiles = [tile('', 'Alles', '🏆', '#e8731a', all.filter(function (e) { return e.p.start <= now && e.p.stop > now; }).length + ' live')]
      .concat(names.map(function (s) { return tile(s, s, SPORT_ICO[s], SPORT_COL[s], counts[s].live ? counts[s].live + ' live' : counts[s].n + ' gepland'); }));
    root.appendChild(h('div', { class: 'rail sporttiles' }, tiles));

    const sel = state.sport ? all.filter(function (e) { return e.sport === state.sport; }) : all;
    const upcoming = sel.filter(function (e) { return e.p.stop > now; });
    const liveNow = upcoming.filter(function (e) { return e.p.start <= now; });
    // 9. featured match
    const mineUp = upcoming.filter(isMine);
    const feat = mineUp.filter(function (e) { return e.p.start <= now; })[0] || liveNow[0] || mineUp[0] || upcoming[0];
    if (feat) root.appendChild(h('div', { class: 'feat sportfeat' }, [matchCard(feat, 'f', true)]));
    // 5. your matches
    const mine = mineUp.filter(function (e) { return e !== feat; }).slice(0, 10);
    if (mine.length) root.appendChild(shelf('Jouw wedstrijden', mine.map(function (e) { return matchCard(e, 'j'); })));
    else if (!myTeams().length) root.appendChild(h('div', { class: 'rowbtn' }, [btn('★ Kies je teams en sporten', teamsMenu, 'btn sec')]));
    // 2. live now
    const lv = liveNow.filter(function (e) { return e !== feat; }).slice(0, 12);
    if (lv.length) root.appendChild(shelf('Nu live', lv.map(function (e) { return matchCard(e, 'l'); })));
    // 4 + 3. schedule per day
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const a = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i);
      const b2 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i + 1);
      days.push({ a: a.getTime(), b: b2.getTime(), label: i === 0 ? 'Vandaag' : i === 1 ? 'Morgen' : DAYN[a.getDay()] + ' ' + a.getDate() });
    }
    const di = Math.min(state.sportDay || 0, 6);
    root.appendChild(h('h2', { class: 'sh2', text: 'Programma' }));
    root.appendChild(h('div', { class: 'chips' }, days.map(function (d, i) {
      return h('button', { class: 'chip' + (i === di ? ' on' : ''), type: 'button', 'data-k': 'sd|' + i, onclick: function () { state.sportDay = i; state.shown.sp = 0; render(true); } }, [d.label]);
    })));
    const dayList = sel.filter(function (e) { return e.p.start < days[di].b && e.p.stop > days[di].a && e.p.stop > now; });
    const n = state.shown.sp || 24;
    const box = h('div', { class: 'mlist' }, dayList.slice(0, n).map(function (e) { return matchCard(e, 'd'); }));
    if (!dayList.length) box.appendChild(h('div', { class: 'msg', text: 'Geen sport gevonden voor ' + days[di].label.toLowerCase() + '.' }));
    root.appendChild(box);
    if (dayList.length > n) root.appendChild(btn('Meer wedstrijden (' + (dayList.length - n) + ')', function () { state.shown.sp = n + 24; render(true); }, 'btn sec'));
    // 7. missed
    const missed = sel.filter(function (e) { return e.p.stop <= now && e.c.archive; }).reverse().slice(0, 10);
    const recs = sportRecs();
    if (missed.length || recs.length) {
      root.appendChild(shelf('Gemist en opnames', recs.map(function (r) {
        const b = card({ kind: 'live', wide: true, title: r.title, tag: 'OPNAME', sub: new Date(r.time).toLocaleDateString('nl-NL', { weekday: 'short' }) + ' · ' + fmtSize(r.size), onclick: function () { playRec(r); } });
        return b;
      }).concat(missed.map(function (e) { return matchCard(e, 'g'); }))));
    }
    root.appendChild(h('div', { class: 'rowbtn' }, [btn('★ Mijn teams en sporten', teamsMenu, 'btn sec'), state.sport ? btn('Alle sporten', function () { state.sport = ''; render(); }, 'btn sec') : null]));
    const first = feat || upcoming[0];
    setHero(first ? { title: '', key: first.sport } : { title: '', key: 'luma' });
    return root;
  }

  function sportRecs() {
    if (!native || !native.recordings) return [];
    let list = [];
    try { list = JSON.parse(native.recordings()); } catch (e) { return []; }
    const all = SPORT_DEFS.map(function (d) { return d[1]; }).concat([SPORT_OTHER]);
    return list.filter(function (r) { return Date.now() - r.time < 7 * 86400000; }).map(function (r) {
      return { name: r.name, path: r.path, time: r.time, size: r.size, title: r.name.replace(/_\d{8}_\d{4}\.ts$/, '').replace(/_/g, ' ') };
    }).filter(function (r) { const s = fold(r.title); return all.some(function (re) { return re.test(s); }); }).reverse().slice(0, 8);
  }
  function playRec(r) {
    if (!native) return;
    const id = 'rec:' + r.name;
    state.playMeta[id] = { id: id, kind: 'vod', title: r.title, name: r.title, url: 'file://' + r.path };
    native.play(JSON.stringify({ id: id, title: r.title, url: 'file://' + r.path, live: false, position: 0, accent: accent(), seekBack: +store.ui('seekBack', '10') * 1000, seekFwd: +store.ui('seekFwd', '30') * 1000, overlayMs: +store.ui('overlay', '5') * 1000, autoNext: false, skipMs: 85000 }));
  }

  function vNowNext() {
    const all = vis('live');
    const g = state.group.guide;
    const cats = [['', 'Alle zenders']].concat(store.favs().length ? [['__fav', '★ Favorieten']] : []).concat(groupsOf(all).map(function (x) { return [x, x]; }));
    const list = g === '__fav' ? all.filter(function (c) { return store.isFav(c.id); }) : g ? all.filter(function (c) { return c.group === g; }) : all;
    const root = h('div', { class: 'live3 nn' });
    const left = h('div', { class: 'lcol cats' }, [h('button', { class: 'lcat act', type: 'button', 'data-k': 'cat|__grid', onclick: function () { state.guideMode = ''; render(); } }, [h('span', { class: 'nm', text: '▦ Tijdrooster' })])]);
    cats.forEach(function (c) {
      left.appendChild(h('button', { class: 'lcat' + (c[0] === g ? ' on' : ''), type: 'button', 'data-k': 'cat|' + c[0], onclick: function () { state.group.guide = c[0]; state.shown.nn = 0; render(); const f = document.querySelector('.nnrow'); if (f) f.focus({ preventScroll: true }); } }, [h('span', { class: 'nm', text: c[1] })]));
    });
    root.appendChild(left);
    const right = h('div', { class: 'lcol items' }, [h('h1', { class: 'sh', text: 'Nu en straks' })]);
    const n = state.shown.nn || 30;
    list.slice(0, n).forEach(function (c, i) {
      const nn = nowInfo(c);
      const cell = function (p, label) {
        if (!p) return h('div', { class: 'nncell dim' }, [h('div', { class: 'nt', text: label === 'now' ? 'Geen informatie' : '' })]);
        return h('div', { class: 'nncell' }, [h('div', { class: 'nt', text: p.title }), h('div', { class: 'ntm', text: U.clock(p.start) + ' – ' + U.clock(p.stop) }), p.desc ? h('div', { class: 'nd', text: p.desc.slice(0, 110) }) : null]);
      };
      const b = h('button', { class: 'nnrow', type: 'button', 'data-k': 'nn|' + c.id, onclick: function () { play(list, i); } }, [
        h('div', { class: 'nlogo', style: { backgroundImage: c.logo ? art(c.logo) + ',' + tint(c.name) : tint(c.name) } }, c.logo ? [] : [h('span', { text: c.name.trim().slice(0, 2).toUpperCase() })]),
        cell(nn.now, 'now'), cell(nn.next, 'next')]);
      b._lp = function () { channelMenu(c); };
      right.appendChild(b);
    });
    if (list.length > n) right.appendChild(btn('Meer zenders (' + (list.length - n) + ')', function () { state.shown.nn = n + 30; render(true); }, 'btn sec'));
    if (!list.length) right.appendChild(h('div', { class: 'msg', text: 'Geen zenders in deze groep.' }));
    root.appendChild(right);
    setHero({ title: '', key: 'luma' });
    return root;
  }

  function vGuide() {
    if (!state.lib) return vHome();
    if (state.guideMode === 'nn') return vNowNext();
    const root = h('div');
    const all = vis('live');
    const g = state.group.guide;
    let list = g === '__fav' ? all.filter(function (c) { return store.isFav(c.id); }) : g ? all.filter(function (c) { return c.group === g; }) : all;
    const hasEpg = state.epg && state.epg.size;
    if (hasEpg) list = list.filter(function (c) { return state.epg.forChannel(c).length; });
    const hours = +store.ui('hours', '6');
    const now = Date.now();
    const q = fold(state.guideQ);
    const cat = state.guideCat;
    if (hasEpg && (q || cat)) {
      list = list.filter(function (c) {
        return state.epg.forChannel(c).some(function (p) { return (!cat || (p.cat && catOf(p.cat) === cat)) && (!q || matches(p.title, q)); });
      });
    }
    let t0 = Math.floor((now - 30 * 60000) / 1800000) * 1800000;
    if (state.guideStart) t0 = state.guideStart;
    else if (state.guideDay > 0) { const d = new Date(now); d.setHours(0, 0, 0, 0); t0 = d.getTime() + state.guideDay * 86400000; }
    const t1 = t0 + hours * 3600000;
    const total = GNAME + (t1 - t0) / 60000 * GPX;
    const px = function (t) { return GNAME + (Math.max(t0, Math.min(t1, t)) - t0) / 60000 * GPX; };

    const tools = h('div', { class: 'gtools' }, [
      btn(state.guideDay === 0 ? (state.guideStart ? 'Vanavond' : 'Vandaag') : ['', 'Morgen', 'Overmorgen'][state.guideDay], function () {
        pickList('Dag', [['0', 'Nu'], ['tonight', 'Vanavond 20:00'], ['1', 'Morgen'], ['2', 'Overmorgen']], '', function (v) {
          state.guideStart = 0;
          if (v === 'tonight') { const d = new Date(); d.setHours(20, 0, 0, 0); if (d.getTime() < Date.now()) d.setTime(Date.now()); state.guideDay = 0; state.guideStart = d.getTime(); }
          else state.guideDay = +v;
          render();
        });
      }, 'chip'),
      btn(state.guideCat ? 'Genre: ' + state.guideCat : 'Alle genres', function () {
        pickList('Genre', [['', 'Alle genres']].concat(Object.keys(GENRES).map(function (k) { return [k, k]; })), state.guideCat, function (v) { state.guideCat = v; render(); });
      }, 'chip'),
      btn('Nu / Straks', function () { state.guideMode = 'nn'; render(); }, 'chip'),
      btn('Sport', function () {
        pickList('Sportagenda', [['', 'Alles tonen'], ['voetbal', 'Voetbal'], ['eredivisie', 'Eredivisie'], ['champions league', 'Champions League'], ['formule 1', 'Formule 1'], ['tennis', 'Tennis'], ['darts', 'Darts'], ['wielrennen', 'Wielrennen'], ['basketbal', 'Basketbal'], ['schaatsen', 'Schaatsen']], state.guideQ, function (v) { state.guideQ = v; render(); });
      }, 'chip'),
      btn(state.guideQ ? 'Zoek: ' + state.guideQ : 'Zoek programma', function () {
        textDialog('Zoek in de gids', state.guideQ, function (t) { state.guideQ = t; render(); });
      }, 'chip')
    ]);
    root.appendChild(tools);
    const inner = h('div', { class: 'ginner', style: { width: total + 'rem' } });
    const head = h('div', { class: 'gh' }, [h('div', { class: 'gcorner' }, [
      btn(groupLabel(g) + ' ▾', function () {
        const groups = [['', 'Alle zenders']].concat(store.favs().length ? [['__fav', '★ Favorieten']] : []).concat(groupsOf(all).map(function (x) { return [x, x]; }));
        pickList('Categorie', groups, g, function (v) { state.group.guide = v; state.shown.guide = 24; render(); });
      }, 'chip')
    ])]);
    for (let t = t0; t < t1; t += 1800000) head.appendChild(h('div', { class: 'tk', style: { left: px(t) + 'rem' }, text: U.clock(t) }));
    inner.appendChild(head);

    const n = state.shown.guide || 24;
    list.slice(0, n).forEach(function (c, i) {
      const r = h('div', { class: 'gr', style: { width: total + 'rem' } });
      const nm = h('button', { class: 'gname', type: 'button', 'data-k': c.id, onclick: function () { play(list, i); } }, [
        h('span', { class: 'no', text: c.no || '' }), h('span', { class: 'nm', text: c.name }), store.isFav(c.id) ? h('span', { text: '★' }) : null
      ]);
      const nn = nowInfo(c);
      nm._lp = function () { toggleFav(c); };
      nm._ginfo = { ch: c, p: nn.now || nn.next, isNow: !!nn.now };
      r.appendChild(nm);
      (hasEpg ? state.epg.forChannel(c) : []).forEach(function (p) {
        if (p.stop <= t0 || p.start >= t1) return;
        const left = px(p.start);
        const w = px(p.stop) - left - 0.4;
        if (w < 3) return;
        const isNow = p.start <= now && now < p.stop;
        const gk = p.cat ? catOf(p.cat) : '';
        const rem = store.hasReminder(c.id, p.start);
        const star = favTitle(p.title);
        const b = h('button', { class: 'gp' + (isNow ? ' now' : '') + (gk ? ' g-' + GENRES[gk] : ''), type: 'button', 'data-k': c.id + '|' + p.start, style: { left: left + 'rem', width: w + 'rem', opacity: p.stop <= now ? '0.55' : '1', backgroundImage: p.img && on('gposters') ? 'linear-gradient(rgba(10,10,14,0.62),rgba(10,10,14,0.62)), ' + art(p.img) : '', backgroundSize: 'cover', backgroundPosition: 'center' },
          onclick: function () {
            if (p.stop <= now && c.archive && state.source && state.source.type === 'xtream') return playCatchup(c, p);
            if (p.start <= now) return play(list, i);
            const set = store.toggleReminder({ chId: c.id, chName: c.name, title: p.title, start: p.start });
            toast(set ? '🔔 Herinnering om ' + U.clock(p.start) + ': ' + p.title : 'Herinnering verwijderd');
            render(true);
          } }, [rem ? h('span', { text: '🔔' }) : null, star ? h('span', { text: '★ ' }) : null, isRepeat(c, p) ? h('span', { text: '↻ ', title: 'Herhaling' }) : null, h('span', { text: p.title })]);
        b._ginfo = { ch: c, p: p, isNow: isNow };
        if (p.stop > now || c.archive) b._lp = function () { progMenu(c, p, isNow); };
        r.appendChild(b);
      });
      inner.appendChild(r);
    });
    const nl = h('div', { class: 'nowline', style: { left: px(now) + 'rem' } });
    inner.appendChild(nl);
    const scroll = h('div', { class: 'gscroll' }, [inner]);
    root.appendChild(h('div', { class: 'gwrap' }, [scroll]));
    root.appendChild(h('div', { class: 'ginfo', id: 'ginfo' }, [h('h3', { id: 'gi-t' }), h('p', { id: 'gi-d' })]));
    if (!list.length) {
      scroll.appendChild(h('div', { class: 'msg', style: { margin: '4rem 0' }, text: hasEpg ? 'Geen gidsgegevens voor deze categorie.' : 'De gids wordt geladen, of is niet ingesteld (zie Instellingen → Bronnen).' }));
    }
    if (list.length > n) {
      scroll.appendChild(h('div', { style: { padding: '2rem 0', position: 'sticky', left: '0', width: '60rem' } }, [btn('Meer zenders (' + (list.length - n) + ')', function () { state.shown.guide = n + 24; render(true); }, 'btn sec')]));
    }
    setHero({ title: '', key: 'luma' });
    return root;
  }

  function guideInfo(g) {
    const t = $('gi-t');
    const d = $('gi-d');
    if (!t || !g) return;
    const p = g.p;
    t.textContent = '';
    if (!p) {
      t.textContent = g.ch.name;
      d.textContent = 'Geen gidsgegevens. Druk op OK om te kijken. OK ingedrukt houden = favoriet.';
      return;
    }
    t.appendChild(document.createTextNode(p.title));
    const when = U.clock(p.start) + '–' + U.clock(p.stop) + ' · ' + Math.round((p.stop - p.start) / 60000) + ' min · ' + g.ch.name;
    t.appendChild(h('span', { class: 'when', text: (g.isNow ? 'NU · ' : '') + when }));
    const future = p.start > Date.now();
    const mins = Math.round(((future ? p.start : p.stop) - Date.now()) / 60000);
    t.appendChild(h('span', { class: 'when', text: future ? 'begint over ' + (mins >= 60 ? Math.floor(mins / 60) + 'u ' + (mins % 60) + 'm' : mins + ' min') : 'nog ' + mins + ' min' }));
    const gi = $('ginfo');
    if (gi) gi.style.backgroundImage = p.img ? 'linear-gradient(90deg, var(--bg) 35%, rgba(var(--bgrgb),.55)), url("' + String(p.img).replace(/"/g, '%22') + '")' : '';
    d.textContent = (p.desc ? p.desc + ' ' : '') + (future ? '— OK = herinnering aan/uit.' : '— OK = kijken · OK ingedrukt houden = favoriet.');
  }

  const SORTS = [['list', 'Volgorde van de lijst'], ['rating', 'Beoordeling (hoogste eerst, waar bekend)'], ['newest', 'Nieuwste eerst (laatst in de lijst)'], ['name', 'Naam A–Z'], ['nameDesc', 'Naam Z–A']];

  function yearOf(it) { return META.cleanTitle(it.name).year || 0; }
  function langOf(it) {
    const m = /^\s*([A-Za-z]{2,3})\s*[:|\-]/.exec(it.name || '') || /^\s*([A-Za-z]{2,3})\s*[:|\-]/.exec(it.group || '');
    return m ? m[1].toUpperCase() : '';
  }
  /** Films that belong together: names that share their first part ("Fast & Furious 2", "Fast & Furious 3"). */
  function colKey(it) {
    return fold(META.cleanTitle(it.name).title.replace(/[:\-–].*$/, '')).replace(/\b(\d+|ii|iii|iv|vi|vii|viii|ix|x)\b/g, '').replace(/\s+/g, ' ').trim();
  }
  function collections(all) {
    const m = {};
    all.forEach(function (it) { const k = colKey(it); if (k.length >= 3) (m[k] = m[k] || []).push(it); });
    return Object.keys(m).filter(function (k) { return m[k].length >= 3; }).map(function (k) { return [k, m[k][0].name.replace(/[:\-–].*$/, '').replace(/\s+\d+$/, '').trim() + ' (' + m[k].length + ')']; }).sort(function (a, b) { return a[1].localeCompare(b[1]); });
  }

  let ratingBusy = false;
  function ratingOf(it) { const m = metaCache.get(META.keyOf(it.kind === 'series' ? 'series' : 'vod', it.name)); return m && m.rating ? m.rating : 0; }
  function prefetchRatings(list) {
    if (ratingBusy || !store.pref('tmdb')) return;
    const todo = list.filter(function (it) { return metaCache.get(META.keyOf(it.kind === 'series' ? 'series' : 'vod', it.name)) === undefined; }).slice(0, 60);
    if (!todo.length) return;
    ratingBusy = true;
    let i = 0;
    const next = function () {
      if (i >= todo.length) { ratingBusy = false; bump(); if (state.view === 'vod' || state.view === 'series') render(true); return; }
      const it = todo[i++];
      metaAsync(it.kind === 'series' ? 'series' : 'vod', it.name).then(next);
    };
    next(); next(); next();
  }

  function vShelf(kind, label, title) {
    if (!state.lib) return vHome();
    const all = vis(kind);
    const g = state.group[kind];
    let list = all;
    if (g === '__list') list = all.filter(function (c) { return store.inList(c.id); });
    else if (g === '__unseen') list = all.filter(function (c) { return !store.isWatched(c.id); });
    else if (g && g.indexOf('__col:') === 0) list = all.filter(function (c) { return colKey(c) === g.slice(6); });
    else if (g) list = all.filter(function (c) { return c.group === g; });
    const yf = (state.yf || {})[kind], lf = (state.lf || {})[kind];
    if (yf) list = list.filter(function (c) { return yf === 'old' ? yearOf(c) && yearOf(c) < 2000 : Math.floor(yearOf(c) / 10) * 10 === +yf; });
    if (lf) list = list.filter(function (c) { return langOf(c) === lf; });
    if (store.ui('vsort', 'list') === 'rating') { prefetchRatings(list); list = list.slice().sort(function (x, y) { return ratingOf(y) - ratingOf(x); }); }
    if (!all.length) {
      const root = h('div', { class: 'page' }, [h('h1', { class: 'ph', text: title }), h('div', { class: 'msg', text: 'Geen ' + label + ' gevonden in deze bron.' })]);
      return root;
    }
    const sortName = (SORTS.filter(function (s) { return s[0] === store.ui('vsort', 'list'); })[0] || SORTS[0])[1];
    const pickG = function (x) { return function () { state.group[kind] = x; state.shown[kind] = PAGE; render(); }; };
    const counts = {};
    all.forEach(function (c) { counts[c.group] = (counts[c.group] || 0) + 1; });
    const menu = [];
    menu.push({ key: '__sort', label: '⇅ ' + sortName.split(' (')[0], action: true, run: function () { pickList('Sorteren', SORTS, store.ui('vsort', 'list'), function (v) { setUi('vsort', v); }); } });
    if (kind === 'vod') menu.push({ key: '__rnd', label: '🎲 Verras me', action: true, run: function () {
      const pool = list.filter(function (c) { return !store.isWatched(c.id); });
      const pickFrom = pool.length ? pool : list;
      if (!pickFrom.length) return;
      const m = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      pickList('Verrassing: ' + m.name, [['play', 'Afspelen'], ['list', 'Toevoegen aan Mijn lijst'], ['again', 'Nog een keer kiezen']], '', function (v) {
        if (v === 'play') playMovie(m);
        else if (v === 'list') { store.toggleList({ id: m.id, kind: 'vod', name: m.name, logo: m.logo, group: m.group }); toast('♥ Toegevoegd aan Mijn lijst'); render(true); }
        else go('vod');
      });
    } });
    const years = {};
    all.forEach(function (c) { const y = yearOf(c); if (y) { const k = y < 2000 ? 'old' : String(Math.floor(y / 10) * 10); years[k] = 1; } });
    if (Object.keys(years).length) menu.push({ key: '__yf', label: '📅 Jaar: ' + (yf ? (yf === 'old' ? 'voor 2000' : yf + 'e') : 'alle'), action: true, run: function () {
      pickList('Jaar', [['', 'Alle jaren']].concat(Object.keys(years).sort().reverse().map(function (k) { return [k, k === 'old' ? 'Voor 2000' : 'De jaren ' + k]; })), yf || '', function (v) { state.yf = state.yf || {}; state.yf[kind] = v; state.shown[kind] = PAGE; render(); });
    } });
    const langs = {};
    all.forEach(function (c) { const l = langOf(c); if (l) langs[l] = 1; });
    if (Object.keys(langs).length) menu.push({ key: '__lf', label: '🌐 Taal: ' + (lf || 'alle'), action: true, run: function () {
      pickList('Taal', [['', 'Alle talen']].concat(Object.keys(langs).sort().map(function (k) { return [k, k]; })), lf || '', function (v) { state.lf = state.lf || {}; state.lf[kind] = v; state.shown[kind] = PAGE; render(); });
    } });
    if (kind === 'vod') {
      const cols = collections(all);
      if (cols.length) menu.push({ key: '__col', label: '🎞 Verzamelingen', action: true, run: function () { pickList('Verzamelingen', cols, '', function (v) { state.group.vod = '__col:' + v; state.shown.vod = PAGE; render(); }); } });
    }
    menu.push({ key: '', label: 'Alles', count: all.length, on: !g, run: pickG('') });
    menu.push({ key: '__list', label: '♥ Mijn lijst', count: all.filter(function (c) { return store.inList(c.id); }).length, on: g === '__list', run: pickG('__list') });
    menu.push({ key: '__unseen', label: 'Nog niet gezien', on: g === '__unseen', run: pickG('__unseen') });
    groupsOf(all).forEach(function (x) { menu.push({ key: x, label: x, count: counts[x], on: x === g, run: pickG(x) }); });
    if (list.length && g && g.charAt(0) !== '_') {
      menu.push({ key: '__row', label: '📌 Als rij op Voor jou', action: true, run: function () { addCustomRow(kind, g); } });
      if (kind === 'vod') menu.push({ key: '__all', label: '▶ Alles afspelen', action: true, run: function () { play(list.map(function (m) { return Object.assign({ title: m.name }, m); }), 0); } });
    }
    const n = state.shown[kind] || PAGE;
    const cards = list.slice(0, n).map(function (it) {
      const p = kind === 'vod' ? store.getProgress(it.id) : null;
      const c = kind === 'vod' ? movieCard(it) : showCard(it);
      if (p && p.dur) c.firstChild.appendChild(h('div', { class: 'bar' }, [h('i', { style: { width: Math.round(100 * p.pos / p.dur) + '%' } })]));
      return c;
    });
    setHero({ title: '', key: 'luma' });
    let feature = null;
    if (!g && !yf && !lf && all.length >= 3 && store.ui('featured', 'on') !== 'off') {
      const pickIds = [];
      store.historyList(60).forEach(function (e) { if ((kind === 'series') === (e.kind === 'series')) { const id = kind === 'series' ? e.showId : e.id; if (id && pickIds.indexOf(id) < 0) pickIds.push(id); } });
      const byIdAll = {};
      all.forEach(function (x) { byIdAll[x.id] = x; });
      const feats = pickIds.map(function (id) { return byIdAll[id]; }).filter(Boolean).slice(0, 2);
      all.slice(-8).reverse().forEach(function (x) { if (feats.length < 5 && feats.indexOf(x) < 0) feats.push(x); });
      feature = h('div', { class: 'feat' }, feats.map(function (it) {
        const el = card({ kind: kind, wide: true, title: it.name, sub: it.group, logo: it.logo, tag: 'UITGELICHT', metaKind: kind, metaName: it.name, onclick: function () { if (kind === 'series') openShow(it); else playMovie(it); }, lp: function () { titleMenu(it); } });
        return el;
      }));
    }
    return vSplit({ feature: feature, menu: menu, title: g && g.indexOf('__col:') === 0 ? 'Verzameling' : g === '__list' ? 'Mijn lijst' : g === '__unseen' ? 'Nog niet gezien' : g || title, posters: true, cards: cards,
      empty: g === '__list' ? 'Je Mijn lijst is nog leeg: houd OK ingedrukt op een titel.' : 'Niets gevonden.', moreBtn: more(kind, list.length, function () { render(true); }) });
  }

  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Every word of the query must appear (in any order), ignoring accents and punctuation. */
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  /** Like matches(), but forgives one typo per word of four or more letters. */
  function fuzzy(name, q) {
    const words = fold(name).split(' ');
    return q.split(' ').every(function (w) {
      return words.some(function (v) { return v.indexOf(w) === 0 || (w.length >= 4 && lev(w, v.slice(0, w.length)) <= 1); });
    });
  }

  function matches(name, q) {
    const n = fold(name);
    return q.split(' ').every(function (w) { return n.indexOf(w) >= 0; });
  }

  const MOODS = [['grappig', 'Iets grappigs', /comedy|komedie|humor|kluch|grap/i], ['spannend', 'Iets spannends', /thriller|spanning|crime|misdaad|actie|action|horror/i], ['romantisch', 'Iets romantisch', /romanti|romance|drama|liefde/i], ['gezin', 'Voor het hele gezin', /famil|gezin|kids|kinder|animatie|animation|disney/i], ['echt', 'Iets echts', /docu|natuur|history|geschied|true|wetenschap/i], ['onzin', 'Iets fantasierijks', /sci-?fi|fantasy|science|avontuur|adventure/i]];
  function moodMenu() {
    pickList('Waar heb je zin in?', MOODS.map(function (m) { return [m[0], m[1]]; }), '', function (v) {
      const m = MOODS.filter(function (x) { return x[0] === v; })[0];
      const films = groupsOf(vis('vod')).filter(function (g) { return m[2].test(g); });
      const shows = groupsOf(vis('series')).filter(function (g) { return m[2].test(g); });
      const opts = films.map(function (g) { return ['vod|' + g, 'Film: ' + g]; }).concat(shows.map(function (g) { return ['series|' + g, 'Serie: ' + g]; }));
      if (!opts.length) return toast('Geen passende categorie in je bron');
      pickList(m[1], opts, '', function (c) {
        const k = c.split('|')[0], g = c.slice(k.length + 1);
        state.group[k] = g;
        state.shown = {};
        go(k);
      });
    });
  }

  /** Programmes in the guide (now and the coming days) whose title matches. */
  function searchGuide(q) {
    if (!state.epg || !state.epg.size || !state.lib) return [];
    const now = Date.now();
    const out = [];
    const list = vis('live');
    for (let i = 0; i < list.length && i < 4000 && out.length < 15; i++) {
      const c = list[i];
      const pr = state.epg.forChannel(c);
      for (let j = 0; j < pr.length; j++) {
        const p = pr[j];
        if (p.stop < now || !matches(p.title, q)) continue;
        out.push({ c: c, p: p, now: p.start <= now });
        break;
      }
    }
    return out;
  }

  function vSearch() {
    const root = h('div', { class: 'page' });
    root.appendChild(h('h1', { class: 'ph', text: 'Zoeken' }));
    const input = h('input', { type: 'text', value: state.query || '', placeholder: 'Zoek een zender, film of serie…', autocomplete: 'off', autocapitalize: 'off' });
    const out = h('div');
    root.appendChild(h('div', { class: 'chips' }, [h('button', { class: 'chip' + (state.unseenOnly ? ' on' : ''), type: 'button', onclick: function () { state.unseenOnly = !state.unseenOnly; run(); } }, ['Alleen wat ik nog niet zag']),
      h('button', { class: 'chip', type: 'button', onclick: moodMenu }, ['Stemming'])]));
    function run() {
      state.query = input.value;
      out.textContent = '';
      const q = fold(state.query);
      if (!state.lib) { out.appendChild(h('div', { class: 'msg', text: 'Voeg eerst een bron toe bij Instellingen.' })); return; }
      if (!q) {
        const rec = store.searches();
        if (rec.length) {
          out.appendChild(h('h2', { text: 'Recent gezocht' }));
          out.appendChild(h('div', { class: 'chips' }, rec.map(function (t) {
            return btn(t, function () { input.value = t; run(); input.focus({ preventScroll: true }); }, 'chip');
          })));
        }
        return;
      }
      const mk = function (fz) {
        return function (arr) { return arr.filter(function (x) { return (fz ? fuzzy(x.name, q) : matches(x.name + ' ' + (x.group || ''), q)) && !(state.unseenOnly && store.isWatched(x.id)); }).slice(0, 24); };
      };
      let pick = mk(false);
      let live = pick(vis('live'));
      let vod = pick(vis('vod'));
      let ser = pick(vis('series'));
      if (!live.length && !vod.length && !ser.length && q.length >= 4) {
        pick = mk(true);
        live = pick(vis('live')); vod = pick(vis('vod')); ser = pick(vis('series'));
        if (live.length || vod.length || ser.length) out.appendChild(h('div', { class: 'sub', text: 'Bedoel je misschien…' }));
      }
      if (live.length) out.appendChild(shelf('Zenders', live.map(function (c, i) { return liveCard(c, live, i); })));
      if (vod.length) out.appendChild(shelf('Films', vod.map(movieCard)));
      if (ser.length) out.appendChild(shelf('Series', ser.map(showCard)));
      const progHits = q.length >= 3 ? searchGuide(q) : [];
      if (progHits.length) {
        out.appendChild(h('h2', { text: 'In de gids' }));
        progHits.forEach(function (x) {
          out.appendChild(row({ title: x.p.title, sub: x.c.name + ' · ' + new Date(x.p.start).toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' }), right: x.now ? 'Nu' : '›', onclick: function () { progMenu(x.c, x.p, x.now); } }));
        });
      }
      if (!live.length && !vod.length && !ser.length && !progHits.length) out.appendChild(h('div', { class: 'msg', text: 'Niets gevonden voor "' + state.query + '".' }));
    }
    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { store.addSearch(input.value); run(); actorSearch(input.value, out); } });
    root.appendChild(input);
    const keys = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('').concat(['⎵', '⌫']);
    root.appendChild(h('div', { class: 'kbd' }, keys.map(function (k) {
      return h('button', { class: 'key', type: 'button', 'data-k': 'kb|' + k, onclick: function () {
        input.value = k === '⌫' ? input.value.slice(0, -1) : input.value + (k === '⎵' ? ' ' : k);
        run();
      } }, [k]);
    })));
    root.appendChild(h('div', { style: { height: '2rem' } }));
    root.appendChild(out);
    run();
    setHero({ title: '', key: 'luma' });
    return root;
  }

  /** Titles with this actor or director, from TMDB, shown under the normal results. */
  async function actorSearch(text, out) {
    const key = store.pref('tmdb');
    if (!key || fold(text).length < 4 || !state.lib) return;
    try {
      const j = await fetchJson('https://api.themoviedb.org/3/search/person?api_key=' + encodeURIComponent(key) + '&language=' + encodeURIComponent(store.pref('tmdblang') || 'nl-NL') + '&query=' + encodeURIComponent(text), 86400);
      const who = j && j.results && j.results[0];
      if (!who) return;
      const known = (who.known_for || []).map(function (k) { return fold(k.title || k.name || ''); }).filter(Boolean);
      const hit = vis('vod').concat(vis('series')).filter(function (x) { const n = fold(META.cleanTitle(x.name).title); return known.some(function (k) { return n === k; }); }).slice(0, 24);
      if (hit.length) out.appendChild(shelf('Met ' + who.name, hit.map(function (it) { return it.kind === 'series' ? showCard(it) : movieCard(it); })));
    } catch (e) { /* optional */ }
  }

  async function openShow(show) {
    if (!show.episodes) {
      state.loading = 'Afleveringen laden…';
      render();
      try {
        const info = await fetchJson(XT.apiUrl(state.source, 'get_series_info', '&series_id=' + enc(show.xtreamId)), 3600, state.source.ua || '');
        show.episodes = XT.normalizeSeriesInfo(state.source, info);
      } catch (e) {
        state.loading = '';
        toast('Afleveringen laden mislukt');
        render();
        return;
      }
      state.loading = '';
    }
    state.show = show;
    render();
  }

  function follows() { try { return JSON.parse(store.ui('follows', '[]')) || []; } catch (e) { return []; } }

  /** After loading: tells you about new episodes of the series you follow. */
  async function checkFollows() {
    const fol = follows();
    if (!fol.length || !state.lib) return;
    let changed = false;
    const fresh = [];
    for (const f of fol.slice(0, 12)) {
      const show = state.lib.series.find(function (s) { return s.id === f.id; });
      if (!show) continue;
      let n = show.episodes ? show.episodes.length : 0;
      if (!show.episodes && show.xtreamId != null && state.source && state.source.type === 'xtream') {
        try { n = XT.normalizeSeriesInfo(state.source, await fetchJson(XT.apiUrl(state.source, 'get_series_info', '&series_id=' + enc(show.xtreamId)), 21600, state.source.ua || '')).length; } catch (e) { continue; }
      }
      if (n > f.n) { fresh.push(show); f.n = n; changed = true; }
    }
    if (changed) store.setUi('follows', JSON.stringify(fol));
    if (fresh.length) {
      if (modalOpen()) toast('🔔 Nieuwe aflevering van ' + fresh[0].name);
      else openModal(h('div', { class: 'dlg' }, [h('h2', { text: '🔔 Nieuwe aflevering' }), h('div', { class: 'sub', text: fresh.map(function (x) { return x.name; }).join(', ') }),
        h('div', { class: 'btns' }, [btn('Bekijken', function () { closeModal(); openShow(fresh[0]); }), btn('Later', closeModal, 'btn sec')])]));
    }
  }

  /** "Where was I": the summary of the last finished episode, from TMDB. */
  async function recap(show, box) {
    const key = store.pref('tmdb');
    if (!key || !show.episodes) return;
    let last = -1;
    show.episodes.forEach(function (e, i) { if (store.isWatched(e.id) || (store.getProgress(e.id) && store.getProgress(e.id).dur && store.getProgress(e.id).pos / store.getProgress(e.id).dur >= 0.95)) last = i; });
    if (last < 0) return;
    const ep = show.episodes[last];
    try {
      const info = await META.lookup('series', show.name, key, store.pref('tmdblang') || 'nl-NL', function (u) { return fetchJson(u, 86400); });
      if (!info || !info.id) return;
      const j = await fetchJson('https://api.themoviedb.org/3/tv/' + info.id + '/season/' + ep.s + '/episode/' + ep.e + '?api_key=' + encodeURIComponent(key) + '&language=' + encodeURIComponent(store.pref('tmdblang') || 'nl-NL'), 86400);
      if (j && j.overview) box.textContent = 'Waar was ik gebleven? S' + U.pad(ep.s) + 'E' + U.pad(ep.e) + ': ' + j.overview;
    } catch (e) { /* no recap */ }
  }

  function vShow() {
    const show = state.show;
    const root = h('div', { class: 'page' });
    root.appendChild(h('h1', { class: 'ph', text: show.name }));
    if (show.plot) root.appendChild(h('p', { class: 'sub', style: { maxWidth: '90rem', marginTop: '-1.6rem' }, text: show.plot }));
    const fol = follows();
    const isF = fol.some(function (f) { return f.id === show.id; });
    root.appendChild(h('div', { class: 'btns' }, [btn('Terug', function () { state.show = null; render(); }, 'btn sec'),
      btn(isF ? '🔔 Je volgt deze serie' : '🔔 Serie volgen', function () {
        const f = follows().filter(function (z) { return z.id !== show.id; });
        if (!isF) f.push({ id: show.id, name: show.name, n: show.episodes.length });
        store.setUi('follows', JSON.stringify(f));
        toast(isF ? 'Je volgt deze serie niet meer' : 'Je krijgt een melding bij een nieuwe aflevering');
        render(true);
      }, 'btn sec'),
      btn(store.inList(show.id) ? '♥ In Mijn lijst' : '♡ Mijn lijst', function () { store.toggleList({ id: show.id, kind: 'series', name: show.name, logo: show.logo, group: show.group }); render(true); }, 'btn sec')]));
    const recapBox = h('p', { class: 'sub', style: { maxWidth: '90rem' } });
    root.appendChild(recapBox);
    recap(show, recapBox);
    if (!show.episodes.length) root.appendChild(h('div', { class: 'msg', text: 'Geen afleveringen gevonden.' }));
    let season = null;
    const list = h('div', { class: 'list' });
    show.episodes.forEach(function (ep, i) {
      if (ep.s !== season) {
        season = ep.s;
        list.appendChild(h('h2', { text: 'Seizoen ' + season, style: { marginTop: '2.4rem' } }));
      }
      const p = store.getProgress(ep.id);
      const bar = p && p.dur && p.pos > 20000 && !store.isWatched(ep.id) ? Math.min(1, p.pos / p.dur) : store.isWatched(ep.id) ? 1 : 0;
      const rowEl = row({
        title: 'Aflevering ' + ep.e + ' · ' + ep.title,
        sub: ((ep.dur ? ep.dur + ' · ' : '') + (ep.desc || '')).slice(0, 160),
        right: store.isWatched(ep.id) ? '✓' : p && p.dur ? Math.round(100 * p.pos / p.dur) + '%' : '',
        onclick: function () { playEpisode(show, i, p && p.pos > 20000 && p.pos < 0.95 * (p.dur || Infinity) ? p.pos - 5000 : 0); }
      });
      if (bar > 0) rowEl.appendChild(h('div', { class: 'ebar' }, [h('div', { class: 'ebar-i', style: { width: Math.round(bar * 100) + '%' } })]));
      list.appendChild(rowEl);
    });
    root.appendChild(h('div', { style: { height: '2rem' } }));
    root.appendChild(list);
    heroFor({ title: show.name, logo: show.logo, kind: 'series', key: show.name, name: show.name, mkind: 'series', sub: '', desc: show.plot || '', backdrop: '', photo: '' });
    return root;
  }

  // ---------- profiles ----------
  function avatarBg(p) {
    const c = PCOL[p.color % PCOL.length];
    return { stripes: 'repeating-linear-gradient(45deg,' + c + ' 0 1.4rem,rgba(255,255,255,0.22) 1.4rem 2.4rem)', dots: 'radial-gradient(rgba(255,255,255,0.32) 20%,transparent 22%) 0 0/1.8rem 1.8rem,' + c, ring: 'radial-gradient(circle,' + c + ' 45%,rgba(255,255,255,0.4) 47%,' + c + ' 55%)', glow: 'linear-gradient(135deg,' + c + ',rgba(0,0,0,0.55))' }[p.pat] || c;
  }

  function avatar(p, cls) {
    return h('div', { class: cls || 'dot', style: { background: avatarBg(p) }, text: (p.name || '?').trim().slice(0, 1).toUpperCase() });
  }

  function chooseProfile(p) {
    const prev = store.profile();
    store.switchProfile(p.id);
    if (prev && prev.guest && prev.id !== p.id) store.wipeProfile(prev.id);
    if (p.src && store.sources().some(function (s) { return s.id === p.src; }) && (!state.source || state.source.id !== p.src)) { store.setActive(p.src); loadSource(store.active(), false); }
    state.unlocked = false;
    state.group = { live: '', vod: '', series: '', guide: '', radio: '' };
    state.shown = {};
    bump();
    applyTheme();
    state.view = startView();
    const w = document.querySelector('.who');
    if (w) w.remove();
    render();
  }

  function showWho(force) {
    const ps = store.profiles();
    const old = document.querySelector('.who');
    if (old) old.remove();
    const cur = store.profile();
    const screen = h('div', { class: 'who' }, [
      h('h1', { text: 'Wie kijkt er?' }),
      h('div', { class: 'ps' }, ps.map(function (p) {
        const b = h('button', { class: 'p', type: 'button', onclick: function () {
          if (p.id === cur.id && !force) return chooseProfile(p);
          if (isKid() && p.id !== cur.id && pin()) return askPin('Pincode om van profiel te wisselen', function (v) { if (v !== pin()) return false; chooseProfile(p); return true; });
          chooseProfile(p);
        } }, [avatar(p, 'pi'), h('div', { text: p.name }), p.kid ? h('div', { class: 'kid', text: 'Kinderprofiel' }) : null, store.lastOf(p.id) ? h('div', { class: 'sub', text: 'Laatst: ' + store.lastOf(p.id).slice(0, 28) }) : null]);
        b._first = p.id === cur.id;
        return b;
      }))
    ]);
    document.body.appendChild(screen);
    const f = screen.querySelector('.p');
    (Array.prototype.find.call(screen.querySelectorAll('.p'), function (x) { return x._first; }) || f).focus({ preventScroll: true });
  }

  function profileDialog(p) {
    const isNew = !p;
    const d = { name: p ? p.name : '', color: p ? p.color : store.profiles().length % PCOL.length, pat: p ? p.pat || '' : '', kid: p ? !!p.kid : false, guest: p ? !!p.guest : false, src: p ? p.src || '' : '', onlyFavs: p ? !!p.onlyFavs : false, maxAge: p ? p.maxAge || 0 : 0 };
    const draw = function () {
      const name = h('input', { type: 'text', value: d.name, placeholder: 'Naam', autocomplete: 'off' });
      name.addEventListener('input', function () { d.name = name.value; });
      const dots = h('div', { class: 'dots' }, PCOL.map(function (c, i) {
        return h('button', { class: 'dot' + (d.color === i ? ' s' : ''), type: 'button', style: { background: c }, onclick: function () { d.color = i; draw(); } });
      }));
      const kid = toggleRow('Kinderprofiel', 'Verbergt vergrendelde categorieën; wisselen en instellingen vragen de pincode', d.kid, function () { d.kid = !d.kid; draw(); });
      const onlyFavs = d.kid ? toggleRow('Kinderen zien alleen favorieten', 'In Live TV alleen de zenders die je als favoriet hebt gemarkeerd (kies ze met dit profiel)', d.onlyFavs, function () { d.onlyFavs = !d.onlyFavs; draw(); }) : null;
      const ageRow = d.kid ? choiceRow('Leeftijdsgrens voor films', 'Vraagt een TMDB-sleutel; onbekende leeftijd mag wel', [['0', 'Geen'], ['6', '6'], ['9', '9'], ['12', '12'], ['16', '16']], String(d.maxAge || 0), function (v) { d.maxAge = +v; }) : null;
      const srcRow = store.sources().length > 1 ? row({ title: 'Bron van dit profiel', sub: 'Wordt gekozen zodra je naar dit profiel wisselt', right: (store.sources().filter(function (s) { return s.id === d.src; })[0] || { name: 'Geen voorkeur' }).name || 'Bron', onclick: function () {
        pickList('Bron van dit profiel', [['', 'Geen voorkeur']].concat(store.sources().map(function (s) { return [s.id, s.name || s.url || s.server || s.id]; })), d.src, function (v) { d.src = v; draw(); });
      } }) : null;
      const pat = choiceRow('Patroon', 'Van je profielfoto', [['', 'Effen'], ['stripes', 'Strepen'], ['dots', 'Stippen'], ['ring', 'Ring'], ['glow', 'Schaduw']], d.pat, function (v) { d.pat = v; draw(); });
      const guest = toggleRow('Gastprofiel', 'Alles van dit profiel wordt gewist zodra je naar een ander profiel gaat', d.guest, function () { d.guest = !d.guest; draw(); });
      const acts = [btn('Opslaan', function () {
        if (!d.name.trim()) { toast('Geef het profiel een naam'); return; }
        if (isNew) store.updateProfile(store.addProfile({ name: d.name, color: d.color, kid: d.kid }).id, { guest: d.guest, src: d.src, pat: d.pat, onlyFavs: d.kid && d.onlyFavs, maxAge: d.kid ? d.maxAge : 0 });
        else store.updateProfile(p.id, { name: d.name.trim(), color: d.color, kid: d.kid, guest: d.guest, src: d.src, pat: d.pat, onlyFavs: d.kid && d.onlyFavs, maxAge: d.kid ? d.maxAge : 0 });
        closeModal();
        applyTheme();
        bump();
        render(true);
      })];
      if (!isNew) {
        acts.push(btn('Overschakelen', function () { closeModal(); chooseProfile(p); }, 'btn sec'));
        acts.push(btn('Kopiëren', function () { store.copyProfile(p.id); closeModal(); toast('Profiel gekopieerd'); render(true); }, 'btn sec'));
        const others = store.profiles().filter(function (x) { return x.id !== p.id; });
        if (others.length) acts.push(btn('Favorieten delen', function () {
          pickList('Favorieten van ' + p.name + ' delen met', others.map(function (x) { return [x.id, x.name]; }), '', function (id) { store.shareFavs(p.id, id); toast('Favorieten en zapplijst gedeeld'); });
        }, 'btn sec'));
        if (store.profiles().length > 1) acts.push(btn('Verwijderen', function () { store.removeProfile(p.id); closeModal(); applyTheme(); bump(); render(true); }, 'btn sec'));
      }
      acts.push(btn('Sluiten', closeModal, 'btn sec'));
      openModal(h('div', { class: 'dlg', style: { minWidth: '100rem' } }, [h('h2', { text: isNew ? 'Nieuw profiel' : 'Profiel aanpassen' }), name, dots, pat, kid, onlyFavs, ageRow, srcRow, guest, h('div', { class: 'btns' }, acts)]));
      name.focus({ preventScroll: true });
    };
    draw();
  }

  function toggleRow(label, sub, value, onclick) {
    return row({ title: label, sub: sub, right: h('div', { class: 'sw' + (value ? ' on' : '') }), onclick: onclick });
  }

  function choiceRow(label, sub, options, current, onpick) {
    const cur = options.filter(function (o) { return o[0] === current; })[0] || options[0];
    return row({
      title: label, sub: sub, right: h('div', { class: 'val', text: cur[1] }),
      onclick: function () { pickList(label, options, cur[0], onpick); }
    });
  }

  function setUi(k, v) {
    store.setUi(k, v);
    applyTheme();
    bump();
    render(true);
  }

  // ---------- settings ----------
  const TABS = [['profiles', 'Profielen'], ['look', 'Uiterlijk'], ['sources', 'Bronnen'], ['foryou', 'Voor jou'], ['images', 'Beelden & info'], ['live', 'Live TV & gids'], ['play', 'Afspelen'], ['parental', 'Ouderlijk toezicht'], ['rec', 'Opnames'], ['health', 'Zenders & fouten'], ['updates', 'Updates'], ['maint', 'Onderhoud']];

  function field(label, key, opts) {
    opts = opts || {};
    const input = h('input', { type: opts.password ? 'password' : 'text', value: state.form[key] || '', placeholder: opts.ph || '', autocapitalize: 'off', autocomplete: 'off' });
    input.addEventListener('input', function () { state.form[key] = input.value; });
    return [h('label', { text: label }), input];
  }

  function vSettings() {
    const root = h('div', { class: 'page' });
    if (state.sub) {
      root.appendChild(h('h1', { class: 'ph', text: { cats: 'Categorieën verbergen', reminders: 'Herinneringen', hist: 'Kijkgeschiedenis', year: 'Jaaroverzicht', stats: 'Kijkstatistieken', hidden: 'Verborgen zenders' }[state.sub] || '' }));
      root.appendChild(btn('Terug', function () { state.sub = null; render(); }, 'btn sec'));
      root.appendChild(h('div', { style: { height: '2.4rem' } }));
      root.appendChild({ cats: paneCats, reminders: paneReminders, hist: paneHist, year: paneYear, stats: paneStats, hidden: paneHidden }[state.sub]());
      setHero({ title: '', key: 'luma' });
      return root;
    }
    root.appendChild(h('h1', { class: 'ph', text: 'Instellingen' }));
    const menu = h('div', { class: 'menu' }, TABS.map(function (t) {
      return h('button', { class: 'm' + (state.setTab === t[0] ? ' on' : ''), type: 'button', onclick: function () { state.setTab = t[0]; render(true); } }, [t[1]]);
    }));
    const pane = h('div', { class: 'pane' });
    const fn = { profiles: panePro, look: paneLook, sources: paneSources, live: paneLive, foryou: paneForYou, images: paneImages, play: panePlay, parental: paneParental, updates: paneUpdates, rec: paneRec, health: paneHealth, maint: paneMaint }[state.setTab] || panePro;
    fn(pane);
    root.appendChild(h('div', { class: 'set' }, [menu, pane]));
    setHero({ title: '', key: 'luma' });
    return root;
  }

  function panePro(p) {
    p.appendChild(h('h2', { text: 'Profielen' }));
    store.profiles().forEach(function (pr) {
      p.appendChild(row({ lead: avatar(pr), title: pr.name + (pr.id === store.profile().id ? ' (actief)' : ''), sub: pr.kid ? 'Kinderprofiel' : 'Eigen favorieten, voortgang en uiterlijk', onclick: function () { profileDialog(pr); } }));
    });
    p.appendChild(btn('+ Profiel toevoegen', function () { profileDialog(null); }, 'btn sec'));
    p.appendChild(toggleRow('Vraag bij het opstarten wie er kijkt', 'Alleen zinvol bij meer dan één profiel', store.pref('ask') !== 'off', function () {
      store.setPref('ask', store.pref('ask') === 'off' ? 'on' : 'off');
      render(true);
    }));
  }

  function paneLook(p) {
    p.appendChild(h('h2', { text: 'Uiterlijk (alleen dit profiel)' }));
    const hrs = [['-1', 'Uit']].concat([18, 19, 20, 21, 22, 23].map(function (x) { return [String(x), x + ':00']; }));
    p.appendChild(choiceRow('Nachtstand vanaf', 'Warmer scherm en in de speler rustiger geluid', hrs, store.ui('nightfrom', '-1'), function (v) { setUi('nightfrom', v); applyNightLook(); }));
    p.appendChild(choiceRow('Nachtstand tot', 'Tijdstip waarop het weer normaal wordt', [['6', '6:00'], ['7', '7:00'], ['8', '8:00'], ['9', '9:00']], store.ui('nightto', '7'), function (v) { setUi('nightto', v); applyNightLook(); }));
    p.appendChild(choiceRow('Tekstgrootte', 'De hele app groter of kleiner', [['0.9', 'Klein'], ['1', 'Normaal'], ['1.15', 'Groot'], ['1.3', 'Extra groot']], store.ui('fontscale', '1'), function (v) { setUi('fontscale', v); applyCalm(); }));
    p.appendChild(toggleRow('Rustige modus', 'Geen animaties en overgangen', store.ui('calm', 'off') === 'on', function () { setUi('calm', store.ui('calm', 'off') === 'on' ? 'off' : 'on'); applyCalm(); }));
    p.appendChild(toggleRow('Seizoensthema', 'Kerst, oud en nieuw en Koningsdag krijgen een eigen accentkleur', store.ui('season', 'off') === 'on', function () { setUi('season', store.ui('season', 'off') === 'on' ? 'off' : 'on'); }));
    p.appendChild(choiceRow('Doorzichtigheid van de bovenbalk', 'Hoe sterk de balk bovenin de rij eronder verbergt', [['1', 'Dicht'], ['0.6', 'Half'], ['0.3', 'Bijna doorzichtig'], ['0', 'Doorzichtig']], store.ui('topalpha', '1'), function (v) { setUi('topalpha', v); }));
    p.appendChild(toggleRow('Momentopname in kaarten', 'Een stilstaand beeld van wat er nu op tv is, ipv het logo', on('livesnap'), function () { setUi('livesnap', on('livesnap') ? 'off' : 'on'); render(true); }));
    p.appendChild(toggleRow('Live beeld in kaarten', 'Blijf je even op een live-kaart staan, dan speelt het beeld gedempt', on('livepv'), function () { setUi('livepv', on('livepv') ? 'off' : 'on'); previewStop(); }));
    p.appendChild(toggleRow('Foto-slideshow op Voor jou', 'Elke 10 seconden een andere foto', on('homeslides'), function () { setUi('homeslides', on('homeslides') ? 'off' : 'on'); syncSlides(); render(true); }));
    p.appendChild(toggleRow('Foto-slideshow bij Live TV', 'Gedimd, zodat de zenderlijst leesbaar blijft', on('slides_live'), function () { setUi('slides_live', on('slides_live') ? 'off' : 'on'); syncSlides(); render(true); }));
    p.appendChild(choiceRow('Achtergrond', 'Kleurwas per titel, alleen de accentkleur of effen', [['wash', 'Kleurwas'], ['accent', 'Accentkleur'], ['plain', 'Effen']], store.ui('bgstyle', 'wash'), function (v) { setUi('bgstyle', v); }));
    p.appendChild(row({ title: 'Eigen achtergrondafbeelding', sub: store.ui('bgurl', '') || 'Link naar een plaatje; leeg laten voor geen', right: '›', onclick: function () { textDialog('Link naar je achtergrond (leeg = geen)', store.ui('bgurl', ''), function (t) { setUi('bgurl', t); }); } }));
    p.appendChild(toggleRow('Zenders als tegels', 'In Live TV kleine tegels in plaats van een lijst', store.ui('livegrid', 'off') === 'on', function () { setUi('livegrid', store.ui('livegrid', 'off') === 'on' ? 'off' : 'on'); }));
    p.appendChild(choiceRow('Lettertype', 'Gebruikt de lettertypen van je apparaat', [['sans', 'Standaard'], ['round', 'Afgerond'], ['serif', 'Met schreef'], ['mono', 'Typemachine']], store.ui('font', 'sans'), function (v) { setUi('font', v); }));
    p.appendChild(toggleRow('Klikgeluidjes', 'Een zacht tikje bij het navigeren', store.ui('sounds', 'off') === 'on', function () { setUi('sounds', store.ui('sounds', 'off') === 'on' ? 'off' : 'on'); }));
    p.appendChild(choiceRow('Thema', 'Donker, zwart, licht of automatisch', [['dark', 'Donker'], ['black', 'Zwart (OLED)'], ['light', 'Licht'], ['ocean', 'Oceaan'], ['forest', 'Bos'], ['sunset', 'Zonsondergang'], ['purple', 'Paars'], ['auto', 'Automatisch (licht 07–19 u)']], store.ui('theme', 'dark'), function (v) { setUi('theme', v); }));
    const cur = accent();
    const dots = h('div', { class: 'dots' }, TH.ACCENTS.map(function (a) {
      return h('button', { class: 'dot' + (cur === a[1] ? ' s' : ''), type: 'button', title: a[0], style: { background: a[1] }, onclick: function () { setUi('accent', a[1]); } });
    }));
    p.appendChild(h('label', { text: 'Accentkleur' }));
    p.appendChild(dots);
    const hex = h('input', { type: 'text', value: cur, placeholder: '#ff8a1f', autocapitalize: 'off', autocomplete: 'off' });
    p.appendChild(h('label', { text: 'Eigen kleur (hex-code, bijvoorbeeld #ff5500)' }));
    p.appendChild(hex);
    p.appendChild(btn('Eigen kleur toepassen', function () {
      const c = TH.normHex(hex.value);
      if (!c) { toast('Dat is geen geldige kleurcode'); return; }
      setUi('accent', c);
    }, 'btn sec'));
    p.appendChild(choiceRow('Tekstgrootte', 'Alles wordt mee vergroot of verkleind', [['small', 'Klein'], ['normal', 'Normaal'], ['large', 'Groot']], store.ui('size', 'normal'), function (v) { setUi('size', v); }));
    p.appendChild(toggleRow('Grote achtergrondafbeelding', 'Poster of logo achter het scherm; uit = rustiger en sneller', on('bgart'), function () { setUi('bgart', on('bgart') ? 'off' : 'on'); }));
    p.appendChild(toggleRow('Animaties', 'Uitzetten maakt oudere tv\'s soepeler', on('effects'), function () { setUi('effects', on('effects') ? 'off' : 'on'); }));
    p.appendChild(choiceRow('Kaartgrootte', 'Hoeveel er op het scherm past', [['small', 'Klein'], ['normal', 'Normaal'], ['large', 'Groot']], store.ui('cardsize', 'normal'), function (v) { setUi('cardsize', v); }));
    p.appendChild(toggleRow('Hoog contrast', 'Sterkere lijnen en tekst, makkelijker te lezen', on('hc', 'off'), function () { setUi('hc', on('hc', 'off') ? 'off' : 'on'); }));
    p.appendChild(toggleRow('Compacte gids', 'Lagere rijen, meer zenders tegelijk', on('compact', 'off'), function () { setUi('compact', on('compact', 'off') ? 'off' : 'on'); }));
    p.appendChild(toggleRow('Startintro tonen', 'Het openingsscherm terwijl je bron laadt (blijft anders alleen kort zichtbaar)', store.pref('intro') !== 'off', function () { store.setPref('intro', store.pref('intro') === 'off' ? 'on' : 'off'); render(true); }));
    p.appendChild(toggleRow('Klok tonen', '', on('clock'), function () { setUi('clock', on('clock') ? 'off' : 'on'); }));
  }

  function paneSources(p) {
    p.appendChild(h('h2', { text: 'Invullen met je telefoon' }));
    if (state.remote && state.remote.url) {
      const panel = h('div', { class: 'qr-panel' });
      const pic = h('div', { class: 'qr' });
      pic.innerHTML = state.remote.svg;
      panel.appendChild(pic);
      panel.appendChild(h('div', { class: 'qr-text' }, [
        h('div', { class: 'qr-step', text: '1. Zorg dat je telefoon op hetzelfde wifi zit als deze tv' }),
        h('div', { class: 'qr-step', text: '2. Scan de QR-code met de camera van je telefoon' }),
        h('div', { class: 'qr-step', text: '3. Vul het formulier in en tik op Naar de tv sturen' }),
        h('div', { class: 'sub', style: { wordBreak: 'break-all' }, text: 'Of open dit adres: ' + state.remote.url }),
        btn('Stoppen', function () { stopRemote(); render(true); }, 'btn sec')
      ]));
      p.appendChild(panel);
    } else {
      p.appendChild(btn('Toon QR-code om in te vullen met je telefoon', startRemote));
      if (state.remoteError) p.appendChild(h('div', { class: 'msg err', text: state.remoteError }));
    }
    const f = state.form;
    p.appendChild(h('h2', { text: 'Bron toevoegen op de tv' }));
    p.appendChild(h('div', { class: 'chips' }, [['m3u', 'M3U-link'], ['xtream', 'Xtream Codes']].map(function (t) {
      return h('button', { class: 'chip' + (f.type === t[0] ? ' on' : ''), type: 'button', onclick: function () { f.type = t[0]; render(true); } }, [t[1]]);
    })));
    const parts = field('Naam (optioneel)', 'name', { ph: 'Mijn lijst' });
    if (f.type === 'xtream') {
      parts.push.apply(parts, field('Server', 'server', { ph: 'http://voorbeeld.tv:8080' }));
      parts.push.apply(parts, field('Gebruikersnaam', 'user'));
      parts.push.apply(parts, field('Wachtwoord', 'pass', { password: true }));
    } else {
      parts.push.apply(parts, field('Link naar M3U-lijst', 'url', { ph: 'http://…/lijst.m3u' }));
    }
    parts.push.apply(parts, field('Gids (XMLTV-link, optioneel; meerdere mag, gescheiden door een spatie)', 'epg'));
    parts.push.apply(parts, field('User-agent (optioneel)', 'ua'));
    parts.forEach(function (x) { p.appendChild(x); });
    if (state.error) p.appendChild(h('div', { class: 'msg err', text: state.error }));
    if (state.loading) p.appendChild(h('div', { class: 'msg', text: state.loading }));
    p.appendChild(btn('Opslaan en laden', saveForm));
    if (state.loadMs) p.appendChild(h('div', { class: 'sub', text: 'Laatste keer laden duurde ' + (state.loadMs / 1000).toFixed(1) + ' seconden.' }));
    p.appendChild(choiceRow('Lijst verversen', 'Hoe oud een gedownloade lijst mag zijn voordat hij opnieuw wordt opgehaald', [['1', 'Na 1 uur'], ['6', 'Na 6 uur'], ['24', 'Na 1 dag'], ['0.01', 'Altijd opnieuw']], String(store.pref('refresh') || '1'), function (v) { store.setPref('refresh', v); render(true); }));
    if (store.sources().length > 1) p.appendChild(toggleRow('Alle bronnen samenvoegen', 'Zenders, films en series van al je bronnen in één lijst (gids van de eerste bron met gids)', store.pref('merge') === 'on', function () { store.setPref('merge', store.pref('merge') === 'on' ? 'off' : 'on'); loadSource(store.active(), false); render(true); }));
    if (native && native.listFiles) {
      let files = [];
      try { files = JSON.parse(native.listFiles('lijsten')); } catch (e) { files = []; }
      p.appendChild(h('h2', { text: 'Lokale lijsten' }));
      p.appendChild(h('div', { class: 'sub', text: 'Zet een .m3u-bestand in de map "lijsten" van de app (bijvoorbeeld met adb push) en kies het hier.' }));
      files.forEach(function (f) {
        p.appendChild(row({ title: f.name, sub: f.path, right: 'Toevoegen', onclick: function () {
          const s = store.addSource({ type: 'm3u', name: f.name, url: 'file://' + f.path });
          loadSource(s, true);
        } }));
      });
    }
    const srcs = store.sources();
    if (srcs.length) {
      p.appendChild(h('h2', { text: 'Jouw bronnen' }));
      const active = store.active();
      srcs.forEach(function (s) {
        const label = (s.name || s.url || s.server) + (active && active.id === s.id ? ' (actief)' : '');
        p.appendChild(h('div', { class: 'btns' }, [
          btn(label, function () { store.setActive(s.id); loadSource(s, false); }, 'chip'),
          btn('Verversen', function () { loadSource(s, true); }, 'chip'),
          store.sources().length > 1 ? btn(s.off ? 'Aanzetten' : 'Uitzetten', function () { store.setSourceOff(s.id, !s.off); toast(s.off ? 'Staat uit bij samenvoegen' : 'Doet weer mee bij samenvoegen'); render(true); }, 'chip') : null,
          btn('Verwijderen', function () { store.removeSource(s.id); state.lib = null; bump(); boot(); }, 'chip')
        ]));
      });
    }
  }

  function paneLive(p) {
    p.appendChild(h('h2', { text: 'Live TV & gids' }));
    p.appendChild(choiceRow('Startscherm na 18:00', 'Andere startpagina in de avond', [['', 'Zelfde als overdag'], ['home', 'Voor jou'], ['live', 'Live TV'], ['guide', 'Gids']], store.ui('startev', ''), function (v) { setUi('startev', v); }));
    p.appendChild(choiceRow('Zachte kijkwaarschuwing', 'Eén herinnering per dag, geen blokkade', [['0', 'Uit'], ['2', 'Na 2 uur'], ['3', 'Na 3 uur'], ['4', 'Na 4 uur']], store.ui('softlimit', '0'), function (v) { setUi('softlimit', v); }));
    p.appendChild(choiceRow('Startscherm', 'Waar de app opent', [['home', 'Voor jou'], ['live', 'Live TV'], ['guide', 'Gids']], store.ui('start', 'home'), function (v) { setUi('start', v); }));
    p.appendChild(row({ title: 'Nieuwsrij op Home', sub: store.pref('rss') || 'Plak een RSS-link; leeg laten voor geen', right: '›', onclick: function () { textDialog('RSS-link voor nieuwskoppen', store.pref('rss'), function (t) { store.setPref('rss', t.trim()); loadNews(); render(true); }); } }));
    p.appendChild(row({ title: 'Sportalarm', sub: store.ui('alertwords', '') || 'Namen gescheiden door komma, bijvoorbeeld Ajax, Formule 1', right: '›', onclick: function () { textDialog('Waarvoor wil je een melding? (komma\'s ertussen)', store.ui('alertwords', ''), function (t) { setUi('alertwords', t); render(true); }); } }));
    p.appendChild(toggleRow('Dubbele zenders samenvoegen', 'HD, FHD en SD van dezelfde zender: alleen de beste in de lijst, de rest dient als reserve', store.ui('dedupelive', 'off') === 'on', function () { setUi('dedupelive', store.ui('dedupelive', 'off') === 'on' ? 'off' : 'on'); state.altIdx = null; bump(); }));
    p.appendChild(toggleRow('Dubbele titels samenvoegen', 'Dezelfde film in meer kwaliteiten verschijnt één keer', store.ui('dedupe', 'off') === 'on', function () { setUi('dedupe', store.ui('dedupe', 'off') === 'on' ? 'off' : 'on'); bump(); }));
    p.appendChild(toggleRow('Favorieten op tijdstip', 's Ochtends nieuws bovenaan, s avonds films', store.ui('favtime', 'on') === 'on', function () { setUi('favtime', store.ui('favtime', 'on') === 'on' ? 'off' : 'on'); }));
    p.appendChild(toggleRow('Laatste zender automatisch starten', 'Bij het openen van de app direct verder kijken', store.ui('autolive', 'off') === 'on', function () { setUi('autolive', store.ui('autolive', 'off') === 'on' ? 'off' : 'on'); }));
    p.appendChild(choiceRow('Zenders sorteren', 'In de volgorde van je lijst of op naam', [['list', 'Volgorde van lijst'], ['name', 'Op naam'], ['num', 'Op mijn eigen nummers']], store.ui('sort', 'list'), function (v) { setUi('sort', v); }));
    p.appendChild(toggleRow('Reservezender', 'Als een zender niet start, automatisch een andere versie (HD, FHD, 4K) proberen', on('backup'), function () { setUi('backup', on('backup') ? 'off' : 'on'); }));
    p.appendChild(toggleRow('Dubbele zenders en films samenvoegen', 'HD, FHD en 4K van hetzelfde: alleen de beste blijft over', store.ui('dedupe', 'off') === 'on', function () { setUi('dedupe', store.ui('dedupe', 'off') === 'on' ? 'off' : 'on'); }));
    p.appendChild(choiceRow('Tijdvenster van de gids', 'Hoeveel uur vooruit je ziet', [['3', '3 uur'], ['6', '6 uur'], ['12', '12 uur'], ['24', '24 uur'], ['48', '2 dagen']], store.ui('hours', '6'), function (v) { setUi('hours', v); }));
    p.appendChild(choiceRow('Gids verversen', 'Hoe oud de gids mag zijn voordat hij opnieuw wordt opgehaald', [['3', 'Na 3 uur'], ['6', 'Na 6 uur'], ['12', 'Na 12 uur'], ['24', 'Na 1 dag']], String(store.pref('epgttl') || '6'), function (v) { store.setPref('epgttl', v); render(true); }));
    p.appendChild(toggleRow('Elke nacht verversen', 'Om 04:00 laadt de app lijst en gids opnieuw (als de app dan openstaat)', store.pref('night') === 'on', function () { store.setPref('night', store.pref('night') === 'on' ? 'off' : 'on'); render(true); }));
    p.appendChild(toggleRow('Posters in de gids', 'Toont het programmabeeld in de gidsvakjes', on('gposters'), function () { setUi('gposters', on('gposters') ? 'off' : 'on'); }));
    p.appendChild(choiceRow('Gids loopt gelijk?', 'Staan de tijden een uur te vroeg of te laat? Corrigeer hier', [['-120', '2 uur terug'], ['-60', '1 uur terug'], ['0', 'Geen correctie'], ['60', '1 uur vooruit'], ['120', '2 uur vooruit']], String(+store.pref('epgoff') || 0), function (v) { store.setPref('epgoff', v); toast('Wordt toegepast bij het volgende laden van de gids'); render(true); }));
    const al = alarmCfg();
    p.appendChild(row({ title: '⏰ Wekker', sub: al && al.on ? al.time + ' · ' + ((vis('live').filter(function (c) { return c.id === al.chId; })[0] || {}).name || '') : 'Uit: start een zender op een tijdstip', right: '›', onclick: alarmDialog }));
    p.appendChild(row({ title: 'Zenders controleren', sub: 'Zoekt zenders die niet reageren, en verbergt ze desgewenst', right: '›', onclick: deadCheck }));
    p.appendChild(row({ title: 'Verborgen zenders', sub: store.hiddenChannels().length + ' verborgen', right: '›', onclick: function () { state.sub = 'hidden'; render(); } }));
    p.appendChild(row({ title: 'Categorieën verbergen', sub: 'Haal categorieën weg die je nooit kijkt', right: '›', onclick: function () { state.sub = 'cats'; render(); } }));
    p.appendChild(row({ title: 'Herinneringen', sub: store.reminders().length + ' ingesteld', right: '›', onclick: function () { state.sub = 'reminders'; render(); } }));
    p.appendChild(row({ title: 'Favorieten wissen', sub: store.favs().length + ' zenders', onclick: function () { store.setFavs([]); bump(); toast('Favorieten gewist'); render(true); } }));
  }

  function panePlay(p) {
    p.appendChild(h('h2', { text: 'Afspelen' }));
    p.appendChild(toggleRow('Terugkijken bij live tv', 'Bewaart je live tv tot 90 minuten zodat je kunt terugspoelen. Gebruikt een tweede verbinding: niet alle aanbieders staan dat toe. Pauzeren werkt ook zonder.', store.ui('tsauto', 'off') === 'on', function () { setUi('tsauto', store.ui('tsauto', 'off') === 'on' ? 'off' : 'on'); }));
    p.appendChild(toggleRow('Intro automatisch overslaan', 'Als je bij een aflevering Intro overslaan koos, doet de volgende aflevering het zelf op hetzelfde moment', store.ui('autointro', 'off') === 'on', function () { setUi('autointro', store.ui('autointro', 'off') === 'on' ? 'off' : 'on'); }));
    p.appendChild(choiceRow('Terugspoelen (pijl links)', 'Bij films en series', [['10', '10 seconden'], ['20', '20 seconden'], ['30', '30 seconden']], store.ui('seekBack', '10'), function (v) { setUi('seekBack', v); }));
    p.appendChild(choiceRow('Vooruitspoelen (pijl rechts)', 'Bij films en series', [['10', '10 seconden'], ['30', '30 seconden'], ['60', '1 minuut']], store.ui('seekFwd', '30'), function (v) { setUi('seekFwd', v); }));
    p.appendChild(choiceRow('Infobalk blijft zichtbaar', 'In de speler', [['3', '3 seconden'], ['5', '5 seconden'], ['8', '8 seconden'], ['12', '12 seconden']], store.ui('overlay', '5'), function (v) { setUi('overlay', v); }));
    p.appendChild(choiceRow('Voorkeur audiotaal', 'Wordt automatisch gekozen als de stream die heeft', [['', 'Standaard van de stream'], ['nl', 'Nederlands'], ['en', 'Engels'], ['de', 'Duits'], ['fr', 'Frans'], ['es', 'Spaans'], ['tr', 'Turks']], store.ui('alang', ''), function (v) { setUi('alang', v); }));
    p.appendChild(choiceRow('Kleur van ondertitels', 'In de speler', [['wit', 'Wit'], ['geel', 'Geel'], ['groen', 'Groen'], ['cyaan', 'Cyaan']], store.ui('subcolor', 'wit'), function (v) { setUi('subcolor', v); }));
    p.appendChild(choiceRow('Grootte van ondertitels', 'In de speler', [['0.8', 'Klein'], ['1', 'Normaal'], ['1.4', 'Groot'], ['1.8', 'Extra groot']], store.ui('subsize', '1'), function (v) { setUi('subsize', v); }));
    p.appendChild(choiceRow('Voorkeur ondertiteling', 'Automatisch aan als beschikbaar', [['off', 'Uit'], ['nl', 'Nederlands'], ['en', 'Engels'], ['de', 'Duits'], ['fr', 'Frans'], ['es', 'Spaans']], store.ui('slang', 'off'), function (v) { setUi('slang', v); }));
    p.appendChild(toggleRow('Volgende aflevering automatisch', 'Na het einde van een aflevering door naar de volgende', on('autonext'), function () { setUi('autonext', on('autonext') ? 'off' : 'on'); }));
    p.appendChild(choiceRow('Intro overslaan', 'Springt zoveel seconden vooruit bij "Intro overslaan"', [['60', '60 seconden'], ['85', '85 seconden'], ['120', '2 minuten']], store.ui('skipsecs', '85'), function (v) { setUi('skipsecs', v); }));
    p.appendChild(choiceRow('Maximale kwaliteit', 'Lager = minder data en soepeler op trage verbindingen', [['0', 'Automatisch (hoogste)'], ['1080', 'Maximaal 1080p'], ['720', 'Maximaal 720p'], ['480', 'Maximaal 480p']], store.ui('maxh', '0'), function (v) { setUi('maxh', v); }));
    p.appendChild(h('div', { class: 'msg', text: 'In de speler: OK toont de zenderbalk met zenderlijst, favoriet en gids-info. Pijl omhoog/omlaag zapt, cijfers kiezen een zender.' }));
  }

  function setPinFlow() {
    askPin('Kies een pincode van 4 cijfers', function (a) {
      closeModal();
      setTimeout(function () {
        askPin('Herhaal de pincode', function (b) {
          if (b !== a) { toast('De codes zijn niet gelijk'); return false; }
          store.setPref('pin', a);
          toast('Pincode ingesteld');
          bump();
          render(true);
          return true;
        });
      }, 0);
      return true;
    });
  }

  function paneParental(p) {
    p.appendChild(h('h2', { text: 'Ouderlijk toezicht' }));
    p.appendChild(row({
      title: 'Pincode', sub: pin() ? 'Ingesteld' : 'Niet ingesteld', right: pin() ? 'Wijzigen' : 'Instellen',
      onclick: function () {
        if (!pin()) return setPinFlow();
        needPin('Huidige pincode', function () {
          pickList('Pincode', [['change', 'Nieuwe pincode kiezen'], ['remove', 'Pincode verwijderen']], '', function (v) {
            if (v === 'remove') { store.setPref('pin', ''); toast('Pincode verwijderd'); bump(); render(true); } else setTimeout(setPinFlow, 0);
          });
        });
      }
    }));
    store.profiles().filter(function (x) { return x.kid; }).forEach(function (kp) {
      const d = store.dayOf(kp.id, 1);
      p.appendChild(h('h2', { text: kp.name + ' gisteren', style: { marginTop: '2rem' } }));
      if (!d.ms) { p.appendChild(h('div', { class: 'sub', text: 'Niets gekeken' })); return; }
      p.appendChild(h('div', { class: 'sub', text: Math.round(d.ms / 60000) + ' minuten' }));
      d.top.forEach(function (t) { p.appendChild(h('div', { class: 'sub', text: '• ' + t[0] + ' (' + Math.round(t[1] / 60000) + ' min)' })); });
    });
    const lw = h('input', { type: 'text', value: store.pref('lock') === '-' ? '' : (store.pref('lock') || 'xxx,adult,18+,erotic,porn'), autocapitalize: 'off', autocomplete: 'off' });
    p.appendChild(h('label', { text: 'Vergrendelde woorden in categorienamen (gescheiden door komma\'s)' }));
    p.appendChild(lw);
    p.appendChild(btn('Woorden opslaan', function () {
      store.setPref('lock', lw.value.trim() || '-');
      bump();
      toast('Opgeslagen');
      render(true);
    }, 'btn sec'));
    if (pin()) {
      p.appendChild(toggleRow('Vergrendelde categorieën nu tonen', 'Gaat vanzelf uit als je van profiel wisselt of de app sluit', state.unlocked, function () {
        if (state.unlocked) { state.unlocked = false; bump(); render(true); } else needPin('Pincode', function () { state.unlocked = true; bump(); render(true); });
      }));
    }
    const me = store.profile();
    if (me.kid) {
      p.appendChild(choiceRow('Kijktijd per dag (' + me.name + ')', 'Daarna kan er niet meer worden afgespeeld', [['0', 'Onbeperkt'], ['60', '1 uur'], ['120', '2 uur'], ['180', '3 uur']], String(me.limit || 0), function (v) { store.updateProfile(me.id, { limit: +v }); render(true); }));
      p.appendChild(choiceRow('Bedtijd (' + me.name + ')', 'Vanaf dit uur tot 06:00 kan er niet worden afgespeeld', [['0', 'Geen'], ['19', '19:00'], ['20', '20:00'], ['21', '21:00'], ['22', '22:00']], String(me.bed || 0), function (v) { store.updateProfile(me.id, { bed: +v }); render(true); }));
    } else {
      p.appendChild(h('div', { class: 'msg', text: 'Maak of kies een kinderprofiel om kijktijd en bedtijd in te stellen.' }));
    }
    p.appendChild(h('div', { class: 'msg', text: 'Kinderprofielen zien nooit vergrendelde categorieën en hebben de pincode nodig voor Instellingen en om van profiel te wisselen. Zonder pincode zijn Instellingen niet bereikbaar vanuit een kinderprofiel.' }));
  }

  function paneUpdates(p) {
    p.appendChild(h('h2', { text: 'Updates' }));
    p.appendChild(h('div', { class: 'msg', text: 'Updates installeren alleen over de oude versie heen als ze met dezelfde sleutel zijn gebouwd. Bewaar daarom op je Mac het bestand ~/.android/debug.keystore (script: scripts/bewaar-sleutel.sh) en bouw altijd daar.' }));
    [['app', 'repo', 'Repo voor Luma TV-updates'], ['launcher', 'repoLauncher', 'Repo voor launcher-updates']].forEach(function (r) {
      const inp = h('input', { type: 'text', value: store.pref(r[1]), placeholder: updateRepo(r[0]) || 'gebruiker/repo op GitHub', autocapitalize: 'off', autocomplete: 'off' });
      inp.addEventListener('input', function () { store.setPref(r[1], inp.value.trim()); });
      p.appendChild(h('label', { text: r[2] + ' (leeg = standaard uit config.js)' }));
      p.appendChild(inp);
    });
    p.appendChild(h('div', { class: 'msg', id: 'upd', text: 'Huidige versie: ' + (native ? native.version() : 'voorbeeld') }));
    p.appendChild(btn('Controleer op update (Luma TV)', function () { checkUpdate('app'); }));
    p.appendChild(btn('Controleer op update (launcher)', function () { checkUpdate('launcher'); }, 'btn sec'));
  }

  /** After adding a source: try a handful of channels and report. */
  function sourceCheck() {
    if (!native || !native.probe) return;
    const all = vis('live').filter(function (c) { return c.url; });
    if (all.length < 3) return;
    const step = Math.max(1, Math.floor(all.length / 6));
    const sample = [];
    for (let i = 0; i < all.length && sample.length < 6; i += step) sample.push(all[i]);
    let ok = 0, n = 0;
    window.lumaProbe = function (id, good) { n++; if (good) ok++; };
    window.lumaProbeDone = function () {
      window.lumaProbe = null;
      openModal(h('div', { class: 'dlg' }, [
        h('h2', { text: ok === sample.length ? 'Je bron werkt' : ok ? 'Je bron werkt gedeeltelijk' : 'Je bron reageert niet' }),
        h('div', { class: 'sub', text: ok + ' van ' + sample.length + ' proefzenders reageerden. ' + (ok ? 'Onder Instellingen kun je alle zenders laten controleren.' : 'Controleer je gegevens of probeer later opnieuw.') }),
        h('div', { class: 'btns' }, [btn('Sluiten', closeModal)])
      ]));
    };
    native.probe(JSON.stringify(sample.map(function (c) { return { id: c.id, url: c.url }; })), (state.source && state.source.ua) || '');
  }

  function groupMenu(group) {
    pickList(group, [['play', '▶ Groep afspelen (zappen door de groep)'], ['test', 'Groep testen en dode zenders verbergen']], '', function (v) {
      if (v === 'play') {
        const list = vis('live').filter(function (c) { return c.group === group; });
        if (list.length) play(list, 0);
      }
      if (v === 'test') deadCheck(group);
    });
  }

  function deadCheck(group) {
    if (!native || !native.probe) return toast('Controleren werkt alleen in de Luma TV-app');
    const list = vis('live').filter(function (c) { return c.url && (!group || c.group === group); });
    if (!list.length) return toast('Laad eerst een bron');
    const cap = list.slice(0, 600);
    const byId = {};
    cap.forEach(function (c) { byId[c.id] = c; });
    const dead = [];
    let n = 0;
    window.lumaProbe = function (id, ok) {
      n++;
      if (!ok && byId[id]) dead.push(byId[id]);
      if (n % 25 === 0) introStatus('');
      const el = $('probe-st');
      if (el) el.textContent = 'Gecontroleerd: ' + n + ' van ' + cap.length + ' · ' + dead.length + ' reageren niet';
    };
    window.lumaProbeDone = function () {
      window.lumaProbe = null;
      const dlg = h('div', { class: 'dlg' }, [
        h('h2', { text: dead.length ? dead.length + ' zenders reageren niet' : 'Alle zenders reageren' }),
        h('div', { class: 'sub', text: cap.length + ' gecontroleerd' + (list.length > cap.length ? ' (de eerste ' + cap.length + ')' : '') + '. Een zender kan ook alleen even uit de lucht zijn.' }),
        h('div', { class: 'btns' }, [
          dead.length ? btn('Alle verbergen', function () { dead.forEach(function (c) { store.setChan(c.id, { hide: true }); }); closeModal(); bump(); toast(dead.length + ' zenders verborgen (terug te zetten bij Verborgen zenders)'); render(true); }) : null,
          btn('Sluiten', closeModal, 'btn sec')
        ])
      ]);
      openModal(dlg);
    };
    openModal(h('div', { class: 'dlg' }, [h('h2', { text: 'Zenders controleren' }), h('div', { class: 'sub', id: 'probe-st', text: 'Bezig…' }),
      h('div', { class: 'btns' }, [btn('Stoppen', function () { native.stopProbe(); closeModal(); }, 'btn sec')])]));
    native.probe(JSON.stringify(cap.map(function (c) { return { id: c.id, url: c.url }; })), (state.source && state.source.ua) || '');
  }

  function fmtSize(b) { return b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.round(b / 1e6) + ' MB'; }

  function paneRec(p) {
    p.appendChild(h('h2', { text: 'Opnames' }));
    if (!native || !native.recordings) { p.appendChild(h('div', { class: 'msg', text: 'Opnemen werkt alleen in de Luma TV-app.' })); return; }
    p.appendChild(choiceRow('Maximale lengte van een opname', 'Opnemen stopt daarna vanzelf', [['30', '30 minuten'], ['60', '1 uur'], ['120', '2 uur'], ['180', '3 uur']], store.ui('recmin', '60'), function (v) { setUi('recmin', v); }));
    p.appendChild(choiceRow('Eerder beginnen met opnemen', 'Voor geplande opnames', [['0', 'Op tijd'], ['2', '2 minuten'], ['5', '5 minuten']], store.ui('recpre', '0'), function (v) { setUi('recpre', v); }));
    p.appendChild(choiceRow('Later stoppen met opnemen', 'Voor geplande opnames', [['0', 'Op tijd'], ['5', '5 minuten'], ['10', '10 minuten']], store.ui('recpost', '0'), function (v) { setUi('recpost', v); }));
    p.appendChild(choiceRow('Opnames automatisch wissen', 'Oude opnames ruimen zichzelf op', [['0', 'Nooit'], ['7', 'Na 7 dagen'], ['30', 'Na 30 dagen']], store.ui('recdays', '0'), function (v) { setUi('recdays', v); }));
    recRules().forEach(function (r, i) {
      p.appendChild(row({ title: '● ' + r.title, sub: r.chName + ' · elke uitzending', right: 'Verwijderen', onclick: function () { const rs = recRules(); rs.splice(i, 1); store.setUi('recrules', JSON.stringify(rs)); render(true); } }));
    });
    if (native.storage) {
      try {
        const st = JSON.parse(native.storage());
        p.appendChild(h('div', { class: 'sub', text: 'Opslag: opnames ' + fmtSize(st.rec) + ' · timeshift ' + fmtSize(st.shift) + ' · cache ' + fmtSize(st.cache) }));
        p.appendChild(btn('Timeshift en cache opruimen', function () { native.clearTimeshift(); native.clearCache(); toast('Opgeruimd'); render(true); }, 'btn sec'));
      } catch (e) { /* no storage info */ }
    }
    if (native.freeSpace) p.appendChild(h('div', { class: 'sub', text: 'Vrije ruimte voor opnames: ' + fmtSize(+native.freeSpace()) }));
    const now = native.recording();
    if (now) p.appendChild(row({ title: '● Bezig met opnemen: ' + now, sub: 'OK om te stoppen', right: 'Stoppen', onclick: function () { native.stopRecord(); toast('Opname gestopt'); setTimeout(function () { render(true); }, 600); } }));
    let list = [];
    try { list = JSON.parse(native.recordings()); } catch (e) { list = []; }
    if (!list.length) p.appendChild(h('div', { class: 'msg', text: 'Nog geen opnames. Open tijdens het kijken de actiebalk (pijl omlaag) en kies Opnemen, of houd OK ingedrukt op een programma in de gids.' }));
    if (list.length > 1) p.appendChild(btn('▶ Alle opnames achter elkaar afspelen', function () {
      const items = list.slice().reverse().map(function (r) {
        const t = r.name.replace(/_\d{8}_\d{4}\.ts$/, '');
        const id = 'rec:' + r.name;
        state.playMeta[id] = { id: id, kind: 'vod', title: t, name: t, url: 'file://' + r.path };
        return { id: id, title: t, url: 'file://' + r.path };
      });
      native.play(JSON.stringify({ live: false, index: 0, position: 0, accent: accent(), seekBack: +store.ui('seekBack', '10') * 1000, seekFwd: +store.ui('seekFwd', '30') * 1000, overlayMs: +store.ui('overlay', '5') * 1000, autoNext: true, skipMs: 85000, list: items }));
    }, 'btn sec'));
    list.forEach(function (r) {
      const title = r.name.replace(/_\d{8}_\d{4}\.ts$/, '');
      p.appendChild(row({ title: title, sub: new Date(r.time).toLocaleString('nl-NL') + ' · ' + fmtSize(r.size), right: 'Afspelen', onclick: function () {
        pickList(title, [['play', 'Afspelen'], ['exp', 'Bewaren in galerij (Movies/Luma)'], ['del', 'Verwijderen']], '', function (v) {
          if (v === 'exp') { toast(native.exportRecording && native.exportRecording(r.path) ? 'Bewaard in Movies/Luma' : 'Bewaren mislukt'); return; }
          if (v === 'del') { native.deleteRecording(r.path); toast('Opname verwijderd'); return render(true); }
          const id = 'rec:' + r.name;
          state.playMeta[id] = { id: id, kind: 'vod', title: title, name: title, url: 'file://' + r.path };
          native.play(JSON.stringify({ id: id, title: title, url: 'file://' + r.path, live: false, position: 0, accent: accent(), seekBack: +store.ui('seekBack', '10') * 1000, seekFwd: +store.ui('seekFwd', '30') * 1000, overlayMs: +store.ui('overlay', '5') * 1000, autoNext: false, skipMs: 85000 }));
        });
      } }));
    });
  }

  function paneHealth(p) {
    p.appendChild(h('h2', { text: 'Zenders met problemen' }));
    if (!native || !native.errorLog) { p.appendChild(h('div', { class: 'msg', text: 'Het foutlogboek werkt alleen in de Luma TV-app.' })); return; }
    let log = [];
    try { log = JSON.parse(native.errorLog()); } catch (e) { log = []; }
    if (!log.length) { p.appendChild(h('div', { class: 'msg', text: 'Geen afspeelfouten gelogd. Zenders die vaak haperen verschijnen hier.' })); return; }
    const by = {};
    log.forEach(function (e) { const b = by[e.id] || (by[e.id] = { id: e.id, name: e.name, n: 0, last: 0, code: '' }); b.n++; b.last = Math.max(b.last, e.t); b.code = e.code; });
    Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 25).forEach(function (b) {
      p.appendChild(row({ title: b.name + ' · ' + b.n + '×', sub: b.code + ' · laatst ' + new Date(b.last).toLocaleString('nl-NL'), right: 'Verbergen', onclick: function () {
        store.setChan(b.id, { hide: true });
        toast('Verborgen: ' + b.name);
        render(true);
      } }));
    });
    p.appendChild(h('h2', { text: 'Laatste fouten', style: { marginTop: '2.4rem' } }));
    log.slice(-8).reverse().forEach(function (e) {
      p.appendChild(h('div', { class: 'sub', text: new Date(e.t).toLocaleTimeString('nl-NL') + ' · ' + e.name + ' · ' + e.code }));
    });
    p.appendChild(btn('Logboek wissen', function () { native.clearErrorLog(); toast('Logboek gewist'); render(true); }, 'btn sec'));
  }

  function restoreFrom(path) {
    const t = native.readText(path);
    if (!t || t.charAt(0) !== '{') return toast('Geen back-up gevonden');
    try { JSON.parse(t); } catch (e) { return toast('De back-up is beschadigd'); }
    localStorage.setItem('luma.v1', t);
    toast('Teruggezet: de app start opnieuw');
    setTimeout(function () { location.reload(); }, 800);
  }

  function paneMaint(p) {
    p.appendChild(h('h2', { text: 'Onderhoud' }));
    p.appendChild(row({ title: '👪 Kijktijd per profiel', sub: 'Deze week, voor iedereen in huis', right: '›', onclick: familyWeek }));
    p.appendChild(row({ title: '📅 Jouw jaaroverzicht', sub: 'Kijktijd en meest bekeken dit jaar', right: '›', onclick: function () { state.sub = 'year'; render(); } }));
    if (native && native.saveText) {
      p.appendChild(btn('Back-up maken', function () {
        const ok = native.saveText('luma-backup.json', localStorage.getItem('luma.v1') || '{}');
        toast(ok ? 'Back-up staat in de map van de app (backup/luma-backup.json)' : 'Back-up maken mislukt');
      }, 'btn sec'));
      p.appendChild(btn('Zenderlijst exporteren', function () {
        const ch = state.lib ? vis('live') : [];
        const favs = ch.filter(function (c) { return store.isFav(c.id); });
        const use = favs.length ? favs : ch;
        const txt = '#EXTM3U\n' + use.map(function (c) { return '#EXTINF:-1 tvg-logo="' + (c.logo || '') + '" group-title="' + (c.group || '') + '",' + c.name + '\n' + c.url; }).join('\n') + '\n';
        toast(native.saveText('luma-zenders.m3u', txt) ? use.length + ' zenders bewaard in backup/luma-zenders.m3u' : 'Exporteren mislukt');
      }, 'btn sec'));
      p.appendChild(btn('Back-up terugzetten', function () {
        let files = [];
        try { files = native.backups ? JSON.parse(native.backups()) : []; } catch (e) { files = []; }
        if (files.length > 1) {
          return pickList('Welke back-up?', files.slice(0, 8).map(function (f) { return [f.path, f.name.replace(/^luma-backup-?/, '').replace('.json', '') || 'laatste handmatige']; }).map(function (x, i) { return [x[0], new Date(files[i].time).toLocaleString('nl-NL') + ' · ' + x[1]]; }), '', function (path) { restoreFrom(path); });
        }
        restoreFrom(native.backupPath());
      }, 'btn sec'));
      p.appendChild(btn('Terugzetten van het laatste bestand', function () {
        const t = native.readText(native.backupPath());
        if (!t || t.charAt(0) !== '{') return toast('Geen back-up gevonden');
        try { JSON.parse(t); } catch (e) { return toast('De back-up is beschadigd'); }
        localStorage.setItem('luma.v1', t);
        toast('Teruggezet: de app start opnieuw');
        setTimeout(function () { location.reload(); }, 800);
      }, 'btn sec'));
    }
    p.appendChild(btn('Cache wissen', function () { if (native) native.clearCache(); toast('Cache gewist'); }, 'btn sec'));
    p.appendChild(btn('Voortgang, favorieten en herinneringen van dit profiel wissen', function () {
      store.resetProfile();
      bump();
      toast('Gewist');
      render(true);
    }, 'btn sec'));
    p.appendChild(row({ title: 'Kijkgeschiedenis', sub: store.historyList(500).length + ' titels', right: '›', onclick: function () { state.sub = 'hist'; render(); } }));
    p.appendChild(row({ title: 'Kijkstatistieken', sub: 'Tijd per dag en je meest bekeken zenders en titels', right: '›', onclick: function () { state.sub = 'stats'; render(); } }));
    p.appendChild(btn('Wat is er nieuw?', whatsNew, 'btn sec'));
    p.appendChild(btn('Probleem melden', reportProblem, 'btn sec'));
    p.appendChild(h('div', { class: 'sub', text: 'Luma TV ' + (native ? native.version() : 'voorbeeld') + ' · gegevens blijven op dit apparaat' }));
  }

  function paneForYou(p) {
    p.appendChild(h('h2', { text: 'Wat staat er op "Voor jou"? (dit profiel)' }));
    const base = [['cont', 'Verder kijken'], ['livenow', 'Live en straks'], ['mymatches', 'Jouw wedstrijden'], ['sportlive', 'Sport live'], ['groups', 'Groepen'], ['weekly', 'Jouw week'], ['next', 'Volgende aflevering'], ['good', 'Nu iets goeds op tv'], ['tvfilms', 'Aankomende films op tv'], ['evening', 'Film van de avond'], ['shared', 'Samen kijken'], ['both', 'Omdat jullie dit samen keken'], ['news', 'Nieuws'], ['week', 'Gezien deze week'], ['fresh', 'Nieuw toegevoegd'], ['fav', 'Mijn favoriete zenders'], ['live', 'Nu op tv'], ['list', 'Mijn lijst'], ['because', 'Omdat je iets keek'], ['vod', 'Films'], ['series', 'Series'], ['family', 'Wat het gezin kijkt']];
    const custom = crows().map(function (r) { return [r.key, '📌 ' + r.name, r]; });
    const all = base.concat(custom);
    const order = store.ui('rowsorder', '').split(',').filter(Boolean);
    all.sort(function (a2, b2) { const i = order.indexOf(a2[0]), j = order.indexOf(b2[0]); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    all.forEach(function (r, idx) {
      const line = h('div', { class: 'btns', style: { alignItems: 'center' } }, [
        toggleRow(r[1], '', on('row_' + r[0]), function () { setUi('row_' + r[0], on('row_' + r[0]) ? 'off' : 'on'); }),
        idx > 0 ? btn('▲', function () {
          const keys = all.map(function (z) { return z[0]; });
          const t = keys[idx]; keys[idx] = keys[idx - 1]; keys[idx - 1] = t;
          setUi('rowsorder', keys.join(','));
        }, 'chip') : null,
        r[2] ? btn('✕', function () { store.setUi('crows', JSON.stringify(crows().filter(function (c) { return c.key !== r[0]; }))); render(true); }, 'chip') : null
      ]);
      p.appendChild(line);
    });
    p.appendChild(h('div', { class: 'sub', text: 'Een eigen rij maak je in Live TV, Films of Series: kies een categorie en dan "Als rij op Voor jou".' }));
  }

  function paneImages(p) {
    p.appendChild(h('h2', { text: 'Beelden & info' }));
    p.appendChild(h('div', { class: 'msg', text: 'Live tv toont het beeld van het programma als je gids dat meelevert. Voor films en series kun je gratis posters en achtergronden van TMDB laten ophalen: maak een gratis account op themoviedb.org en plak je API-sleutel hieronder.' }));
    const k = h('input', { type: 'text', value: store.pref('tmdb') || '', placeholder: 'TMDB API-sleutel (v3)', autocapitalize: 'off', autocomplete: 'off' });
    k.addEventListener('input', function () { store.setPref('tmdb', k.value.trim()); });
    p.appendChild(h('label', { text: 'TMDB API-sleutel' }));
    p.appendChild(k);
    p.appendChild(choiceRow('Taal voor beschrijvingen', '', [['nl-NL', 'Nederlands'], ['en-US', 'Engels'], ['de-DE', 'Duits'], ['fr-FR', 'Frans']], store.pref('tmdblang') || 'nl-NL', function (v) { store.setPref('tmdblang', v); render(true); }));
    p.appendChild(toggleRow('Grote achtergrondafbeelding', 'Echte beelden achter het scherm', on('bgart'), function () { setUi('bgart', on('bgart') ? 'off' : 'on'); }));
    p.appendChild(h('div', { class: 'msg', text: 'Dit product gebruikt de TMDB API maar wordt niet onderschreven of gecertificeerd door TMDB.' }));
  }

  function fmtMs(ms) { const m = Math.round(ms / 60000); return m >= 60 ? Math.floor(m / 60) + 'u ' + (m % 60) + 'm' : m + ' min'; }

  function paneHist() {
    const root = h('div');
    const list = store.historyList(60);
    if (!list.length) root.appendChild(h('div', { class: 'msg', text: 'Nog niets bekeken.' }));
    list.forEach(function (e) {
      root.appendChild(row({ title: e.title, sub: (e.sub ? e.sub + ' · ' : '') + new Date(e.ts).toLocaleDateString('nl-NL') + (store.isWatched(e.id) ? ' · gezien' : ''), right: 'Afspelen', onclick: function () { resumeEntry(e); } }));
    });
    if (list.length) root.appendChild(btn('Geschiedenis wissen', function () { list.forEach(function (e) { store.removeProgress(e.id); }); bump(); render(true); }, 'btn sec'));
    return root;
  }

  function paneYear() {
    const root = h('div');
    const s = store.statsFor(365);
    const days = s.byDay.filter(function (d) { return d[1] > 0; }).length;
    root.appendChild(h('h2', { text: 'Het afgelopen jaar: ' + fmtMs(s.total) }));
    root.appendChild(h('div', { class: 'sub', text: 'Je keek op ' + days + ' dagen' + (days ? ', gemiddeld ' + fmtMs(s.total / days) + ' per dag.' : '.') }));
    const best = s.byDay.slice().sort(function (a2, b2) { return b2[1] - a2[1]; })[0];
    if (best && best[1]) root.appendChild(h('div', { class: 'sub', text: 'Drukste dag: ' + best[0] + ' (' + fmtMs(best[1]) + ')' }));
    root.appendChild(h('h2', { text: 'Je top 8' }));
    if (!s.top.length) root.appendChild(h('div', { class: 'msg', text: 'Nog geen gegevens: kijktijd wordt bijgehouden vanaf nu.' }));
    s.top.forEach(function (t, i) { root.appendChild(row({ title: (i + 1) + '. ' + t[0], sub: '', right: fmtMs(t[1]) })); });
    return root;
  }

  function paneStats() {
    const root = h('div');
    const s = store.statsFor(7);
    root.appendChild(h('h2', { text: 'Laatste 7 dagen: ' + fmtMs(s.total) }));
    const mx = Math.max.apply(null, s.byDay.map(function (d) { return d[1]; }).concat([1]));
    s.byDay.forEach(function (d) {
      const dn = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][new Date(d[0] + 'T12:00:00').getDay()];
      root.appendChild(row({ title: dn + ' ' + d[0].slice(8) + '-' + d[0].slice(5, 7), sub: '', right: fmtMs(d[1]), lead: h('div', { class: 'sbar' }, [h('i', { style: { width: Math.round(100 * d[1] / mx) + '%' } })]) }));
    });
    root.appendChild(h('h2', { text: 'Meest bekeken' }));
    if (!s.top.length) root.appendChild(h('div', { class: 'msg', text: 'Nog geen gegevens: kijktijd wordt bijgehouden vanaf nu.' }));
    s.top.forEach(function (t) { root.appendChild(row({ title: t[0], sub: '', right: fmtMs(t[1]) })); });
    return root;
  }

  function paneHidden() {
    const root = h('div');
    const ids = store.hiddenChannels();
    const names = {};
    if (state.lib) state.lib.live.forEach(function (c) { names[c.id] = c.name0 || c.name; });
    if (!ids.length) root.appendChild(h('div', { class: 'msg', text: 'Je hebt geen zenders verborgen.' }));
    ids.forEach(function (id) {
      root.appendChild(row({ title: names[id] || id, sub: '', right: 'Terugzetten', onclick: function () { store.setChan(id, { hide: false }); bump(); render(true); } }));
    });
    return root;
  }

  function whatsNew() {
    const seen = store.pref('wnseen') || '0';
    const fresh = RELEASES.filter(function (r) { return newerThan(r[0], seen); });
    const shown = (fresh.length ? fresh : RELEASES.slice(0, 1)).slice(0, 5);
    const kids = [h('h2', { text: 'Nieuw in Luma TV ' + (native ? native.version() : '') })];
    shown.forEach(function (r) {
      kids.push(h('h3', { text: 'Versie ' + r[0] }));
      kids.push(h('ul', { class: 'wn' }, r[1].map(function (n) { return h('li', { text: n }); })));
    });
    kids.push(h('div', { class: 'btns' }, [btn('Mooi', function () { store.setPref('wnseen', RELEASES[0][0]); closeModal(); })]));
    openModal(h('div', { class: 'dlg', style: { maxHeight: '80vh', overflow: 'auto' } }, kids));
  }

  function reportProblem() {
    const src = state.source ? (state.source.type + ' · ' + (state.source.name || '')) : 'geen bron';
    const lines = ['Luma TV ' + (native ? native.version() : '?'), 'Bron: ' + src, 'Laatste fout: ' + (state.lastError || 'geen'),
      'Zenders: ' + (state.lib ? state.lib.live.length : 0) + ', films: ' + (state.lib ? state.lib.vod.length : 0) + ', series: ' + (state.lib ? state.lib.series.length : 0),
      'Gids: ' + (state.epg ? state.epg.size : 0) + ' zenders', 'Geladen in: ' + (state.loadMs ? state.loadMs + ' ms' : '?'),
      'Scherm: ' + window.innerWidth + 'x' + window.innerHeight, 'Browser: ' + (navigator.userAgent.match(/Chrome\/[\d.]+/) || ['?'])[0]];
    if (native && native.errorLog) {
      try {
        const log = JSON.parse(native.errorLog());
        const by = {};
        log.forEach(function (e) { by[e.name] = by[e.name] || { n: 0, code: e.code }; by[e.name].n++; by[e.name].code = e.code; });
        const top = Object.keys(by).sort(function (a, b) { return by[b].n - by[a].n; }).slice(0, 6);
        lines.push('Afspeelfouten (' + log.length + '): ' + (top.length ? top.map(function (k) { return k + ' ' + by[k].n + '× ' + by[k].code; }).join('; ') : 'geen'));
      } catch (e) { lines.push('Afspeelfouten: onleesbaar'); }
    }
    const txt = lines.join('\n');
    const kids = [h('h2', { text: 'Probleem melden' }),
      h('p', { text: 'Dit zijn de technische gegevens, zonder inloggegevens. Open het adres hieronder op je telefoon om de tekst te kopiëren en door te sturen.' }),
      h('pre', { class: 'rep', text: txt })];
    if (native && native.setReport && native.startRemote) {
      native.setReport(txt);
      let url = state.remote && state.remote.url;
      if (!url) { url = native.startRemote(); if (url) state.remote = { url: url, svg: native.qr(url) }; }
      if (url) {
        const link = url.replace(/\/$/, '') + '/rapport';
        const pic = h('div', { class: 'qr' });
        pic.innerHTML = native.qr(link);
        kids.push(pic, h('div', { class: 'sub', style: { wordBreak: 'break-all' }, text: 'Rapport op je telefoon: ' + link }));
      }
    }
    if (native && native.saveText) native.saveText('luma-rapport.txt', txt);
    kids.push(h('div', { class: 'btns' }, [btn('Sluiten', closeModal)]));
    openModal(h('div', { class: 'dlg' }, kids));
  }

  function paneCats() {
    const root = h('div', { class: 'list' });
    const items = [];
    [['live', 'Live TV'], ['vod', 'Films'], ['series', 'Series']].forEach(function (k) {
      if (!state.lib) return;
      groupsOf(state.lib[k[0]].filter(function (x) { return !lockedNow(x.group); })).forEach(function (g) { items.push([k[1], g]); });
    });
    if (!items.length) return h('div', { class: 'msg', text: 'Laad eerst een bron.' });
    const n = state.shown.cats || 40;
    items.slice(0, n).forEach(function (it) {
      root.appendChild(toggleRow(it[1], it[0], !store.isHidden(it[1]), function () { store.toggleHidden(it[1]); bump(); render(true); }));
    });
    if (items.length > n) root.appendChild(btn('Meer tonen (' + (items.length - n) + ')', function () { state.shown.cats = n + 40; render(true); }, 'btn sec'));
    return root;
  }

  /** Long press on a programme in the guide: reminder, weekly reminder, or a recording. */
  function progMenu(c, p, isNow) {
    const items = [];
    if (isNow) items.push(['watch', 'Nu kijken']);
    if (p.stop <= Date.now() && c.archive) items.push(['catch', '⏪ Terugkijken']);
    if (!isNow) {
      items.push(['rem', store.hasReminder(c.id, p.start) ? '🔔 Herinnering verwijderen' : '🔔 Herinnering zetten']);
      items.push(['weekly', '🔁 Elke week herinneren']);
    }
    if (store.pref('tmdb')) items.push(['cast', 'Acteurs en regisseur']);
    if (native && native.record) items.push(['rec', isNow ? '● Nu opnemen' : '● Opnemen plannen']);
    if (native && native.record) items.push(['rule', '● Elke uitzending van dit programma opnemen']);
    pickList(p.title, items, '', function (v) {
      const base = { chId: c.id, chName: c.name, title: p.title, start: p.start, end: p.stop };
      if (v === 'cast') return showCast({ name: p.title, kind: p.cat && catOf(p.cat) === 'Serie' ? 'series' : 'vod' });
      if (v === 'catch') return playCatchup(c, p);
      if (v === 'watch') { const l = vis('live'); return play(l, l.indexOf(c)); }
      if (v === 'rem') { const set = store.toggleReminder(base); toast(set ? '🔔 Herinnering om ' + U.clock(p.start) : 'Herinnering verwijderd'); }
      if (v === 'weekly') { if (!store.hasReminder(c.id, p.start)) store.toggleReminder(Object.assign(base, { weekly: true })); toast('🔁 Elke week om ' + U.clock(p.start) + ': ' + p.title); }
      if (v === 'rule') { const rules = recRules(); if (!rules.some(function (x) { return x.chId === c.id && fold(x.title) === fold(p.title); })) rules.push({ chId: c.id, chName: c.name, title: p.title }); store.setUi('recrules', JSON.stringify(rules)); applyRecRules(); toast('● Alle uitzendingen van ' + p.title + ' worden opgenomen (de app moet aanstaan)'); }
      if (v === 'rec') {
        if (isNow) { startRecording(c, p.title, Math.max(1, Math.round((p.stop - Date.now()) / 60000))); }
        else { if (!store.hasReminder(c.id, p.start)) store.toggleReminder(Object.assign(base, { rec: true })); toast('● Opname gepland om ' + U.clock(p.start) + ' (de app moet dan aanstaan)'); }
      }
      render(true);
    });
  }

  function recRules() { try { return JSON.parse(store.ui('recrules', '[]')) || []; } catch (e) { return []; } }

  /** Schedules a recording for every coming broadcast that matches one of the rules (next 48 hours). */
  function applyRecRules() {
    const rules = recRules();
    if (!rules.length || !state.epg || !state.lib) return;
    const live = vis('live');
    const now = Date.now();
    rules.forEach(function (r) {
      const c = live.filter(function (x) { return x.id === r.chId; })[0];
      if (!c) return;
      state.epg.forChannel(c).forEach(function (p) {
        if (p.start > now && p.start < now + 48 * 3600000 && fold(p.title) === fold(r.title) && !store.hasReminder(c.id, p.start)) {
          store.toggleReminder({ chId: c.id, chName: c.name, title: p.title, start: p.start, end: p.stop, rec: true });
        }
      });
    });
  }

  function playCatchup(c, p) {
    const mins = Math.max(1, Math.round((p.stop - p.start) / 60000));
    play([{ id: 'cu' + U.hash(c.id + p.start), kind: 'vod', title: p.title, sub: c.name + ' · terugkijken', logo: c.logo, url: XT.catchupUrl(state.source, c.sid, p.start, mins) }], 0);
  }

  function startRecording(c, title, minutes) {
    if (!native || !native.record) return;
    const path = native.record(c.url, title || c.name, minutes || +store.ui('recmin', '60'), (state.source && state.source.ua) || '');
    toast(path ? '● Opname gestart: ' + (title || c.name) : 'Er loopt al een opname');
  }

  function paneReminders() {
    const wrap = h('div');
    wrap.appendChild(toggleRow('Geluidje bij een herinnering', '', store.ui('remsound', 'on') !== 'off', function () { setUi('remsound', store.ui('remsound', 'on') === 'off' ? 'on' : 'off'); }));
    wrap.appendChild(toggleRow('Zender automatisch openen', 'Na 10 seconden, tenzij je op Later drukt', store.ui('remauto', 'off') === 'on', function () { setUi('remauto', store.ui('remauto', 'off') === 'on' ? 'off' : 'on'); }));
    wrap.appendChild(paneRemList());
    return wrap;
  }

  function paneRemList() {
    const list = store.reminders().slice().sort(function (a, b) { return a.start - b.start; });
    if (!list.length) return h('div', { class: 'msg', text: 'Geen herinneringen. Kies in de gids een programma dat nog moet beginnen en druk op OK.' });
    return h('div', { class: 'list' }, list.map(function (r) {
      return row({ title: (r.rec ? '● ' : r.weekly ? '🔁 ' : '') + r.title, sub: r.chName + ' · ' + U.clock(r.start) + (r.rec ? ' · opname' : r.weekly ? ' · elke week' : ''), right: 'Verwijderen', onclick: function () { store.toggleReminder(r); render(true); } });
    }));
  }

  // ---------- updates and phone entry ----------
  function updMsg(t) {
    const el = $('upd');
    if (el) el.textContent = t;
    else toast(t);
  }

  window.lumaUpdateStatus = updMsg;

  const LAUNCHER_PKG = 'com.gathin.tvhome';

  async function checkUpdate(kind) {
    const url = UPD.releaseUrl(updateRepo(kind));
    if (!url) return updMsg('Geen repo ingesteld: vul js/config.js in en bouw opnieuw, of typ hem hierboven');
    if (!native) return updMsg('Updaten werkt alleen in de Luma TV-app');
    updMsg('Zoeken naar updates…');
    try {
      const rel = UPD.pickRelease(await fetchJson(url, 0));
      if (!rel) return updMsg('Geen release met een .apk-bestand gevonden');
      const cur = kind === 'launcher' ? native.packageVersion(LAUNCHER_PKG) : native.version();
      if (kind === 'launcher' && !cur) return updMsg('De launcher is niet geïnstalleerd; installeer die eerst met de Mac');
      if (!UPD.isNewer(rel.version, cur)) return updMsg('Je hebt de nieuwste versie (' + cur + ')');
      updMsg('Versie ' + rel.version + ' gevonden, downloaden…');
      native.installUpdate(rel.apkUrl);
    } catch (e) {
      updMsg('Controleren mislukt: ' + (e.message || e));
    }
  }

  function startRemote() {
    state.remoteError = '';
    if (!native || !native.startRemote) { state.remoteError = 'Dit werkt alleen in de Luma TV-app'; return render(true); }
    const url = native.startRemote();
    if (!url) { state.remoteError = 'Kon geen adres maken: is de tv verbonden met wifi?'; return render(true); }
    state.remote = { url: url, svg: native.qr(url) };
    render(true);
  }

  function stopRemote() {
    if (state.remote && native && native.stopRemote) native.stopRemote();
    state.remote = null;
  }

  // The phone sent a source through the QR page.
  window.lumaRemoteAdd = function (src) {
    if (!src || !src.type) return;
    const clean = src.type === 'xtream'
      ? { type: 'xtream', name: src.name || src.server, server: src.server, user: src.user, pass: src.pass, epg: src.epg || '', ua: src.ua || '' }
      : { type: 'm3u', name: src.name || 'Mijn lijst', url: src.url, epg: src.epg || '', ua: src.ua || '' };
    stopRemote();
    toast('Gegevens ontvangen van je telefoon');
    const saved = store.addSource(clean);
    loadSource(saved, true).then(function () { if (state.lib) { go('home'); setTimeout(sourceCheck, 800); } else render(); });
  };

  function saveForm() {
    const f = state.form;
    let src;
    if (f.type === 'xtream') {
      if (!f.server || !f.user || !f.pass) { state.error = 'Vul server, gebruikersnaam en wachtwoord in'; return render(true); }
      src = { type: 'xtream', name: f.name || f.server, server: f.server.trim(), user: f.user.trim(), pass: f.pass, epg: (f.epg || '').trim(), ua: (f.ua || '').trim() };
    } else {
      if (!/^https?:\/\//i.test((f.url || '').trim())) { state.error = 'Vul een geldige http(s)-link in'; return render(true); }
      src = { type: 'm3u', name: f.name || 'Mijn lijst', url: f.url.trim(), epg: (f.epg || '').trim(), ua: (f.ua || '').trim() };
    }
    const saved = store.addSource(src);
    state.form = { type: f.type };
    loadSource(saved, true).then(function () {
      if (state.lib) go('home');
    });
  }

  // ---------- shell ----------
  /** Builds the tabs at the top. Separate from render() so the Sport tab can appear without redrawing the page. */
  function buildNav() {
    const had = document.activeElement && navEl.contains(document.activeElement) ? Array.prototype.indexOf.call(navEl.children, document.activeElement) : -1;
    navEl.textContent = '';
    const tab = function (id, label, ic) {
      const t = h('button', { class: 'tab' + (ic ? ' icon' : '') + (state.view === id ? ' on' : ''), type: 'button', onclick: function () { go(id); } }, ic ? [icon(ic)] : [label]);
      if (id === 'home') t._lp = quickMenu;
      return t;
    };
    navEl.appendChild(tab('search', '', 'search'));
    const hasRadio = state.lib && vis('live').some(isRadio);
    const hasSport = state.lib && on('nav_sport') && sportList().length > 0;
    NAV.forEach(function (n) { if ((n[0] !== 'radio' || hasRadio) && (n[0] !== 'sport' || hasSport)) navEl.appendChild(tab(n[0], n[1])); });
    navEl.appendChild(tab('settings', '', 'settings'));
    if (had >= 0 && navEl.children[had]) navEl.children[had].focus({ preventScroll: true });
  }

  function render(keepFocus) {
    previewStop();
    if (!(state.view === 'settings' && state.setTab === 'sources' && !state.sub)) stopRemote();
    const prev = keepFocus ? document.activeElement : null;
    const prevKey = prev && prev.dataset ? prev.dataset.k : '';
    const keepScroll = keepFocus ? viewEl.scrollTop : 0;
    const oldRows = keepFocus ? document.querySelector('.rows') : null;
    const keepRows = oldRows ? oldRows.scrollTop : 0;
    const oldG = keepFocus ? document.querySelector('.gscroll') : null;
    const gx = oldG ? oldG.scrollLeft : 0;
    const gy = oldG ? oldG.scrollTop : 0;
    const cols = keepFocus ? Array.prototype.map.call(document.querySelectorAll('.lcol'), function (e) { return e.scrollTop; }) : [];
    buildNav();
    setHero({ title: '', key: 'luma' });
    let v;
    if (state.show && state.view === 'series') v = vShow();
    else if (state.view === 'live') v = vLive();
    else if (state.view === 'radio') v = vRadio();
    else if (state.view === 'guide') v = vGuide();
    else if (state.view === 'sport') v = vSport();
    else if (state.view === 'vod') v = vShelf('vod', 'films', 'Films');
    else if (state.view === 'series') v = vShelf('series', 'series', 'Series');
    else if (state.view === 'search') v = vSearch();
    else if (state.view === 'settings') v = vSettings();
    else v = vHome();
    const banner = [];
    if (state.loading && state.view !== 'settings') banner.push(h('div', { class: 'msg', text: state.loading }));
    if (state.error && state.view !== 'settings') banner.push(h('div', { class: 'msg err', text: state.error }));
    if (banner.length && v.classList.contains('page')) banner.reverse().forEach(function (b) { v.insertBefore(b, v.firstChild); });
    else if (banner.length) { const hero = v.querySelector('.hero'); banner.forEach(function (b) { if (hero) hero.appendChild(b); }); }
    viewEl.textContent = '';
    viewEl.appendChild(v);
    syncSlides();
    snapScan();
    viewEl.scrollTop = keepScroll;
    viewEl.classList.toggle('nosc', !!v.querySelector('.hmw'));
    const newRows = document.querySelector('.rows');
    if (newRows && keepRows) newRows.scrollTop = keepRows;
    const newG = document.querySelector('.gscroll');
    if (newG && oldG) { newG.scrollLeft = gx; newG.scrollTop = gy; }
    Array.prototype.forEach.call(document.querySelectorAll('.lcol'), function (e, i) { if (cols[i]) e.scrollTop = cols[i]; });
    if (document.querySelector('.who') || modalOpen()) return;
    if (prev && prev.id === 'prof') { $('prof').focus({ preventScroll: true }); return; }
    if (prev && !autoFocus) {
      let same = null;
      if (prevKey) same = document.querySelector('[data-k="' + prevKey.replace(/"/g, '') + '"]');
      else if (prev.tagName === 'BUTTON' && prev.textContent) {
        same = Array.prototype.find.call(document.querySelectorAll('#view button, #nav button'), function (b) { return b.textContent === prev.textContent; });
      }
      if (same) { same.focus({ preventScroll: true }); if (same._info) setHero(same._info); if (same._ginfo) guideInfo(same._ginfo); if (same._linfo) liveInfo(same._linfo); return; }
    }
    focusFirst();
  }

  let autoFocus = false;
  document.addEventListener('keydown', function () { autoFocus = false; }, true);
  function focusFirst() {
    autoFocus = true;
    const t = viewEl.querySelector('.hmw .rail button') || viewEl.querySelector('.gp.now') || viewEl.querySelector('.lch') || viewEl.querySelector('.split .card') || viewEl.querySelector('.gname') || viewEl.querySelector('button, input');
    const target = t || navEl.querySelector('button');
    target.focus({ preventScroll: true });
    if (target._info) heroFor(target._info);
    if (target._ginfo) guideInfo(target._ginfo);
    if (target._linfo) liveInfo(target._linfo);
  }

  function go(view) {
    if (view === 'settings' && isKid()) {
      if (!pin()) { toast('Instellingen zijn niet beschikbaar voor een kinderprofiel'); return; }
      return askPin('Pincode voor Instellingen', function (v) { if (v !== pin()) return false; open(); return true; });
    }
    open();
    function open() {
      state.view = view;
      state.show = null;
      state.sub = null;
      render();
    }
  }

  // ---------- stills of what is on ----------
  const SNAP_TTL = 10 * 60000;
  const snaps = {};
  const snapBad = {};
  let snapBusy = '';
  let snapTimer = 0;
  let snapGuard = 0;

  function snapGet(id) { const s = snaps[id]; return s && Date.now() - s.t < SNAP_TTL ? s.u : ''; }

  function applySnap(el, data, c) {
    const a = el.querySelector('.art');
    if (!a) return;
    a.classList.add('photo');
    a.style.backgroundImage = 'url("' + data + '")';
    const ini = a.querySelector('.ini');
    if (ini) ini.remove();
    if (c && c.logo && !a.querySelector('.chlogo')) a.appendChild(h('div', { class: 'chlogo', style: { backgroundImage: art(c.logo) } }));
  }

  function snapScan() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(snapNext, 700);
  }

  function snapNext() {
    if (snapBusy || pvOn || modalOpen() || state.view !== 'home' || !native || !native.snap || !on('livesnap')) return;
    const rows = document.querySelector('.rows');
    if (!rows) return;
    const rr = rows.getBoundingClientRect();
    const f = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.shelf') : null;
    const now = Date.now();
    const cands = [];
    Array.prototype.forEach.call(rows.querySelectorAll('.card.live'), function (el) {
      if (!el._cid || !el._pv || snapGet(el._cid) || (snapBad[el._cid] && now - snapBad[el._cid] < 120000)) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < rr.top || r.top > rr.bottom || r.right < 0 || r.left > window.innerWidth) return;
      cands.push({ el: el, pri: (el.closest('.shelf') === f ? 0 : 1) * 10000 + Math.abs(r.left) });
    });
    if (!cands.length) return;
    cands.sort(function (x, y) { return x.pri - y.pri; });
    const el = cands[0].el;
    snapBusy = el._cid;
    clearTimeout(snapGuard);
    snapGuard = setTimeout(function () { if (snapBusy) { snapBad[snapBusy] = Date.now(); snapBusy = ''; snapNext(); } }, 15000);
    try { native.snap(el._cid, el._pv, (state.source && state.source.ua) || ''); } catch (e) { snapBusy = ''; }
  }

  window.lumaSnap = function (id, data) {
    if (id !== snapBusy) return;
    clearTimeout(snapGuard);
    snapBusy = '';
    if (data) {
      snaps[id] = { t: Date.now(), u: data };
      Array.prototype.forEach.call(document.querySelectorAll('.card.live'), function (el) { if (el._cid === id) applySnap(el, data, null); });
    } else snapBad[id] = Date.now();
    setTimeout(snapNext, 400);
  };

  // Live picture inside the selected card: one at a time, muted, after a short pause.
  let pvTimer = 0;
  let pvOn = false;
  function previewStop() {
    clearTimeout(pvTimer);
    if (pvOn && native && native.previewStop) { try { native.previewStop(); } catch (e) { /* ignore */ } }
    if (pvOn) snapScan();
    pvOn = false;
  }
  function previewSoon(el) {
    previewStop();
    if (!native || !native.preview || !el || !el._pv || !on('livepv') || state.view !== 'home' || modalOpen()) return;
    pvTimer = setTimeout(function () {
      if (document.activeElement !== el || !el.isConnected || modalOpen()) return;
      const art0 = el.querySelector('.art');
      const rows = el.closest('.rows');
      if (!art0 || !rows) return;
      const r = art0.getBoundingClientRect();
      const rr = rows.getBoundingClientRect();
      if (r.top < rr.top + 4 || r.bottom > rr.bottom - 4 || r.left < 0 || r.right > window.innerWidth) return;
      const d = window.devicePixelRatio || 1;
      const rad = (parseFloat(getComputedStyle(art0).borderTopLeftRadius) || 0) * d;
      try {
        native.preview(el._pv, (state.source && state.source.ua) || '', Math.round(r.left * d), Math.round(r.top * d), Math.round(r.width * d), Math.round(r.height * d), Math.round(rad));
        pvOn = true;
      } catch (e) { /* ignore */ }
    }, 1500);
  }

  let heroTimer = 0;
  document.addEventListener('focusin', function (e) {
    const t = e.target;
    previewSoon(t);
    snapScan();
    if (!t) return;
    if (t._ginfo) return guideInfo(t._ginfo);
    if (t._linfo) liveInfo(t._linfo);
    if (!t._info) return;
    clearTimeout(heroTimer);
    heroTimer = setTimeout(function () { heroFor(t._info); }, 90);
  });

  // ---------- D-pad navigation ----------
  function scope() {
    return document.querySelector('.who') || (modalOpen() ? modalEl : document);
  }

  function guideBox() {
    const gs = document.querySelector('.gscroll');
    if (!gs) return null;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const g = gs.getBoundingClientRect();
    return { gs: gs, g: g, rem: rem, left: g.left + GNAME * rem, top: g.top + 5 * rem };
  }

  function focusables() {
    const gb = guideBox();
    return Array.prototype.filter.call(scope().querySelectorAll('button, input'), function (e) {
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0) || e.disabled) return false;
      if (r.bottom < -600 || r.top > innerHeight + 600) return false;
      if (gb && e.closest('.gscroll') && !e.closest('.gh')) {
        if (e.classList.contains('gp') && r.right <= gb.left + gb.rem) return false;
        if (r.bottom <= gb.top) return false;
      }
      return true;
    });
  }

  function reveal(el) {
    const gb = guideBox();
    if (gb && gb.gs.contains(el) && !el.closest('.gh')) {
      const r = el.getBoundingClientRect();
      if (el.classList.contains('gp')) {
        if (r.left < gb.left + gb.rem) gb.gs.scrollLeft -= gb.left + gb.rem - r.left;
        else if (r.right > gb.g.right - gb.rem) gb.gs.scrollLeft += r.right - (gb.g.right - gb.rem);
      }
      if (r.top < gb.top) gb.gs.scrollTop -= gb.top - r.top;
      else if (r.bottom > gb.g.bottom) gb.gs.scrollTop += r.bottom - gb.g.bottom;
      return;
    }
    if (el.closest('#top')) { viewEl.scrollTop = 0; return; }
    const rows = el.closest('.rows');
    if (rows) {
      const sh = el.closest('.shelf');
      const rr = rows.getBoundingClientRect();
      if (sh) {
        const want = sh.getBoundingClientRect().top - rr.top + rows.scrollTop;
        if (Math.abs(rows.scrollTop - want) > 4) rows.scrollTo({ top: want, behavior: 'smooth' });
        const rail = el.closest('.rail');
        if (rail) {
          const er = el.getBoundingClientRect(), lr = rail.getBoundingClientRect();
          const pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
          if (er.left < lr.left + pad) rail.scrollTo({ left: rail.scrollLeft - (lr.left + pad - er.left), behavior: 'smooth' });
          else if (er.right > lr.right - pad) rail.scrollTo({ left: rail.scrollLeft + (er.right - lr.right + pad), behavior: 'smooth' });
        }
      } else {
        rows.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  let audio = null;
  function tick1() {
    if (store.ui('sounds', 'off') !== 'on') return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 720; g.gain.value = 0.04;
      o.connect(g); g.connect(audio.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.05); o.stop(audio.currentTime + 0.06);
    } catch (e) { /* no audio */ }
  }

  function move(dir) {
    tick1();
    const cur = document.activeElement;
    const list = focusables();
    if (!cur || list.indexOf(cur) < 0) { if (list.length) { list[0].focus({ preventScroll: true }); reveal(list[0]); } return; }
    const a = cur.getBoundingClientRect();
    const ac = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    // In the guide up and down stay in the neighbouring row, on the programme at the same time.
    const grow = cur.closest('.gr');
    if (dir === 'left' && cur.classList.contains('gname')) return;
    if (grow && (dir === 'up' || dir === 'down')) {
      const nr = dir === 'down' ? grow.nextElementSibling : grow.previousElementSibling;
      if (nr && nr.classList.contains('gr')) {
        const cands = Array.prototype.filter.call(nr.querySelectorAll('button'), function (e) { return list.indexOf(e) >= 0 || e.classList.contains('gname'); });
        let pick = null;
        let d = Infinity;
        const x = cur.classList.contains('gname') ? -1 : ac.x;
        cands.forEach(function (e) {
          const r = e.getBoundingClientRect();
          const dist = x < 0 ? (e.classList.contains('gname') ? 0 : 1e6) : (r.left <= x && x <= r.right ? 0 : Math.min(Math.abs(r.left - x), Math.abs(r.right - x)));
          if (dist < d) { d = dist; pick = e; }
        });
        if (pick) { pick.focus({ preventScroll: true }); reveal(pick); return; }
      }
    }
    // Voor jou: up and down always go to the neighbouring row, on the card closest to where you are.
    const curShelf = cur.closest('.rows .shelf');
    if (curShelf && cur.closest('.rail') && (dir === 'up' || dir === 'down')) {
      let sib = dir === 'down' ? curShelf.nextElementSibling : curShelf.previousElementSibling;
      while (sib && !(sib.classList.contains('shelf') && sib.querySelector('.rail button'))) sib = dir === 'down' ? sib.nextElementSibling : sib.previousElementSibling;
      if (sib) {
        let pick = null;
        let d = Infinity;
        Array.prototype.forEach.call(sib.querySelectorAll('.rail button'), function (e) {
          if (list.indexOf(e) < 0) return;
          const r = e.getBoundingClientRect();
          const dist = r.left <= ac.x && ac.x <= r.right ? 0 : Math.min(Math.abs(r.left - ac.x), Math.abs(r.right - ac.x));
          if (dist < d) { d = dist; pick = e; }
        });
        if (pick) { pick.focus({ preventScroll: true }); reveal(pick); return; }
      }
    }
    let best = null;
    let bestScore = Infinity;
    list.forEach(function (el) {
      if (el === cur) return;
      const r = el.getBoundingClientRect();
      const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      let primary;
      let secondary;
      if (dir === 'left') { primary = a.left - r.right + 1; if (c.x >= ac.x) return; secondary = Math.abs(c.y - ac.y); }
      else if (dir === 'right') { primary = r.left - a.right + 1; if (c.x <= ac.x) return; secondary = Math.abs(c.y - ac.y); }
      else if (dir === 'up') { primary = a.top - r.bottom + 1; if (c.y >= ac.y) return; secondary = Math.abs(c.x - ac.x); }
      else { primary = r.top - a.bottom + 1; if (c.y <= ac.y) return; secondary = Math.abs(c.x - ac.x); }
      if (primary < -a.height) return;
      // In the guide, going up or down should land on the programme at the same time, so compare left edges.
      if ((dir === 'up' || dir === 'down') && el.classList.contains('gp') && cur.classList.contains('gp')) secondary = Math.abs(r.left - a.left);
      const score = Math.max(0, primary) + secondary * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
      best.focus({ preventScroll: true });
      reveal(best);
    }
  }

  const lp = { timer: 0, el: null, done: false };
  // T9: on the live list, digits pick a channel by number or by the letters on the phone keypad.
  const T9 = { a: 2, b: 2, c: 2, d: 3, e: 3, f: 3, g: 4, h: 4, i: 4, j: 5, k: 5, l: 5, m: 6, n: 6, o: 6, p: 7, q: 7, r: 7, s: 7, t: 8, u: 8, v: 8, w: 9, x: 9, y: 9, z: 9 };
  let t9buf = '';
  let t9timer = null;
  function t9Key(d) {
    t9buf += d;
    clearTimeout(t9timer);
    t9timer = setTimeout(function () { t9buf = ''; }, 1500);
    const list = liveFiltered();
    const digits = function (name) { return fold(name).replace(/ /g, '').split('').map(function (ch) { return T9[ch] || ch; }).join(''); };
    let i = list.findIndex(function (c) { return String(c.no) === t9buf; });
    if (i < 0) i = list.findIndex(function (c) { return digits(c.name).indexOf(t9buf) === 0; });
    if (i < 0) i = list.findIndex(function (c) { return String(c.no).indexOf(t9buf) === 0; });
    toast(t9buf + (i >= 0 ? '  →  ' + list[i].name : '  (niets)'));
    if (i < 0) return;
    if (i >= (state.shown.live || 60)) { state.shown.live = i + 20; render(true); }
    const el = document.querySelector('.lch[data-k="' + list[i].id + '"]');
    if (el) { el.focus({ preventScroll: true }); reveal(el); }
  }

  function moveChannel(delta) {
    const list = liveFiltered();
    const i = list.findIndex(function (c) { return c.id === state.moving; });
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    const na = a.no, nb = b.no;
    store.setChan(a.id, { num: nb });
    store.setChan(b.id, { num: na });
    bump();
    render(true);
    const el = document.querySelector('.lch[data-k="' + a.id + '"]');
    if (el) { el.focus({ preventScroll: true }); reveal(el); }
  }

  document.addEventListener('keydown', function (e) {
    if (state.moving) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); return moveChannel(e.key === 'ArrowUp' ? -1 : 1); }
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); state.moving = null; toast('Zender staat op zijn plek'); render(true); return; }
    }
    const t = e.target;
    if (state.view === 'live' && !state.moving && /^[0-9]$/.test(e.key) && !(t && t.tagName === 'INPUT') && modalEl.hidden && !document.querySelector('.who')) { e.preventDefault(); return t9Key(e.key); }
    if (e.key === 'Enter' && t && t._lp) {
      e.preventDefault();
      if (!e.repeat && !lp.el) {
        lp.el = t;
        lp.done = false;
        lp.timer = setTimeout(function () { lp.done = true; if (lp.el && lp.el._lp) lp.el._lp(); }, 600);
      }
      return;
    }
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const dir = map[e.key];
    if (!dir) return;
    if (t && t.tagName === 'INPUT' && (dir === 'left' || dir === 'right')) return;
    e.preventDefault();
    move(dir);
  });
  document.addEventListener('keyup', function (e) {
    if (e.key !== 'Enter' || !lp.el) return;
    clearTimeout(lp.timer);
    const el = lp.el;
    lp.el = null;
    e.preventDefault();
    if (!lp.done && el.isConnected) el.click();
  });

  $('prof').addEventListener('click', function () { showWho(true); });
  $('prof')._lp = function () {
    const ps = store.profiles();
    if (ps.length < 2) return;
    const cur = store.profile();
    const next = ps[(ps.findIndex(function (x) { return x.id === cur.id; }) + 1) % ps.length];
    if (isKid() && pin()) return askPin('Pincode om van profiel te wisselen', function (v) { if (v !== pin()) return false; chooseProfile(next); toast('Profiel: ' + next.name); return true; });
    chooseProfile(next);
    toast('Profiel: ' + next.name);
  };

  // ---------- start ----------
  function startView() {
    return (new Date().getHours() >= 18 && store.ui('startev', '')) ? store.ui('startev') : store.ui('start', 'home');
  }

  function softLimit() {
    const h2 = +store.ui('softlimit', '0');
    if (!h2) return;
    const today = new Date().toISOString().slice(0, 10);
    if (store.ui('softday', '') === today) return;
    if (store.statsFor(1).total < h2 * 3600000 || modalOpen()) return;
    setUi('softday', today);
    openModal(h('div', { class: 'dlg' }, [h('h2', { text: 'Je kijkt al ' + h2 + ' uur vandaag' }), h('div', { class: 'sub', text: 'Misschien tijd voor een pauze? Dit is alleen een herinnering.' }), h('div', { class: 'btns' }, [btn('Ik kijk door', closeModal), btn('Slaaptimer 15 min', function () { closeModal(); toast('Zet in de speler de slaaptimer aan met de actiebalk'); }, 'btn sec')])]));
  }

  function tick() {
    softLimit();
    const d = new Date();
    $('clock').textContent = U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
    if (store.ui('theme', 'dark') === 'auto') applyTheme();
  }

  function boot() {
    applyTheme();
    const tg = document.querySelector('#intro .tagl');
    if (tg) tg.textContent = 'Welkom, ' + store.profile().name;
    state.view = startView();
    const src = store.active();
    state.askWho = store.profiles().length > 1 && store.pref('ask') !== 'off';
    if (src) loadSource(src, false);
    else { render(); introDone(); }
    setTimeout(function () { introDone(true); }, 45000);
    setTimeout(startupChecks, 6000);
  }

  function cleanRecordings() {
    const days = +store.ui('recdays', '0');
    if (!native || !native.recordings || !days) return;
    try {
      JSON.parse(native.recordings()).forEach(function (r) { if (Date.now() - r.time > days * 86400000) native.deleteRecording(r.path); });
    } catch (e) { /* nothing to clean */ }
  }

  function quickMenu() {
    pickList('Snel naar', [['surprise', '🎲 Verras me met een zender'], ['recent', '⟲ Laatste zenders'], ['live', 'Live TV'], ['guide', 'Gids'], ['rec', 'Opnames'], ['health', 'Zenders en fouten'], ['set', 'Instellingen'], ['who', 'Van profiel wisselen']], '', function (v) {
      if (v === 'surprise') return surprise();
      if (v === 'recent') {
        const l = vis('live');
        const rc = store.recent().map(function (id) { return l.filter(function (c) { return c.id === id; })[0]; }).filter(Boolean).slice(0, 10);
        if (!rc.length) return toast('Nog geen zenders bekeken');
        return pickList('Laatste zenders', rc.map(function (c, i) { return [String(i), c.name]; }), '', function (n) { play(l, l.indexOf(rc[+n])); });
      }
      if (v === 'rec' || v === 'health') { state.setTab = v; return go('settings'); }
      if (v === 'set') return go('settings');
      if (v === 'who') return showWho(true);
      go(v);
    });
  }

  function applyCalm() {
    const z = +store.ui('fontscale', '1') || 1;
    document.body.style.zoom = z === 1 ? '' : String(z);
    document.body.classList.toggle('calm', store.ui('calm', 'off') === 'on');
  }
  setInterval(applyCalm, 15000);

  function nightRange() {
    const f = +store.ui('nightfrom', '-1');
    const t = +store.ui('nightto', '7');
    return f >= 0 ? [f, t] : null;
  }
  function applyNightLook() {
    const r = nightRange();
    const hr = new Date().getHours();
    const inside = r && (r[0] <= r[1] ? hr >= r[0] && hr < r[1] : hr >= r[0] || hr < r[1]);
    document.body.classList.toggle('warm', !!inside);
  }
  setInterval(applyNightLook, 60000);

  function alertWords() { return store.ui('alertwords', '').split(',').map(function (x) { return fold(x.trim()); }).filter(Boolean); }
  const alerted = {};
  function checkAlerts() {
    const words = alertWords();
    if (!words.length || !state.lib || !state.epg || !state.epg.size || modalOpen()) return;
    const now = Date.now();
    const list = vis('live');
    for (let i = 0; i < list.length && i < 3000; i++) {
      const c = list[i];
      const pr = state.epg.forChannel(c);
      for (let j = 0; j < pr.length; j++) {
        const p = pr[j];
        if (p.start < now || p.start - now > 10 * 60000) continue;
        const key = c.id + '|' + p.start;
        if (alerted[key]) continue;
        const t = fold(p.title);
        if (!words.some(function (w) { return t.indexOf(w) >= 0; })) continue;
        alerted[key] = 1;
        chime();
        openModal(h('div', { class: 'dlg' }, [
          h('h2', { text: p.title }),
          h('div', { class: 'sub', text: c.name + ' · begint om ' + U.clock(p.start) }),
          h('div', { class: 'btns' }, [btn('Nu kijken', function () { closeModal(); play(list, i); }), btn('Later', closeModal, 'btn sec')])
        ]));
        return;
      }
    }
  }
  setInterval(checkAlerts, 60000);

  function familyWeek() {
    const rows = store.statsAll(7).sort(function (a, b) { return b.ms - a.ms; });
    openModal(h('div', { class: 'dlg' }, [h('h2', { text: 'Kijktijd deze week' })].concat(rows.map(function (r) {
      return h('div', { class: 'sub', text: r.name + ': ' + (r.ms >= 3600000 ? (r.ms / 3600000).toFixed(1) + ' uur' : Math.round(r.ms / 60000) + ' min') + (r.top ? ' · meest ' + r.top : '') });
    })).concat([h('div', { class: 'btns' }, [btn('Sluiten', closeModal)])])));
  }

  async function loadNews() {
    const url = store.pref('rss');
    if (!url) { state.news = []; return; }
    try {
      const t = await fetchText(url, 1800);
      const doc = new DOMParser().parseFromString(t, 'text/xml');
      const items = Array.prototype.slice.call(doc.querySelectorAll('item, entry')).slice(0, 15);
      state.news = items.map(function (it) {
        const g = function (n) { const e = it.querySelector(n); return e ? e.textContent.trim() : ''; };
        return { title: g('title'), desc: g('description').replace(/<[^>]*>/g, '').slice(0, 400) || g('summary'), src: (doc.querySelector('channel > title, feed > title') || {}).textContent || 'Nieuws' };
      }).filter(function (n) { return n.title; });
      if (state.view === 'home') render(true);
    } catch (e) { state.news = []; }
  }

  /** Looks for things that are quietly wrong and says so, instead of failing without a word. */
  function selfCheck() {
    const issues = [];
    ['LumaMeta', 'LumaStore'].forEach(function (n) { if (!window[n]) issues.push('Onderdeel ' + n + ' is niet geladen'); });
    if (state.corrupt) issues.push('Je opgeslagen gegevens waren beschadigd en zijn leeg gestart' + (native && native.backups ? ': zet een back-up terug onder Onderhoud' : ''));
    if (native) {
      ['play', 'version', 'probe', 'record', 'saveText'].forEach(function (f) { if (typeof native[f] !== 'function') issues.push('De app mist de functie ' + f + ': installeer de nieuwste versie opnieuw'); });
    }
    if (store.active() && !store.sources().some(function (x) { return x.id === store.active().id; })) issues.push('De gekozen bron bestaat niet meer');
    if (!issues.length) return;
    state.lastError = issues.join('; ');
    if (!modalOpen()) openModal(h('div', { class: 'dlg' }, [h('h2', { text: 'Zelfcontrole' })].concat(issues.map(function (t) { return h('div', { class: 'sub', text: '• ' + t }); })).concat([h('div', { class: 'btns' }, [btn('Sluiten', closeModal)])])));
  }

  function startupChecks() {
    setTimeout(selfCheck, 2500);
    loadNews();
    applyNightLook();
    applyCalm();
    if (native && native.saveText && native.pruneBackups) {
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      if (store.pref('bakday') !== day) {
        store.setPref('bakday', day);
        native.saveText('luma-backup-' + day + '.json', localStorage.getItem('luma.v1') || '{}');
        native.pruneBackups('luma-backup-', 5);
      }
    }
    cleanRecordings();
    const ver = native ? native.version() : '';
    if (ver && store.pref('ver') !== ver) {
      if (store.pref('ver') || !store.pref('wnseen')) {
        if (native && native.saveText) native.saveText('luma-backup.json', localStorage.getItem('luma.v1') || '{}');
        whatsNew();
      }
      store.setPref('ver', ver);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (native && ver && store.pref('updchk') !== today && updateRepo('app')) {
      store.setPref('updchk', today);
      fetchJson(UPD.releaseUrl(updateRepo('app')), 0).then(function (j) {
        const rel = UPD.pickRelease(j);
        if (rel && UPD.isNewer(rel.version, ver)) { state.update = rel.version; toast('Update ' + rel.version + ' beschikbaar: Instellingen → Updates'); if (state.view === 'home') render(true); }
      }).catch(function () {});
    }
  }

  tick();
  setInterval(tick, 20000);
  setInterval(remindersTick, 15000);
  setInterval(function () {
    const d = new Date();
    const day = d.toISOString().slice(0, 10);
    if (d.getHours() === 4 && store.pref('night') === 'on' && store.pref('nightday') !== day && store.active() && !document.querySelector('.who')) {
      store.setPref('nightday', day);
      loadSource(store.active(), true);
    }
    if (d.getMinutes() === 0) applyRecRules();
  }, 60000);
  setInterval(checkAlarm, 20000);
  boot();
})();
