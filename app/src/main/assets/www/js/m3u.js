(function (g) {
  'use strict';
  const U = typeof require !== 'undefined' ? require('./util.js') : g.LumaUtil;

  // "Show Name S01E02 Title": the shape most providers use for episodes in a plain playlist.
  const SERIES_RE = /^(.*?)[\s._-]*[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})\b[\s._-]*(.*)$/;

  function parseAttrs(s) {
    const out = {};
    const re = /([\w-]+)=(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(s))) out[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
    return out;
  }

  /** Index of the first comma outside quotes: it separates the attributes from the name. */
  function nameComma(line) {
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') quoted = !quoted;
      else if (c === ',' && !quoted) return i;
    }
    return -1;
  }

  /** Raw entries of an M3U / M3U8 playlist: {name, url, logo, group, tvgId}. */
  function parseM3U(text) {
    const items = [];
    const lines = text.split(/\r?\n/);
    let cur = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.indexOf('#EXTINF') === 0) {
        const c = nameComma(line);
        const head = c >= 0 ? line.slice(0, c) : line;
        const name = c >= 0 ? line.slice(c + 1).trim() : '';
        const a = parseAttrs(head);
        cur = {
          name: name || a['tvg-name'] || '',
          logo: a['tvg-logo'] || '',
          group: a['group-title'] || '',
          tvgId: a['tvg-id'] || ''
        };
      } else if (line.indexOf('#EXTGRP:') === 0) {
        if (cur && !cur.group) cur.group = line.slice(8).trim();
      } else if (line[0] === '#') {
        continue;
      } else if (cur) {
        cur.url = line;
        if (!cur.name) cur.name = line;
        items.push(cur);
        cur = null;
      } else if (/^https?:\/\//i.test(line)) {
        items.push({ name: line, url: line, logo: '', group: '', tvgId: '' });
      }
    }
    return items;
  }

  /** The guide address some playlists carry in their first line. */
  function epgFromHeader(text) {
    const m = /^#EXTM3U[^\n]*?(?:url-tvg|x-tvg-url)="([^"]+)"/i.exec(text.slice(0, 2000));
    return m ? m[1].split(',')[0].trim() : '';
  }

  /** 'live', 'vod' (a film) or 'series' (an episode). */
  function classify(it) {
    const u = it.url.toLowerCase();
    if (/\/series\//.test(u)) return 'series';
    if (/\/movie\//.test(u)) return 'vod';
    if (/\/live\//.test(u)) return 'live';
    if (SERIES_RE.test(it.name)) return 'series';
    if (/\b(films?|movies?|vod|cinema|bioscoop)\b/i.test(it.group || '')) return 'vod';
    if (/\.(mp4|mkv|avi|m4v|mov)(\?|$)/.test(u)) return 'vod';
    return 'live';
  }

  /** Sorts raw entries into the three shelves; episodes are grouped per show. */
  function buildLibrary(items, sourceId) {
    const live = [];
    const vod = [];
    const shows = new Map();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const kind = classify(it);
      const name = it.name.trim();
      if (kind === 'series') {
        const m = SERIES_RE.exec(name);
        if (m) {
          const show = (m[1] || '').trim() || name;
          const key = show.toLowerCase();
          let s = shows.get(key);
          if (!s) {
            s = { id: 's' + U.hash(sourceId + '|' + key), kind: 'series', name: show, logo: it.logo, group: it.group || 'Series', episodes: [] };
            shows.set(key, s);
          }
          if (!s.logo && it.logo) s.logo = it.logo;
          const ep = +m[3];
          s.episodes.push({ id: 'e' + U.hash(sourceId + '|' + it.url), s: +m[2], e: ep, title: (m[4] || '').trim() || 'Aflevering ' + ep, url: it.url });
          continue;
        }
      }
      const base = { name: name, url: it.url, logo: it.logo, tvgId: it.tvgId };
      if (kind === 'live') {
        live.push(Object.assign(base, { id: 'l' + U.hash(sourceId + '|' + it.url), kind: 'live', group: it.group || 'Overig' }));
      } else {
        vod.push(Object.assign(base, { id: 'm' + U.hash(sourceId + '|' + it.url), kind: 'vod', group: it.group || 'Films' }));
      }
    }
    const series = Array.from(shows.values());
    series.forEach(function (s) {
      s.episodes.sort(function (a, b) { return a.s - b.s || a.e - b.e; });
    });
    series.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { live: live, vod: vod, series: series };
  }

  const api = { parseM3U: parseM3U, parseAttrs: parseAttrs, classify: classify, buildLibrary: buildLibrary, epgFromHeader: epgFromHeader, SERIES_RE: SERIES_RE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LumaM3u = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
