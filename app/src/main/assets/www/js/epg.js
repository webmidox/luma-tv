(function (g) {
  'use strict';

  /** "RTL 4 HD" and "rtl4" meet at the same key. */
  function normName(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\b(hd|fhd|uhd|4k|sd)\b/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  /** Links each live channel to its guide rows: by the playlist's guide id first, by name second. */
  class Epg {
    constructor(data, liveItems) {
      this.map = new Map();
      const byName = new Map();
      const byLowerId = new Map();
      Object.keys(data.channels).forEach(function (id) {
        byLowerId.set(id.toLowerCase(), id);
        data.channels[id].names.forEach(function (n) {
          const k = normName(n);
          if (k && !byName.has(k)) byName.set(k, id);
        });
      });
      Object.keys(data.programmes).forEach(function (id) {
        if (!byLowerId.has(id.toLowerCase())) byLowerId.set(id.toLowerCase(), id);
      });
      for (let i = 0; i < liveItems.length; i++) {
        const it = liveItems[i];
        let id = null;
        if (it.tvgId) id = byLowerId.get(it.tvgId.toLowerCase()) || null;
        if (!id || !data.programmes[id]) {
          const k = normName(it.name);
          id = k && byName.has(k) ? byName.get(k) : null;
        }
        if (id && data.programmes[id]) this.map.set(it.id, data.programmes[id]);
      }
    }

    get size() {
      return this.map.size;
    }

    /** All programmes we have for this channel, sorted. */
    forChannel(item) {
      return this.map.get(item.id) || [];
    }

    /** {now, next} at time t (milliseconds); either can be null. */
    nowNext(item, t) {
      const list = this.forChannel(item);
      let now = null;
      let next = null;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.start <= t && t < p.stop) {
          now = p;
          next = list[i + 1] || null;
          break;
        }
        if (p.start > t) {
          next = p;
          break;
        }
      }
      return { now: now, next: next };
    }
  }

  const api = { Epg: Epg, normName: normName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LumaEpg = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
