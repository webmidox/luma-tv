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
  const NAV = [['home', 'Voor jou'], ['live', 'Live TV'], ['radio', 'Radio'], ['guide', 'Gids'], ['vod', 'Films'], ['series', 'Series']];
  const ICONS = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
  };
  const GPX = 0.9; // rem per minute in the guide
  const VERSION_NOTES = ['Nieuwe startintro met laadscherm', 'Echte beelden: programma-afbeeldingen uit de gids en (optioneel) achtergronden via TMDB', 'Zendermenu (OK ingedrukt houden): favoriet, zapplijst, verbergen, eigen nummer en naam', 'Gids: genres in kleur, zoeken, dagen, vanavond, compacte rijen, tijdcorrectie', 'Speler: snelheid, beeldverhouding, ondertitels, audiotaal, slaaptimer, intro overslaan, volgende aflevering', 'Mijn lijst, gezien-vinkjes, kijkgeschiedenis, statistieken, radio en meer thema\'s'];
  const GNAME = 36; // rem, width of the channel column in the guide

  const state = {
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
  const intro = { t0: Date.now(), done: false };
  function introStatus(t) { const e = $('intro-status'); if (e) e.textContent = t; }
  function introDone() {
    if (intro.done) return;
    intro.done = true;
    const el = $('intro');
    if (!el) return;
    const wait = Math.max(0, (store.pref('intro') === 'off' ? 0 : 2600) - (Date.now() - intro.t0));
    setTimeout(function () {
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
    const badge = o.badge || (o.fav ? '★' : '');
    if (badge) a.appendChild(h('div', { class: 'badge', text: badge }));
    const meta = [h('div', { class: 't', text: o.title })];
    if (o.sub) meta.push(h('div', { class: 's', text: o.sub }));
    const b = h('button', { class: 'card ' + (poster ? 'poster' : 'wide') + (o.kind === 'live' ? ' live' : ''), type: 'button', onclick: o.onclick }, [a, h('div', { class: 'meta' }, meta)]);
    b._info = { title: o.heroTitle || o.title, sub: o.heroSub || o.sub || '', desc: o.desc || '', logo: o.logo, photo: o.photo || '', backdrop: '', kind: o.kind, tag: o.tag || '', key: o.key || o.title, hint: o.hint || '', name: o.metaName || '', mkind: o.metaKind || '' };
    if (o.lp) b._lp = o.lp;
    return b;
  }

  /** Puts the focused tile's colours and text behind the screen. The background is always a calm colour wash, never a picture. */
  function setHero(info) {
    if (!info) return;
    const bd = $('backdrop');
    const fill = $('bdfill');
    if (fill) fill.classList.remove('on');
    bd.classList.remove('photo', 'poster', 'logo');
    const seed = info.key || info.title;
    if (setHero.last !== seed && on('effects')) {
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
    set('h-tag', info.tag);
    set('h-title', info.title);
    set('h-sub', info.sub);
    set('h-desc', info.desc);
    set('h-hint', info.hint);
    const hero = document.querySelector('.hero');
    if (hero && on('effects')) { hero.classList.remove('swp'); void hero.offsetWidth; hero.classList.add('swp'); }
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

  function shelf(title, cards) {
    return h('section', { class: 'shelf' }, [h('h2', { text: title }), h('div', { class: 'rail' }, cards)]);
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
    introStatus('Bibliotheek laden…');
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
      introDone();
      return;
    }
    lib.live.forEach(function (c, i) { c.no = i + 1; c.no0 = i + 1; c.name0 = c.name; c.group0 = c.group; c.logo0 = c.logo; });
    state.loadMs = Date.now() - t0;
    state.source = src;
    state.lib = lib;
    state.epg = null;
    state.loading = '';
    bump();
    render();
    introDone();
    const before = store.seen(src.id);
    store.setSeen(src.id, lib.live.length);
    if (before && lib.live.length > before) toast((lib.live.length - before) + ' nieuwe zenders in je lijst');
    if (epgUrl) { introStatus('Gids laden…'); loadEpg(epgUrl, lib, ua, force); }
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
      introStatus('Gids geladen');
      applyRecRules();
      if (!modalOpen() && (state.view === 'home' || state.view === 'live' || state.view === 'guide')) render(true);
    } catch (e) {
      // The guide is optional; channels still work without it.
    }
  }

  /** Starts the last watched channel right away when the profile asks for it. */
  function autoStart() {
    if (!native || store.ui('autolive', 'off') !== 'on' || document.querySelector('.who')) return;
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

  function progsFor(c, n, desc) {
    if (!state.epg) return [];
    const now = Date.now();
    return state.epg.forChannel(c).filter(function (p) { return p.stop > now; }).slice(0, n || 4).map(function (p, i) {
      return [p.start, p.stop, p.title, i === 0 && desc !== false ? (p.desc || '').slice(0, 280) : ''];
    });
  }

  function play(list, index, opts) {
    opts = opts || {};
    const live = list[index].kind === 'live';
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
      subScale: +store.ui('subsize', '1'), tsAuto: store.ui('tsauto', 'off') === 'on', recMin: +store.ui('recmin', '60'), alang: store.ui('alang', ''), slang: store.ui('slang', 'off'), maxH: +store.ui('maxh', '0'), autoNext: on('autonext'), skipMs: +store.ui('skipsecs', '85') * 1000,
      favs: store.favs(), recent: store.recent().slice(0, 6),
      list: list.map(function (it, k) {
        state.playMeta[it.id] = it.meta || it;
        const o = { id: it.id, title: it.title || it.name, url: it.url };
        if (live) { if (state.lib && on('backup')) o.alt = altUrls(it); o.logo = it.logo || ''; o.num = it.no || 0; o.group = it.group || ''; o.p = k === index ? progsFor(it, 4) : progsFor(it, 1, false); }
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

  window.lumaBack = function () {
    if (modalOpen()) { closeModal(); return true; }
    if (state.show) { state.show = null; render(); return true; }
    if (state.view === 'settings' && state.sub) { state.sub = null; render(); return true; }
    if (state.view !== 'home') { go('home'); return true; }
    return false;
  };

  function playMovie(m) {
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
    const due = store.dueReminders(Date.now(), 60000);
    due.forEach(function (r) {
      if (r.rec) {
        const ch = vis('live').filter(function (c) { return c.id === r.chId; })[0];
        if (ch) { toast('● Opname van ' + r.title + ' gestart: het programma begint over een minuut'); startRecording(ch, r.title, Math.max(5, Math.round(((r.end || r.start + 3600000) - Date.now()) / 60000) + 1)); return; }
      }
      chime();
      if (modalOpen()) { toast('Zo begint: ' + r.title + ' op ' + r.chName); return; }
      const dlg = h('div', { class: 'dlg' }, [
        h('h2', { text: 'Zo begint ' + r.title }),
        h('div', { class: 'sub', text: r.chName + ' · ' + U.clock(r.start) }),
        h('div', { class: 'btns' }, [
          btn('Kijken', function () {
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
    return card({ kind: 'series', title: s.name, sub: s.group, logo: s.logo, tag: 'SERIE', desc: s.plot || '', badge: itemBadge(s.id), metaKind: 'series', metaName: s.name,
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
      if (v === 'reset') { store.setChan(c.id, { num: '', name: '', folder: '', logo: '', epgId: '' }); bump(); return render(true); }
      if (v === 'num') textDialog('Zendernummer voor ' + c.name, String(c.no), function (t) { const n = parseInt(t, 10); if (n > 0) { store.setChan(c.id, { num: n }); bump(); render(true); } });
      if (v === 'name') textDialog('Nieuwe naam', c.name, function (t) { store.setChan(c.id, { name: t === c.name0 ? '' : t }); bump(); render(true); });
    });
  }

  function titleMenu(it) {
    const items = [
      ['list', store.inList(it.id) ? '♥ Uit Mijn lijst halen' : '♡ Toevoegen aan Mijn lijst'],
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

  function vHome() {
    const root = h('div');
    if (!state.lib) {
      root.appendChild(heroBlock(btn('Gegevens invoeren', function () { state.setTab = 'sources'; go('settings'); })));
      setHero({ title: 'Welkom bij Luma TV', sub: 'Live tv, films en series uit je eigen abonnement.', desc: 'Voeg je eigen IPTV-gegevens toe, ook makkelijk met je telefoon. Er wordt geen content meegeleverd.', tag: 'LUMA TV', key: 'luma' });
      return root;
    }
    root.appendChild(heroBlock());
    if (state.update) root.appendChild(h('div', { class: 'upd' }, [btn('⬆ Update ' + state.update + ' beschikbaar: nu installeren', function () { state.setTab = 'updates'; go('settings'); }, 'btn sec')]));
    const first = [];
    const live = vis('live');
    const rows = [];
    const add = function (key, title, cards) {
      if (!cards.length || !on('row_' + key)) return;
      rows.push({ key: key, title: title, cards: cards });
    };

    const cont = store.continueList(12);
    add('cont', 'Verder kijken', cont.map(function (p) {
      const left = p.dur ? Math.max(1, Math.round((p.dur - p.pos) / 60000)) : 0;
      return card({
        kind: p.kind, wide: true, title: p.title, logo: p.logo, progress: p.dur ? p.pos / p.dur : 0, tag: 'VERDER KIJKEN',
        sub: (p.sub ? p.sub + ' · ' : '') + (left ? 'nog ' + left + ' min' : 'Hervat'), onclick: function () { resumeEntry(p); }
      });
    }));

    const byId = {};
    live.forEach(function (c) { byId[c.id] = c; });
    const favs = store.favs().map(function (id) { return byId[id]; }).filter(Boolean);
    add('fav', 'Mijn favoriete zenders', favs.slice(0, 20).map(function (c) { return liveCard(c, favs, favs.indexOf(c)); }));

    let chans = store.recent().map(function (id) { return byId[id]; }).filter(Boolean);
    if (state.epg && state.epg.size) {
      live.forEach(function (c) { if (chans.length < 16 && chans.indexOf(c) < 0 && state.epg.forChannel(c).length) chans.push(c); });
    }
    if (!chans.length) chans = live.slice(0, 16);
    chans = chans.slice(0, 16);
    add('live', 'Nu op tv', chans.map(function (c) { return liveCard(c, live, live.indexOf(c)); }));

    const mine = lookupItems(store.listItems());
    add('list', 'Mijn lijst', mine.map(function (it) { return it.kind === 'series' ? showCard(it) : movieCard(it); }));

    const hist = store.historyList(1)[0];
    if (hist) {
      const base = lookupItems([{ id: hist.kind === 'series' ? hist.showId : hist.id }])[0];
      if (base) {
        const same = vis(base.kind).filter(function (x) { return x.group === base.group && x.id !== base.id; }).slice(0, 16);
        add('because', 'Omdat je ' + (base.name || hist.title) + ' keek', same.map(function (it) { return it.kind === 'series' ? showCard(it) : movieCard(it); }));
      }
    }

    add('vod', 'Films', vis('vod').slice(0, 20).map(movieCard));
    add('series', 'Series', vis('series').slice(0, 20).map(showCard));
    crows().forEach(function (r) {
      const items = vis(r.kind).filter(function (c) { return c.group === r.group; }).slice(0, 20);
      add(r.key, r.name, r.kind === 'live' ? items.map(function (c, i) { return liveCard(c, items, i); }) : items.map(r.kind === 'series' ? showCard : movieCard));
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
    rows.forEach(function (r) { first.push(r.cards[0]); root.appendChild(shelf(r.title, r.cards)); });
    if (!first.length) root.appendChild(h('div', { class: 'msg', text: 'Er is niets om te tonen voor dit profiel. Controleer Instellingen → Voor jou.' }));
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

  function liveFiltered() {
    const all = vis('live');
    const g = state.group.live;
    if (g === '__fav') return all.filter(function (c) { return store.isFav(c.id); });
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
    if (store.zapList().length) cats.push(['__zap', '⚡ Zapplijst', all.filter(function (c) { return store.zapList().indexOf(c.id) >= 0; }).length]);
    groupsOf(all).forEach(function (x) { cats.push([x, x, counts[x]]); });
    root.appendChild(h('div', { class: 'lcol cats' }, cats.map(function (c) {
      return h('button', { class: 'lcat' + (c[0] === g ? ' on' : ''), type: 'button', 'data-k': 'cat|' + c[0], onclick: function () {
        state.group.live = c[0];
        state.shown.live = 0;
        render();
        const f = document.querySelector('.lch');
        if (f) f.focus({ preventScroll: true });
      } }, [h('span', { class: 'nm', text: c[1] }), h('span', { class: 'ct', text: String(c[2]) })]);
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

  function groupLabel(g) { return g === '__fav' ? '★ Favorieten' : g === '__zap' ? '⚡ Zapplijst' : g || 'Alle zenders'; }

  /** True when a programme title looks like something from your list or recent history. */
  function favTitle(title) {
    if (!favTitle.set || favTitle.rev !== state.rev) {
      favTitle.rev = state.rev;
      favTitle.set = store.listItems().map(function (x) { return fold(x.name); }).concat(store.historyList(40).map(function (x) { return fold(x.sub ? x.title : x.title); })).filter(function (x) { return x.length >= 4; });
    }
    const t = fold(title);
    return t.length >= 4 && favTitle.set.some(function (x) { return t === x || t.indexOf(x) >= 0; });
  }

  function vGuide() {
    if (!state.lib) return vHome();
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
          } }, [rem ? h('span', { text: '🔔' }) : null, star ? h('span', { text: '★ ' }) : null, h('span', { text: p.title })]);
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
    return vSplit({ menu: menu, title: g && g.indexOf('__col:') === 0 ? 'Verzameling' : g === '__list' ? 'Mijn lijst' : g === '__unseen' ? 'Nog niet gezien' : g || title, posters: true, cards: cards,
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

  function vSearch() {
    const root = h('div', { class: 'page' });
    root.appendChild(h('h1', { class: 'ph', text: 'Zoeken' }));
    const input = h('input', { type: 'text', value: state.query || '', placeholder: 'Zoek een zender, film of serie…', autocomplete: 'off', autocapitalize: 'off' });
    const out = h('div');
    root.appendChild(h('div', { class: 'chips' }, [h('button', { class: 'chip' + (state.unseenOnly ? ' on' : ''), type: 'button', onclick: function () { state.unseenOnly = !state.unseenOnly; run(); } }, ['Alleen wat ik nog niet zag'])]));
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
      if (!live.length && !vod.length && !ser.length) out.appendChild(h('div', { class: 'msg', text: 'Niets gevonden voor "' + state.query + '".' }));
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
    for (const f of fol.slice(0, 12)) {
      const show = state.lib.series.find(function (s) { return s.id === f.id; });
      if (!show) continue;
      let n = show.episodes ? show.episodes.length : 0;
      if (!show.episodes && show.xtreamId != null && state.source && state.source.type === 'xtream') {
        try { n = XT.normalizeSeriesInfo(state.source, await fetchJson(XT.apiUrl(state.source, 'get_series_info', '&series_id=' + enc(show.xtreamId)), 21600, state.source.ua || '')).length; } catch (e) { continue; }
      }
      if (n > f.n) { toast('🔔 Nieuwe aflevering van ' + f.name); f.n = n; changed = true; }
    }
    if (changed) store.setUi('follows', JSON.stringify(fol));
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
    if (!show.episodes.length) root.appendChild(h('div', { class: 'msg', text: 'Geen afleveringen gevonden.' }));
    let season = null;
    const list = h('div', { class: 'list' });
    show.episodes.forEach(function (ep, i) {
      if (ep.s !== season) {
        season = ep.s;
        list.appendChild(h('h2', { text: 'Seizoen ' + season, style: { marginTop: '2.4rem' } }));
      }
      const p = store.getProgress(ep.id);
      list.appendChild(row({
        title: 'Aflevering ' + ep.e + ' · ' + ep.title,
        sub: ((ep.dur ? ep.dur + ' · ' : '') + (ep.desc || '')).slice(0, 160),
        right: store.isWatched(ep.id) ? '✓' : p && p.dur ? Math.round(100 * p.pos / p.dur) + '%' : '',
        onclick: function () { playEpisode(show, i, p && p.pos > 20000 && p.pos < 0.95 * (p.dur || Infinity) ? p.pos - 5000 : 0); }
      }));
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
    state.view = store.ui('start', 'home');
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
        } }, [avatar(p, 'pi'), h('div', { text: p.name }), p.kid ? h('div', { class: 'kid', text: 'Kinderprofiel' }) : null]);
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
    const d = { name: p ? p.name : '', color: p ? p.color : store.profiles().length % PCOL.length, pat: p ? p.pat || '' : '', kid: p ? !!p.kid : false, guest: p ? !!p.guest : false, src: p ? p.src || '' : '', onlyFavs: p ? !!p.onlyFavs : false };
    const draw = function () {
      const name = h('input', { type: 'text', value: d.name, placeholder: 'Naam', autocomplete: 'off' });
      name.addEventListener('input', function () { d.name = name.value; });
      const dots = h('div', { class: 'dots' }, PCOL.map(function (c, i) {
        return h('button', { class: 'dot' + (d.color === i ? ' s' : ''), type: 'button', style: { background: c }, onclick: function () { d.color = i; draw(); } });
      }));
      const kid = toggleRow('Kinderprofiel', 'Verbergt vergrendelde categorieën; wisselen en instellingen vragen de pincode', d.kid, function () { d.kid = !d.kid; draw(); });
      const onlyFavs = d.kid ? toggleRow('Kinderen zien alleen favorieten', 'In Live TV alleen de zenders die je als favoriet hebt gemarkeerd (kies ze met dit profiel)', d.onlyFavs, function () { d.onlyFavs = !d.onlyFavs; draw(); }) : null;
      const srcRow = store.sources().length > 1 ? row({ title: 'Bron van dit profiel', sub: 'Wordt gekozen zodra je naar dit profiel wisselt', right: (store.sources().filter(function (s) { return s.id === d.src; })[0] || { name: 'Geen voorkeur' }).name || 'Bron', onclick: function () {
        pickList('Bron van dit profiel', [['', 'Geen voorkeur']].concat(store.sources().map(function (s) { return [s.id, s.name || s.url || s.server || s.id]; })), d.src, function (v) { d.src = v; draw(); });
      } }) : null;
      const pat = choiceRow('Patroon', 'Van je profielfoto', [['', 'Effen'], ['stripes', 'Strepen'], ['dots', 'Stippen'], ['ring', 'Ring'], ['glow', 'Schaduw']], d.pat, function (v) { d.pat = v; draw(); });
      const guest = toggleRow('Gastprofiel', 'Alles van dit profiel wordt gewist zodra je naar een ander profiel gaat', d.guest, function () { d.guest = !d.guest; draw(); });
      const acts = [btn('Opslaan', function () {
        if (!d.name.trim()) { toast('Geef het profiel een naam'); return; }
        if (isNew) store.updateProfile(store.addProfile({ name: d.name, color: d.color, kid: d.kid }).id, { guest: d.guest, src: d.src, pat: d.pat, onlyFavs: d.kid && d.onlyFavs });
        else store.updateProfile(p.id, { name: d.name.trim(), color: d.color, kid: d.kid, guest: d.guest, src: d.src, pat: d.pat, onlyFavs: d.kid && d.onlyFavs });
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
      openModal(h('div', { class: 'dlg', style: { minWidth: '100rem' } }, [h('h2', { text: isNew ? 'Nieuw profiel' : 'Profiel aanpassen' }), name, dots, pat, kid, onlyFavs, srcRow, guest, h('div', { class: 'btns' }, acts)]));
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
  const TABS = [['profiles', 'Profielen'], ['look', 'Uiterlijk'], ['sources', 'Bronnen'], ['foryou', 'Voor jou'], ['images', 'Beelden & info'], ['live', 'Live TV & gids'], ['play', 'Afspelen'], ['parental', 'Ouderlijk toezicht'], ['rec', 'Opnames'], ['updates', 'Updates'], ['maint', 'Onderhoud']];

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
    const fn = { profiles: panePro, look: paneLook, sources: paneSources, live: paneLive, foryou: paneForYou, images: paneImages, play: panePlay, parental: paneParental, updates: paneUpdates, rec: paneRec, maint: paneMaint }[state.setTab] || panePro;
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
    p.appendChild(toggleRow('Seizoensthema', 'Kerst, oud en nieuw en Koningsdag krijgen een eigen accentkleur', store.ui('season', 'off') === 'on', function () { setUi('season', store.ui('season', 'off') === 'on' ? 'off' : 'on'); }));
    p.appendChild(choiceRow('Doorzichtigheid van de bovenbalk', 'Hoe sterk de balk bovenin de rij eronder verbergt', [['1', 'Dicht'], ['0.6', 'Half'], ['0.3', 'Bijna doorzichtig'], ['0', 'Doorzichtig']], store.ui('topalpha', '1'), function (v) { setUi('topalpha', v); }));
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
    p.appendChild(choiceRow('Startscherm', 'Waar de app opent', [['home', 'Voor jou'], ['live', 'Live TV'], ['guide', 'Gids']], store.ui('start', 'home'), function (v) { setUi('start', v); }));
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
    p.appendChild(choiceRow('Terugspoelen (pijl links)', 'Bij films en series', [['10', '10 seconden'], ['20', '20 seconden'], ['30', '30 seconden']], store.ui('seekBack', '10'), function (v) { setUi('seekBack', v); }));
    p.appendChild(choiceRow('Vooruitspoelen (pijl rechts)', 'Bij films en series', [['10', '10 seconden'], ['30', '30 seconden'], ['60', '1 minuut']], store.ui('seekFwd', '30'), function (v) { setUi('seekFwd', v); }));
    p.appendChild(choiceRow('Infobalk blijft zichtbaar', 'In de speler', [['3', '3 seconden'], ['5', '5 seconden'], ['8', '8 seconden'], ['12', '12 seconden']], store.ui('overlay', '5'), function (v) { setUi('overlay', v); }));
    p.appendChild(choiceRow('Voorkeur audiotaal', 'Wordt automatisch gekozen als de stream die heeft', [['', 'Standaard van de stream'], ['nl', 'Nederlands'], ['en', 'Engels'], ['de', 'Duits'], ['fr', 'Frans'], ['es', 'Spaans'], ['tr', 'Turks']], store.ui('alang', ''), function (v) { setUi('alang', v); }));
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

  function deadCheck() {
    if (!native || !native.probe) return toast('Controleren werkt alleen in de Luma TV-app');
    const list = vis('live').filter(function (c) { return c.url; });
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
    p.appendChild(choiceRow('Opnames automatisch wissen', 'Oude opnames ruimen zichzelf op', [['0', 'Nooit'], ['7', 'Na 7 dagen'], ['30', 'Na 30 dagen']], store.ui('recdays', '0'), function (v) { setUi('recdays', v); }));
    recRules().forEach(function (r, i) {
      p.appendChild(row({ title: '● ' + r.title, sub: r.chName + ' · elke uitzending', right: 'Verwijderen', onclick: function () { const rs = recRules(); rs.splice(i, 1); store.setUi('recrules', JSON.stringify(rs)); render(true); } }));
    });
    if (native.freeSpace) p.appendChild(h('div', { class: 'sub', text: 'Vrije ruimte voor opnames: ' + fmtSize(+native.freeSpace()) }));
    const now = native.recording();
    if (now) p.appendChild(row({ title: '● Bezig met opnemen: ' + now, sub: 'OK om te stoppen', right: 'Stoppen', onclick: function () { native.stopRecord(); toast('Opname gestopt'); setTimeout(function () { render(true); }, 600); } }));
    let list = [];
    try { list = JSON.parse(native.recordings()); } catch (e) { list = []; }
    if (!list.length) p.appendChild(h('div', { class: 'msg', text: 'Nog geen opnames. Open tijdens het kijken de actiebalk (pijl omlaag) en kies Opnemen, of houd OK ingedrukt op een programma in de gids.' }));
    list.forEach(function (r) {
      const title = r.name.replace(/_\d{8}_\d{4}\.ts$/, '');
      p.appendChild(row({ title: title, sub: new Date(r.time).toLocaleString('nl-NL') + ' · ' + fmtSize(r.size), right: 'Afspelen', onclick: function () {
        pickList(title, [['play', 'Afspelen'], ['del', 'Verwijderen']], '', function (v) {
          if (v === 'del') { native.deleteRecording(r.path); toast('Opname verwijderd'); return render(true); }
          const id = 'rec:' + r.name;
          state.playMeta[id] = { id: id, kind: 'vod', title: title, name: title, url: 'file://' + r.path };
          native.play(JSON.stringify({ id: id, title: title, url: 'file://' + r.path, live: false, position: 0, accent: accent(), seekBack: +store.ui('seekBack', '10') * 1000, seekFwd: +store.ui('seekFwd', '30') * 1000, overlayMs: +store.ui('overlay', '5') * 1000, autoNext: false, skipMs: 85000 }));
        });
      } }));
    });
  }

  function paneMaint(p) {
    p.appendChild(h('h2', { text: 'Onderhoud' }));
    p.appendChild(row({ title: '📅 Jouw jaaroverzicht', sub: 'Kijktijd en meest bekeken dit jaar', right: '›', onclick: function () { state.sub = 'year'; render(); } }));
    if (native && native.saveText) {
      p.appendChild(btn('Back-up maken', function () {
        const ok = native.saveText('luma-backup.json', localStorage.getItem('luma.v1') || '{}');
        toast(ok ? 'Back-up staat in de map van de app (backup/luma-backup.json)' : 'Back-up maken mislukt');
      }, 'btn sec'));
      p.appendChild(btn('Back-up terugzetten', function () {
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
    const base = [['cont', 'Verder kijken'], ['fav', 'Mijn favoriete zenders'], ['live', 'Nu op tv'], ['list', 'Mijn lijst'], ['because', 'Omdat je iets keek'], ['vod', 'Films'], ['series', 'Series'], ['family', 'Wat het gezin kijkt']];
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
    openModal(h('div', { class: 'dlg' }, [h('h2', { text: 'Nieuw in Luma TV ' + (native ? native.version() : '') }),
      h('ul', { class: 'wn' }, VERSION_NOTES.map(function (n) { return h('li', { text: n }); })),
      h('div', { class: 'btns' }, [btn('Mooi', closeModal)])]));
  }

  function reportProblem() {
    const src = state.source ? (state.source.type + ' · ' + (state.source.name || '')) : 'geen bron';
    const txt = 'Luma TV ' + (native ? native.version() : '?') + '\nBron: ' + src + '\nLaatste fout: ' + (state.lastError || 'geen') +
      '\nZenders: ' + (state.lib ? state.lib.live.length : 0) + ', films: ' + (state.lib ? state.lib.vod.length : 0) + ', series: ' + (state.lib ? state.lib.series.length : 0) + '\nGids: ' + (state.epg ? state.epg.size : 0) + ' zenders';
    openModal(h('div', { class: 'dlg' }, [h('h2', { text: 'Probleem melden' }),
      h('p', { text: 'Dit zijn de technische gegevens zonder inloggegevens. Geef ze door als je hulp vraagt of een melding maakt op GitHub.' }),
      h('pre', { class: 'rep', text: txt }), h('div', { class: 'btns' }, [btn('Sluiten', closeModal)])]));
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
    if (native && native.record) items.push(['rec', isNow ? '● Nu opnemen' : '● Opnemen plannen']);
    if (native && native.record) items.push(['rule', '● Elke uitzending van dit programma opnemen']);
    pickList(p.title, items, '', function (v) {
      const base = { chId: c.id, chName: c.name, title: p.title, start: p.start, end: p.stop };
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
    loadSource(saved, true).then(function () { if (state.lib) go('home'); else render(); });
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
  function render(keepFocus) {
    if (!(state.view === 'settings' && state.setTab === 'sources' && !state.sub)) stopRemote();
    const prev = keepFocus ? document.activeElement : null;
    const prevKey = prev && prev.dataset ? prev.dataset.k : '';
    const keepScroll = keepFocus ? viewEl.scrollTop : 0;
    const oldG = keepFocus ? document.querySelector('.gscroll') : null;
    const gx = oldG ? oldG.scrollLeft : 0;
    const gy = oldG ? oldG.scrollTop : 0;
    const cols = keepFocus ? Array.prototype.map.call(document.querySelectorAll('.lcol'), function (e) { return e.scrollTop; }) : [];
    navEl.textContent = '';
    const tab = function (id, label, ic) {
      return h('button', { class: 'tab' + (ic ? ' icon' : '') + (state.view === id ? ' on' : ''), type: 'button', onclick: function () { go(id); } }, ic ? [icon(ic)] : [label]);
    };
    navEl.appendChild(tab('search', '', 'search'));
    const hasRadio = state.lib && vis('live').some(isRadio);
    NAV.forEach(function (n) { if (n[0] !== 'radio' || hasRadio) navEl.appendChild(tab(n[0], n[1])); });
    navEl.appendChild(tab('settings', '', 'settings'));
    setHero({ title: '', key: 'luma' });
    let v;
    if (state.show && state.view === 'series') v = vShow();
    else if (state.view === 'live') v = vLive();
    else if (state.view === 'radio') v = vRadio();
    else if (state.view === 'guide') v = vGuide();
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
    viewEl.scrollTop = keepScroll;
    const newG = document.querySelector('.gscroll');
    if (newG && oldG) { newG.scrollLeft = gx; newG.scrollTop = gy; }
    Array.prototype.forEach.call(document.querySelectorAll('.lcol'), function (e, i) { if (cols[i]) e.scrollTop = cols[i]; });
    if (document.querySelector('.who') || modalOpen()) return;
    if (prev && prev.id === 'prof') { $('prof').focus({ preventScroll: true }); return; }
    if (prev) {
      let same = null;
      if (prevKey) same = document.querySelector('[data-k="' + prevKey.replace(/"/g, '') + '"]');
      else if (prev.tagName === 'BUTTON' && prev.textContent) {
        same = Array.prototype.find.call(document.querySelectorAll('#view button, #nav button'), function (b) { return b.textContent === prev.textContent; });
      }
      if (same) { same.focus({ preventScroll: true }); if (same._info) setHero(same._info); if (same._ginfo) guideInfo(same._ginfo); if (same._linfo) liveInfo(same._linfo); return; }
    }
    focusFirst();
  }

  function focusFirst() {
    const t = viewEl.querySelector('.gp.now') || viewEl.querySelector('.lch') || viewEl.querySelector('.split .card') || viewEl.querySelector('.gname') || viewEl.querySelector('button, input');
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

  let heroTimer = 0;
  document.addEventListener('focusin', function (e) {
    const t = e.target;
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
  function tick() {
    const d = new Date();
    $('clock').textContent = U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
    if (store.ui('theme', 'dark') === 'auto') applyTheme();
  }

  function boot() {
    applyTheme();
    const tg = document.querySelector('#intro .tagl');
    if (tg) tg.textContent = 'Welkom, ' + store.profile().name;
    state.view = store.ui('start', 'home');
    const src = store.active();
    if (store.profiles().length > 1 && store.pref('ask') !== 'off' && !document.querySelector('.who')) showWho(true);
    if (src) loadSource(src, false);
    else { render(); introDone(); }
    setTimeout(introDone, 20000);
    setTimeout(startupChecks, 6000);
  }

  function cleanRecordings() {
    const days = +store.ui('recdays', '0');
    if (!native || !native.recordings || !days) return;
    try {
      JSON.parse(native.recordings()).forEach(function (r) { if (Date.now() - r.time > days * 86400000) native.deleteRecording(r.path); });
    } catch (e) { /* nothing to clean */ }
  }

  function startupChecks() {
    cleanRecordings();
    const ver = native ? native.version() : '';
    if (ver && store.pref('ver') !== ver) {
      if (store.pref('ver')) whatsNew();
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
