(function (g) {
  'use strict';

  const IMG = 'https://image.tmdb.org/t/p/';
  const API = 'https://api.themoviedb.org/3/search/';

  /** "NL: De Film (2020) 4K HD" becomes {title: "De Film", year: 2020}; the extras of a playlist name are removed. */
  function cleanTitle(name) {
    let t = String(name || '');
    let year = 0;
    const y = /[\(\[]((?:19|20)\d{2})[\)\]]/.exec(t);
    if (y) { year = +y[1]; t = t.replace(y[0], ' '); }
    t = t.replace(/^\s*[A-Za-z]{2,3}\s*[:|\-]\s*/, ' ');
    t = t.replace(/\b(4k|uhd|fhd|hd|sd|hdr|hevc|x265|x264|1080p|720p|2160p|multi|nl\s*sub|nlsub|dubbed|ondertiteld)\b/gi, ' ');
    t = t.replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, ' ').replace(/[\(\[][^\)\]]*[\)\]]/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    return { title: t, year: year };
  }

  function keyOf(kind, name) {
    const c = cleanTitle(name);
    return kind + '|' + c.title.toLowerCase() + '|' + c.year;
  }

  /** What we keep from one TMDB result. */
  function pick(r, kind) {
    if (!r) return null;
    const date = r.release_date || r.first_air_date || '';
    return {
      id: r.id || 0,
      backdrop: r.backdrop_path ? IMG + 'w1280' + r.backdrop_path : '',
      poster: r.poster_path ? IMG + 'w500' + r.poster_path : '',
      overview: r.overview || '',
      rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : 0,
      year: date ? +date.slice(0, 4) : 0,
      kind: kind
    };
  }

  /**
   * Looks a film or series up at TMDB with the owner's own key. fetchJson(url) must return parsed JSON.
   * Gives null when nothing is found or the key is empty.
   */
  async function lookup(kind, name, key, lang, fetchJson) {
    if (!key) return null;
    const c = cleanTitle(name);
    if (c.title.length < 2) return null;
    const type = kind === 'series' ? 'tv' : 'movie';
    let url = API + type + '?api_key=' + encodeURIComponent(key) + '&language=' + encodeURIComponent(lang || 'nl-NL') + '&query=' + encodeURIComponent(c.title);
    if (c.year) url += (type === 'tv' ? '&first_air_date_year=' : '&year=') + c.year;
    const data = await fetchJson(url);
    const list = (data && data.results) || [];
    const withArt = list.filter(function (r) { return r.backdrop_path || r.poster_path; });
    return pick(withArt[0] || list[0], kind);
  }

  /** A small cache in any storage with getItem/setItem; old entries are dropped beyond max. */
  function createCache(storage, name, max) {
    let data = {};
    try { data = JSON.parse(storage.getItem(name) || '{}') || {}; } catch (e) { data = {}; }
    let order = Object.keys(data);
    return {
      get: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : undefined; },
      set: function (k, v) {
        if (!Object.prototype.hasOwnProperty.call(data, k)) order.push(k);
        data[k] = v;
        while (order.length > (max || 400)) delete data[order.shift()];
        try { storage.setItem(name, JSON.stringify(data)); } catch (e) { /* storage full: keep in memory */ }
      }
    };
  }

  const api = { cleanTitle: cleanTitle, keyOf: keyOf, lookup: lookup, createCache: createCache };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LumaMeta = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
