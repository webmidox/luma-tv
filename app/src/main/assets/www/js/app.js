(function () {
  'use strict';
  const U = window.LumaUtil;
  const h = U.h;
  const M3U = window.LumaM3u;
  const XT = window.LumaXtream;
  const XMLTV = window.LumaXmltv;
  const Epg = window.LumaEpg.Epg;
  const UPD = window.LumaUpdate;
  const CFG = window.LUMA_CONFIG || {};

  /** A repo typed in Settings wins; otherwise the one built into js/config.js (unless it is still the placeholder). */
  function updateRepo(kind) {
    const own = store.pref(kind === 'launcher' ? 'repoLauncher' : 'repo');
    if (own) return own;
    const v = (kind === 'launcher' ? CFG.launcherRepo : CFG.appRepo) || '';
    return /JOUWNAAM/i.test(v) ? '' : v;
  }
  let storage = null;
  try { storage = window.localStorage; } catch (e) { storage = null; }
  if (!storage) {
    const mem = {};
    storage = { getItem: function (k) { return mem[k] || null; }, setItem: function (k, v) { mem[k] = v; } };
  }
  const store = window.LumaStore.createStore(storage);
  const native = window.LumaNative || null;
  const PAGE = 48;
  const NAV = [
    ['home', 'Home'], ['live', 'Live TV'], ['guide', 'Gids'], ['vod', 'Films'], ['series', 'Series'], ['settings', 'Instellingen']
  ];

  const state = {
    view: 'home', lib: null, epg: null, source: null, loading: '', error: '',
    group: { live: '', vod: '', series: '' }, shown: {}, show: null, form: { type: 'm3u' }, playMeta: {}
  };

  const viewEl = document.getElementById('view');
  const navEl = document.getElementById('nav');

  // ---------- helpers ----------
  function enc(s) { return encodeURIComponent(s); }

  function proxied(url, ttl, ua) {
    if (!native) return url;
    return '/proxy?u=' + enc(url) + '&ttl=' + (ttl || 0) + (ua ? '&ua=' + enc(ua) : '');
  }

  async function fetchText(url, ttl, ua) {
    const res = await fetch(proxied(url, ttl, ua));
    if (!res.ok) throw new Error('Server antwoordde ' + res.status);
    return res.text();
  }

  async function fetchJson(url, ttl, ua) {
    const t = await fetchText(url, ttl, ua);
    try { return JSON.parse(t); } catch (e) { throw new Error('Onverwacht antwoord van de server'); }
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function btn(text, onclick, cls) {
    return h('button', { class: cls || 'btn', onclick: onclick, type: 'button' }, [text]);
  }

  function art(url) {
    return url ? "url('" + proxied(url, 604800).replace(/'/g, '%27') + "')" : '';
  }

  function card(opts) {
    const a = h('div', { class: 'art', style: opts.logo ? { backgroundImage: art(opts.logo) } : {} },
      opts.logo ? [] : [(opts.title || '?').slice(0, 1).toUpperCase()]);
    const meta = [h('div', { class: 't', text: opts.title })];
    if (opts.sub) meta.push(h('div', { class: 'sub t', text: opts.sub }));
    if (opts.progress != null) meta.push(h('div', { class: 'bar' }, [h('i', { style: { width: Math.round(opts.progress * 100) + '%' } })]));
    return h('button', { class: 'card' + (opts.poster ? ' poster' : ''), type: 'button', onclick: opts.onclick }, [a, h('div', { class: 'meta' }, meta)]);
  }

  function row(opts) {
    return h('button', { class: 'row', type: 'button', onclick: opts.onclick }, [
      h('div', { class: 'logo', style: opts.logo ? { backgroundImage: art(opts.logo) } : {} }),
      h('div', { class: 'grow' }, [h('div', { class: 't', text: opts.title }), opts.sub ? h('div', { class: 'sub t', text: opts.sub }) : null]),
      opts.right ? h('div', { class: 'sub', text: opts.right }) : null
    ]);
  }

  function chips(list, current, onpick) {
    return h('div', { class: 'chips' }, [''].concat(list).map(function (g) {
      return h('button', { class: 'chip' + (g === current ? ' on' : ''), type: 'button', onclick: function () { onpick(g); } }, [g || 'Alles']);
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
    return btn('Meer tonen (' + (total - n) + ')', function () { state.shown[key] = n + PAGE; rerender(); }, 'btn');
  }

  // ---------- loading ----------
  async function loadSource(src, force) {
    state.loading = 'Bibliotheek laden…';
    state.error = '';
    render();
    const ttl = force ? 0 : 3600;
    const ua = src.ua || '';
    let lib;
    let epgUrl = src.epg || '';
    try {
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
    } catch (e) {
      state.loading = '';
      state.error = String(e.message || e);
      state.lib = null;
      render();
      return;
    }
    state.source = src;
    state.lib = lib;
    state.epg = null;
    state.loading = '';
    render();
    if (epgUrl) loadEpg(epgUrl, lib, ua, force);
  }

  async function loadEpg(url, lib, ua, force) {
    try {
      const text = await fetchText(url, force ? 0 : 6 * 3600, ua);
      const now = Date.now();
      const data = XMLTV.parseXmltv(text, now - 3600000, now + 12 * 3600000);
      if (state.lib !== lib) return;
      state.epg = new Epg(data, lib.live);
      if (state.view === 'home' || state.view === 'live' || state.view === 'guide') render(true);
    } catch (e) {
      // The guide is optional; channels still work without it.
    }
  }

  // ---------- playback ----------
  function nowLine(item) {
    if (!state.epg) return null;
    const nn = state.epg.nowNext(item, Date.now());
    return nn.now ? { line: nn.now.title + ' op ' + item.name, start: nn.now.start, end: nn.now.stop } : null;
  }

  function play(list, index, opts) {
    opts = opts || {};
    const live = list[index].kind === 'live';
    const payload = {
      live: live, position: opts.position || 0, ua: (state.source && state.source.ua) || '', index: index,
      list: list.map(function (it) {
        state.playMeta[it.id] = it.meta || it;
        return { id: it.id, title: it.title || it.name, url: it.url };
      })
    };
    if (live) {
      store.pushRecent(list[index].id);
      const n = nowLine(list[index]);
      if (native && n) native.setNow(JSON.stringify(n));
    }
    if (!native) { toast('Afspelen werkt alleen in de Luma TV-app'); return; }
    native.play(JSON.stringify(payload));
  }

  window.lumaPlayerClosed = function (res) {
    if (native) native.clearNow();
    if (!res || !res.id) return;
    const m = state.playMeta[res.id];
    if (res.live) {
      store.pushRecent(res.id);
    } else if (m) {
      const dur = res.duration || 0;
      store.setProgress(res.id, {
        id: res.id, kind: m.kind, title: m.title || m.name, sub: m.sub || '', logo: m.logo || '', url: m.url,
        showId: m.showId || '', pos: res.ended && dur ? dur : res.position || 0, dur: dur, ts: Date.now()
      });
    }
    render(true);
  };

  window.lumaBack = function () {
    if (state.show) { state.show = null; render(); return true; }
    if (state.view !== 'home') { go('home'); return true; }
    return false;
  };

  function playChannel(list, i) { play(list, i); }

  function playMovie(m) {
    const p = store.getProgress(m.id);
    play([Object.assign({ title: m.name }, m)], 0, { position: p && p.pos > 20000 && p.pos < 0.95 * (p.dur || Infinity) ? p.pos - 5000 : 0 });
  }

  function episodeList(show) {
    return show.episodes.map(function (ep) {
      return {
        id: ep.id, kind: 'series', url: ep.url, title: show.name + ' S' + U.pad(ep.s) + 'E' + U.pad(ep.e),
        logo: show.logo, showId: show.id, sub: ep.title
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

  // ---------- views ----------
  function needSource() {
    return h('div', { class: 'empty' }, [
      h('h1', { text: 'Welkom bij Luma TV' }),
      h('p', { class: 'sub', text: 'Voeg je eigen IPTV-gegevens toe. Er wordt geen content meegeleverd.' }),
      btn('Gegevens invoeren', function () { go('settings'); })
    ]);
  }

  function vHome() {
    const root = h('div');
    if (!state.lib) {
      root.appendChild(needSource());
      return root;
    }
    const lib = state.lib;
    const byId = {};
    lib.live.forEach(function (c) { byId[c.id] = c; });
    const recent = store.recent().map(function (id) { return byId[id]; }).filter(Boolean);
    const first = recent[0];
    if (first) {
      const nn = state.epg ? state.epg.nowNext(first, Date.now()) : { now: null, next: null };
      root.appendChild(h('div', { class: 'hero' }, [
        h('div', { class: 'sub', text: 'Laatst gekeken' }),
        h('h1', { text: nn.now ? nn.now.title + ' op ' + first.name : first.name }),
        h('div', { class: 'sub', text: nn.next ? 'Hierna: ' + nn.next.title + ' · ' + U.clock(nn.next.start) : '' }),
        h('div', { class: 'actions' }, [btn('Kijk live', function () { playChannel(lib.live, lib.live.indexOf(first)); }), btn('Gids', function () { go('guide'); })])
      ]));
    } else {
      root.appendChild(h('div', { class: 'hero' }, [
        h('h1', { text: 'Klaar om te kijken' }),
        h('div', { class: 'sub', text: lib.live.length + ' zenders · ' + lib.vod.length + ' films · ' + lib.series.length + ' series' }),
        h('div', { class: 'actions' }, [btn('Live TV', function () { go('live'); }), btn('Films', function () { go('vod'); })])
      ]));
    }
    const cont = store.continueList(12);
    if (cont.length) {
      root.appendChild(h('h2', { text: 'Verder kijken' }));
      root.appendChild(h('div', { class: 'shelf' }, cont.map(function (p) {
        return card({ title: p.title, sub: p.sub, logo: p.logo, poster: true, progress: p.dur ? p.pos / p.dur : 0, onclick: function () { resumeEntry(p); } });
      })));
    }
    if (recent.length) {
      root.appendChild(h('h2', { text: 'Recente zenders' }));
      root.appendChild(h('div', { class: 'shelf' }, recent.slice(0, 10).map(function (c) {
        const nn = state.epg ? state.epg.nowNext(c, Date.now()) : { now: null };
        return card({ title: c.name, sub: nn.now ? nn.now.title : c.group, logo: c.logo, onclick: function () { playChannel(lib.live, lib.live.indexOf(c)); } });
      })));
    }
    return root;
  }

  function vLive() {
    const root = h('div');
    if (!state.lib) return needSource();
    const all = state.lib.live;
    const g = state.group.live;
    const list = g ? all.filter(function (c) { return c.group === g; }) : all;
    root.appendChild(chips(groupsOf(all), g, function (x) { state.group.live = x; state.shown.live = PAGE; render(); }));
    const n = state.shown.live || PAGE;
    root.appendChild(h('div', { class: 'list' }, list.slice(0, n).map(function (c, i) {
      const nn = state.epg ? state.epg.nowNext(c, Date.now()) : { now: null };
      return row({
        title: c.name, logo: c.logo, sub: nn.now ? nn.now.title : c.group,
        right: nn.now ? U.clock(nn.now.start) + '–' + U.clock(nn.now.stop) : '',
        onclick: function () { playChannel(list, i); }
      });
    })));
    const m = more('live', list.length, render);
    if (m) root.appendChild(m);
    return root;
  }

  function vGuide() {
    if (!state.lib) return needSource();
    const root = h('div', { class: 'guide' });
    if (!state.epg || !state.epg.size) {
      root.appendChild(h('div', { class: 'msg', text: state.epg ? 'Geen gidsgegevens gevonden voor deze zenders.' : 'Gids wordt geladen of is niet ingesteld (zie Instellingen).' }));
    }
    const all = state.lib.live;
    const g = state.group.live;
    let list = g ? all.filter(function (c) { return c.group === g; }) : all;
    if (state.epg && state.epg.size) list = list.filter(function (c) { return state.epg.forChannel(c).length; });
    root.appendChild(chips(groupsOf(all), g, function (x) { state.group.live = x; state.shown.guide = 20; render(); }));
    const n = state.shown.guide || 20;
    const now = Date.now();
    list.slice(0, n).forEach(function (c, i) {
      const track = h('div', { class: 'gtrack' });
      state.epg && state.epg.forChannel(c).forEach(function (p) {
        if (p.stop <= now || p.start > now + 4 * 3600000) return;
        const from = Math.max(p.start, now);
        const w = Math.max(70, Math.round((p.stop - from) / 60000) * 4);
        track.appendChild(h('div', { class: 'prog' + (p.start <= now ? ' live' : ''), style: { width: w + 'px' }, text: U.clock(p.start) + ' ' + p.title }));
      });
      root.appendChild(h('div', { class: 'gr' }, [
        h('button', { class: 'row gname', type: 'button', onclick: function () { playChannel(list, i); } }, [h('div', { class: 't', text: c.name })]),
        track
      ]));
    });
    const m = more('guide', list.length, function () { state.shown.guide = (state.shown.guide || 20) + 20; render(); });
    if (m) root.appendChild(m);
    return root;
  }

  function vShelf(kind, label) {
    if (!state.lib) return needSource();
    const root = h('div');
    const all = state.lib[kind];
    const g = state.group[kind];
    const list = g ? all.filter(function (c) { return c.group === g; }) : all;
    if (!all.length) {
      root.appendChild(h('div', { class: 'msg', text: 'Geen ' + label + ' gevonden in deze bron.' }));
      return root;
    }
    root.appendChild(chips(groupsOf(all), g, function (x) { state.group[kind] = x; state.shown[kind] = PAGE; render(); }));
    const n = state.shown[kind] || PAGE;
    root.appendChild(h('div', { class: 'grid' }, list.slice(0, n).map(function (it) {
      const p = kind === 'vod' ? store.getProgress(it.id) : null;
      return card({
        title: it.name, logo: it.logo, poster: true, sub: it.group,
        progress: p && p.dur ? p.pos / p.dur : null,
        onclick: kind === 'vod' ? function () { playMovie(it); } : function () { openShow(it); }
      });
    })));
    const m = more(kind, list.length, render);
    if (m) root.appendChild(m);
    return root;
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

  function vShow() {
    const show = state.show;
    const root = h('div');
    root.appendChild(h('h2', { text: show.name }));
    root.appendChild(btn('Terug', function () { state.show = null; render(); }));
    if (!show.episodes.length) root.appendChild(h('div', { class: 'msg', text: 'Geen afleveringen gevonden.' }));
    let season = null;
    const list = h('div', { class: 'list' });
    show.episodes.forEach(function (ep, i) {
      if (ep.s !== season) {
        season = ep.s;
        list.appendChild(h('h2', { text: 'Seizoen ' + season }));
      }
      const p = store.getProgress(ep.id);
      list.appendChild(row({
        title: 'Aflevering ' + ep.e + ' · ' + ep.title,
        right: p && p.dur ? Math.round(100 * p.pos / p.dur) + '%' : '',
        onclick: function () { playEpisode(show, i, p && p.pos > 20000 && p.pos < 0.95 * (p.dur || Infinity) ? p.pos - 5000 : 0); }
      }));
    });
    root.appendChild(list);
    return root;
  }

  function field(label, key, opts) {
    opts = opts || {};
    const input = h('input', { type: opts.password ? 'password' : 'text', value: state.form[key] || '', placeholder: opts.ph || '', autocapitalize: 'off', autocomplete: 'off' });
    input.addEventListener('input', function () { state.form[key] = input.value; });
    return [h('label', { text: label }), input];
  }

  function vSettings() {
    const f = state.form;
    const root = h('div', { class: 'form' });
    root.appendChild(h('h2', { text: 'Bron toevoegen' }));
    root.appendChild(h('div', { class: 'chips' }, [['m3u', 'M3U-link'], ['xtream', 'Xtream Codes']].map(function (t) {
      return h('button', { class: 'chip' + (f.type === t[0] ? ' on' : ''), type: 'button', onclick: function () { f.type = t[0]; render(); } }, [t[1]]);
    })));
    const parts = field('Naam (optioneel)', 'name', { ph: 'Mijn lijst' });
    if (f.type === 'xtream') {
      parts.push.apply(parts, field('Server', 'server', { ph: 'http://voorbeeld.tv:8080' }));
      parts.push.apply(parts, field('Gebruikersnaam', 'user'));
      parts.push.apply(parts, field('Wachtwoord', 'pass', { password: true }));
    } else {
      parts.push.apply(parts, field('Link naar M3U-lijst', 'url', { ph: 'http://…/lijst.m3u' }));
    }
    parts.push.apply(parts, field('Gids (XMLTV-link, optioneel)', 'epg'));
    parts.push.apply(parts, field('User-agent (optioneel)', 'ua'));
    parts.forEach(function (p) { root.appendChild(p); });
    if (state.error) root.appendChild(h('div', { class: 'msg err', text: state.error }));
    if (state.loading) root.appendChild(h('div', { class: 'msg', text: state.loading }));
    root.appendChild(btn('Opslaan en laden', saveForm));

    const srcs = store.sources();
    if (srcs.length) {
      root.appendChild(h('h2', { text: 'Jouw bronnen' }));
      const active = store.active();
      srcs.forEach(function (s) {
        const label = (s.name || s.url || s.server) + (active && active.id === s.id ? ' (actief)' : '');
        root.appendChild(h('div', { class: 'chips' }, [
          btn(label, function () { store.setActive(s.id); loadSource(s, false); }, 'chip'),
          btn('Verversen', function () { loadSource(s, true); }, 'chip'),
          btn('Verwijderen', function () { store.removeSource(s.id); state.lib = null; boot(); }, 'chip')
        ]));
      });
    }
    root.appendChild(h('h2', { text: 'Updates' }));
    [['app', 'repo', 'Repo voor Luma TV-updates'], ['launcher', 'repoLauncher', 'Repo voor launcher-updates']].forEach(function (r) {
      const inp = h('input', { type: 'text', value: store.pref(r[1]), placeholder: updateRepo(r[0]) || 'gebruiker/repo op GitHub', autocapitalize: 'off', autocomplete: 'off' });
      inp.addEventListener('input', function () { store.setPref(r[1], inp.value.trim()); });
      root.appendChild(h('label', { text: r[2] + ' (leeg = standaard uit config.js)' }));
      root.appendChild(inp);
    });
    root.appendChild(h('div', { class: 'msg', id: 'upd', text: 'Huidige versie: ' + (native ? native.version() : 'voorbeeld') }));
    root.appendChild(btn('Controleer op update (Luma TV)', function () { checkUpdate('app'); }));
    root.appendChild(btn('Controleer op update (launcher)', function () { checkUpdate('launcher'); }));
    root.appendChild(h('h2', { text: 'Onderhoud' }));
    root.appendChild(btn('Cache wissen', function () { if (native) native.clearCache(); toast('Cache gewist'); }));
    root.appendChild(h('div', { class: 'sub', text: 'Luma TV ' + (native ? native.version() : 'voorbeeld') + ' · gegevens blijven op dit apparaat' }));
    return root;
  }

  function updMsg(t) {
    const el = document.getElementById('upd');
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

  function saveForm() {
    const f = state.form;
    let src;
    if (f.type === 'xtream') {
      if (!f.server || !f.user || !f.pass) { state.error = 'Vul server, gebruikersnaam en wachtwoord in'; return render(); }
      src = { type: 'xtream', name: f.name || f.server, server: f.server.trim(), user: f.user.trim(), pass: f.pass, epg: (f.epg || '').trim(), ua: (f.ua || '').trim() };
    } else {
      if (!/^https?:\/\//i.test((f.url || '').trim())) { state.error = 'Vul een geldige http(s)-link in'; return render(); }
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
    const prev = keepFocus ? document.activeElement : null;
    navEl.textContent = '';
    NAV.forEach(function (n) {
      navEl.appendChild(h('button', { class: 'pill' + (state.view === n[0] ? ' on' : ''), type: 'button', onclick: function () { go(n[0]); } }, [n[1]]));
    });
    let v;
    if (state.show && state.view === 'series') v = vShow();
    else if (state.view === 'live') v = vLive();
    else if (state.view === 'guide') v = vGuide();
    else if (state.view === 'vod') v = vShelf('vod', 'films');
    else if (state.view === 'series') v = vShelf('series', 'series');
    else if (state.view === 'settings') v = vSettings();
    else v = vHome();
    if (state.loading && state.view !== 'settings') v.insertBefore(h('div', { class: 'msg', text: state.loading }), v.firstChild);
    if (state.error && state.view !== 'settings') v.insertBefore(h('div', { class: 'msg err', text: state.error }), v.firstChild);
    viewEl.textContent = '';
    viewEl.appendChild(v);
    if (prev && prev.tagName === 'BUTTON' && prev.textContent) {
      const same = Array.prototype.find.call(document.querySelectorAll('button'), function (b) { return b.textContent === prev.textContent; });
      if (same) { same.focus({ preventScroll: true }); return; }
    }
    focusFirst();
  }

  function focusFirst() {
    const t = viewEl.querySelector('button, input');
    (t || navEl.querySelector('button')).focus({ preventScroll: true });
  }

  function go(view) {
    state.view = view;
    state.show = null;
    render();
  }

  // ---------- D-pad navigation ----------
  function focusables() {
    return Array.prototype.filter.call(document.querySelectorAll('button, input'), function (e) {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !e.disabled;
    });
  }

  function move(dir) {
    const cur = document.activeElement;
    const list = focusables();
    if (!cur || list.indexOf(cur) < 0) { if (list.length) list[0].focus(); return; }
    const a = cur.getBoundingClientRect();
    const ac = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
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
      const score = Math.max(0, primary) + secondary * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
      best.focus({ preventScroll: true });
      best.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }

  document.addEventListener('keydown', function (e) {
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const dir = map[e.key];
    if (!dir) return;
    const t = e.target;
    if (t && t.tagName === 'INPUT' && (dir === 'left' || dir === 'right')) return;
    e.preventDefault();
    move(dir);
  });

  // ---------- start ----------
  function tick() {
    const d = new Date();
    document.getElementById('clock').textContent = U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
  }

  function boot() {
    const src = store.active();
    if (src) loadSource(src, false);
    else { state.view = 'home'; render(); }
  }

  tick();
  setInterval(tick, 20000);
  boot();
})();
