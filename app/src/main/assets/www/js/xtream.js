(function (g) {
  'use strict';
  const U = typeof require !== 'undefined' ? require('./util.js') : g.LumaUtil;

  function enc(s) {
    return encodeURIComponent(s);
  }

  function base(src) {
    let s = (src.server || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
    return s;
  }

  function creds(src) {
    return enc(src.user || '') + '/' + enc(src.pass || '');
  }

  /** player_api.php: the provider's JSON interface. An empty action is the login check. */
  function apiUrl(src, action, extra) {
    return base(src) + '/player_api.php?username=' + enc(src.user || '') + '&password=' + enc(src.pass || '') +
      (action ? '&action=' + action : '') + (extra || '');
  }

  function liveUrl(src, id, ext) {
    return base(src) + '/live/' + creds(src) + '/' + id + '.' + (ext || src.liveExt || 'ts');
  }

  function movieUrl(src, id, ext) {
    return base(src) + '/movie/' + creds(src) + '/' + id + '.' + (ext || 'mp4');
  }

  function episodeUrl(src, id, ext) {
    return base(src) + '/series/' + creds(src) + '/' + id + '.' + (ext || 'mp4');
  }

  function epgUrl(src) {
    return base(src) + '/xmltv.php?username=' + enc(src.user || '') + '&password=' + enc(src.pass || '');
  }

  function catMap(cats) {
    const m = {};
    (Array.isArray(cats) ? cats : []).forEach(function (c) {
      m[String(c.category_id)] = c.category_name;
    });
    return m;
  }

  function list(v) {
    return Array.isArray(v) ? v : [];
  }

  function normalizeLive(src, streams, cats) {
    const cm = catMap(cats);
    return list(streams).map(function (s) {
      return {
        id: 'l' + U.hash(src.id + '|l|' + s.stream_id),
        kind: 'live',
        name: String(s.name || '').trim(),
        url: liveUrl(src, s.stream_id),
        logo: s.stream_icon || '',
        group: cm[String(s.category_id)] || 'Overig',
        tvgId: s.epg_channel_id || ''
      };
    });
  }

  function normalizeVod(src, streams, cats) {
    const cm = catMap(cats);
    return list(streams).map(function (s) {
      return {
        id: 'm' + U.hash(src.id + '|m|' + s.stream_id),
        kind: 'vod',
        name: String(s.name || '').trim(),
        url: movieUrl(src, s.stream_id, s.container_extension),
        logo: s.stream_icon || '',
        group: cm[String(s.category_id)] || 'Films',
        tvgId: ''
      };
    });
  }

  function normalizeSeriesList(src, items, cats) {
    const cm = catMap(cats);
    return list(items).map(function (s) {
      return {
        id: 's' + U.hash(src.id + '|s|' + s.series_id),
        kind: 'series',
        xtreamId: s.series_id,
        name: String(s.name || '').trim(),
        logo: s.cover || '',
        group: cm[String(s.category_id)] || 'Series',
        plot: s.plot || '',
        episodes: null
      };
    });
  }

  /** get_series_info: seasons are keys of an object (or an array), episodes sit inside. */
  function normalizeSeriesInfo(src, info) {
    const out = [];
    const eps = (info && info.episodes) || {};
    Object.keys(eps).forEach(function (key) {
      list(eps[key]).forEach(function (ep) {
        const season = +(ep.season || key) || 1;
        const num = +ep.episode_num || out.length + 1;
        out.push({
          id: 'e' + U.hash(src.id + '|e|' + ep.id),
          s: season,
          e: num,
          title: String(ep.title || '').trim() || 'Aflevering ' + num,
          url: episodeUrl(src, ep.id, ep.container_extension)
        });
      });
    });
    out.sort(function (a, b) { return a.s - b.s || a.e - b.e; });
    return out;
  }

  const api = {
    base: base, apiUrl: apiUrl, liveUrl: liveUrl, movieUrl: movieUrl, episodeUrl: episodeUrl, epgUrl: epgUrl,
    normalizeLive: normalizeLive, normalizeVod: normalizeVod, normalizeSeriesList: normalizeSeriesList,
    normalizeSeriesInfo: normalizeSeriesInfo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LumaXtream = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
