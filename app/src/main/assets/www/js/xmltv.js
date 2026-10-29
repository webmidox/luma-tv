(function (g) {
  'use strict';

  /** "20261029183000 +0100" to epoch milliseconds. Without an offset the time is UTC, as the format says. */
  function parseTime(s) {
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4}|Z)?/.exec((s || '').trim());
    if (!m) return NaN;
    let ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    const tz = m[7];
    if (tz && tz !== 'Z') {
      const sign = tz[0] === '-' ? -1 : 1;
      ms -= sign * (+tz.slice(1, 3) * 60 + +tz.slice(3, 5)) * 60000;
    }
    return ms;
  }

  function decode(s) {
    if (!s) return '';
    return s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
      .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
      .replace(/&amp;/g, '&')
      .trim();
  }

  function attr(attrs, name) {
    const m = new RegExp('(?:^|\\s)' + name + '="([^"]*)"').exec(attrs);
    return m ? decode(m[1]) : '';
  }

  /**
   * Reads an XMLTV guide. Only programmes that overlap [from, to] are kept, which keeps a 50 MB guide small.
   * Returns {channels: {id: {names, icon}}, programmes: {id: [{start, stop, title, desc}]}} (sorted by start).
   */
  function parseXmltv(text, from, to) {
    const channels = {};
    const programmes = {};

    const chRe = /<channel\s+([^>]*)>([\s\S]*?)<\/channel>/g;
    let m;
    while ((m = chRe.exec(text))) {
      const id = attr(m[1], 'id');
      if (!id) continue;
      const names = [];
      const nRe = /<display-name[^>]*>([\s\S]*?)<\/display-name>/g;
      let n;
      while ((n = nRe.exec(m[2]))) names.push(decode(n[1]));
      const icon = /<icon\s+[^>]*src="([^"]*)"/.exec(m[2]);
      channels[id] = { names: names, icon: icon ? decode(icon[1]) : '' };
    }

    const pRe = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/g;
    while ((m = pRe.exec(text))) {
      const start = parseTime(attr(m[1], 'start'));
      const stop = parseTime(attr(m[1], 'stop'));
      const ch = attr(m[1], 'channel');
      if (!ch || isNaN(start) || isNaN(stop)) continue;
      if (from != null && stop <= from) continue;
      if (to != null && start >= to) continue;
      const t = /<title[^>]*>([\s\S]*?)<\/title>/.exec(m[2]);
      const d = /<desc[^>]*>([\s\S]*?)<\/desc>/.exec(m[2]);
      (programmes[ch] || (programmes[ch] = [])).push({ start: start, stop: stop, title: t ? decode(t[1]) : '', desc: d ? decode(d[1]) : '' });
    }
    Object.keys(programmes).forEach(function (k) {
      programmes[k].sort(function (a, b) { return a.start - b.start; });
    });
    return { channels: channels, programmes: programmes };
  }

  const api = { parseXmltv: parseXmltv, parseTime: parseTime, decode: decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LumaXmltv = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
