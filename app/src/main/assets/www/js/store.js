(function (g) {
  'use strict';

  const KEY = 'luma.v1';
  const MAX_PROGRESS = 200;
  const COLORS = 8;

  /**
   * Everything the app remembers. Sources and a few global settings are shared; everything personal (progress,
   * recent and favourite channels, hidden categories, reminders, look and feel) is kept per profile. All of it stays
   * on this device. Pass localStorage, or any object with the same getItem/setItem, so the logic can be tested.
   */
  function createStore(storage) {
    let st = { sources: [], active: null, profiles: [], profile: null, data: {}, prefs: {} };
    try {
      const raw = storage.getItem(KEY);
      if (raw) st = Object.assign(st, JSON.parse(raw));
    } catch (e) {
      // A damaged store starts empty.
    }

    function blank() {
      return { progress: {}, recent: [], favs: [], hidden: {}, reminders: [], ui: {}, list: [], watched: {}, stats: {}, chan: {}, zap: [], searches: [] };
    }

    // Older versions kept one set of data; it becomes the first profile.
    if (!Array.isArray(st.profiles) || !st.profiles.length) {
      st.profiles = [{ id: 'p1', name: 'Ik', color: 0, kid: false }];
      st.profile = 'p1';
      st.data = st.data || {};
      st.data.p1 = Object.assign(blank(), { progress: st.progress || {}, recent: st.recent || [] });
      delete st.progress;
      delete st.recent;
    }
    st.prefs = st.prefs || {};
    st.data = st.data || {};

    function save() {
      try {
        storage.setItem(KEY, JSON.stringify(st));
      } catch (e) {
        // Storage full or blocked: keep working in memory.
      }
    }

    function cur() {
      if (!st.profiles.some(function (p) { return p.id === st.profile; })) st.profile = st.profiles[0].id;
      if (!st.data[st.profile]) st.data[st.profile] = blank();
      const d = st.data[st.profile];
      const b = blank();
      Object.keys(b).forEach(function (k) { if (d[k] == null) d[k] = b[k]; });
      return d;
    }

    function prune() {
      const p = cur().progress;
      const ids = Object.keys(p);
      if (ids.length <= MAX_PROGRESS) return;
      ids.sort(function (a, b) { return p[a].ts - p[b].ts; });
      ids.slice(0, ids.length - MAX_PROGRESS).forEach(function (id) { delete p[id]; });
    }

    return {
      // ----- sources -----
      sources: function () { return st.sources; },

      active: function () {
        for (let i = 0; i < st.sources.length; i++) if (st.sources[i].id === st.active) return st.sources[i];
        return st.sources[0] || null;
      },

      addSource: function (src) {
        const s = Object.assign({}, src);
        if (!s.id) s.id = 's' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
        st.sources.push(s);
        st.active = s.id;
        save();
        return s;
      },

      setSourceOff: function (id, off) {
        st.sources.forEach(function (x) { if (x.id === id) x.off = !!off; });
        save();
      },

      setActive: function (id) {
        st.active = id;
        save();
      },

      removeSource: function (id) {
        st.sources = st.sources.filter(function (s) { return s.id !== id; });
        if (st.active === id) st.active = st.sources.length ? st.sources[0].id : null;
        save();
      },

      // ----- profiles -----
      profiles: function () { return st.profiles; },

      profile: function () {
        cur();
        return st.profiles.filter(function (p) { return p.id === st.profile; })[0];
      },

      switchProfile: function (id) {
        if (!st.profiles.some(function (p) { return p.id === id; })) return;
        st.profile = id;
        save();
      },

      addProfile: function (p) {
        const n = { id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), name: (p.name || '').trim() || 'Profiel',
          color: p.color == null ? st.profiles.length % COLORS : p.color, kid: !!p.kid };
        st.profiles.push(n);
        st.data[n.id] = blank();
        save();
        return n;
      },

      updateProfile: function (id, patch) {
        st.profiles.forEach(function (p) { if (p.id === id) Object.assign(p, patch); });
        save();
      },

      /** A copy of the profile with everything in it (favourites, history, look). */
      copyProfile: function (id) {
        const src = st.profiles.filter(function (p) { return p.id === id; })[0];
        if (!src) return null;
        const n = this.addProfile({ name: src.name + ' (kopie)', color: src.color, kid: src.kid });
        st.data[n.id] = JSON.parse(JSON.stringify(st.data[id] || blank()));
        save();
        return n;
      },

      /** Adds the favourites and zap list of one profile to another. */
      shareFavs: function (from, to) {
        const a = st.data[from], b = st.data[to];
        if (!a || !b) return;
        a.favs.forEach(function (x) { if (b.favs.indexOf(x) < 0) b.favs.push(x); });
        a.zap.forEach(function (x) { if (b.zap.indexOf(x) < 0) b.zap.push(x); });
        save();
      },

      /** Empties a profile (used for guest profiles). */
      wipeProfile: function (id) {
        st.data[id] = blank();
        save();
      },

      /** The last profile cannot be removed. */
      removeProfile: function (id) {
        if (st.profiles.length < 2) return false;
        st.profiles = st.profiles.filter(function (p) { return p.id !== id; });
        delete st.data[id];
        if (st.profile === id) st.profile = st.profiles[0].id;
        save();
        return true;
      },

      // ----- watching -----
      setProgress: function (id, entry) {
        cur().progress[id] = entry;
        prune();
        save();
      },

      getProgress: function (id) {
        return cur().progress[id] || null;
      },

      /** Films and episodes that were started and not finished, newest first. */
      continueList: function (limit) {
        const out = [];
        const p = cur().progress;
        Object.keys(p).forEach(function (id) {
          const e = p[id];
          if (!e || e.kind === 'live') return;
          if (!(e.pos > 20000)) return;
          if (e.dur > 0 && e.pos / e.dur >= 0.95) return;
          out.push(e);
        });
        out.sort(function (a, b) { return b.ts - a.ts; });
        return out.slice(0, limit || 12);
      },

      pushRecent: function (id) {
        const d = cur();
        d.recent = [id].concat(d.recent.filter(function (x) { return x !== id; })).slice(0, 24);
        save();
      },

      recent: function () { return cur().recent; },
      /** The title a profile watched most recently, or ''. */
      lastOf: function (pid) {
        const d = st.data[pid];
        if (!d) return '';
        const e = Object.keys(d.progress || {}).map(function (k) { return d.progress[k]; }).filter(function (x) { return x && x.kind !== 'live' && x.title; }).sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); })[0];
        return e ? (e.showName || e.title) : '';
      },
      /** What the other profiles watched last: [{name, recent, cont}]. */
      others: function () {
        return st.profiles.filter(function (p) { return p.id !== st.profile && st.data[p.id]; }).map(function (p) {
          const d = st.data[p.id];
          const prog = Object.keys(d.progress || {}).map(function (k) { return d.progress[k]; }).sort(function (a, b) { return (b.t || 0) - (a.t || 0); })[0];
          return { name: p.name, recent: (d.recent || [])[0] || '', cont: prog || null };
        });
      },

      // ----- favourites -----
      favs: function () { return cur().favs; },
      isFav: function (id) { return cur().favs.indexOf(id) >= 0; },

      /** Returns true when the channel is now a favourite. */
      toggleFav: function (id) {
        const d = cur();
        const i = d.favs.indexOf(id);
        if (i >= 0) d.favs.splice(i, 1);
        else d.favs.push(id);
        save();
        return i < 0;
      },

      setFavs: function (list) {
        cur().favs = Array.isArray(list) ? list.slice() : [];
        save();
      },

      // ----- hidden categories -----
      isHidden: function (group) { return !!cur().hidden[group]; },
      toggleHidden: function (group) {
        const h = cur().hidden;
        if (h[group]) delete h[group];
        else h[group] = 1;
        save();
        return !!h[group];
      },

      // ----- reminders -----
      reminders: function () { return cur().reminders; },
      hasReminder: function (chId, start) {
        return cur().reminders.some(function (r) { return r.chId === chId && r.start === start; });
      },
      /** Adds the reminder, or removes it when it already exists. Returns true when it is set afterwards. */
      toggleReminder: function (r) {
        const d = cur();
        const i = d.reminders.findIndex(function (x) { return x.chId === r.chId && x.start === r.start; });
        if (i >= 0) d.reminders.splice(i, 1);
        else d.reminders.push({ chId: r.chId, chName: r.chName, title: r.title, start: r.start, end: r.end || 0, rec: !!r.rec, weekly: !!r.weekly, fired: false });
        save();
        return i < 0;
      },
      /** Reminders that start within windowMs and were not shown yet; they are marked shown. Old ones are dropped. */
      /** Minutes watched per profile over the last n days: [{name, ms, top}]. */
      statsAll: function (days) {
        const end = Date.now();
        return st.profiles.map(function (p) {
          const d = st.data[p.id];
          const s = (d && d.stats) || {};
          let ms = 0;
          const by = {};
          for (let i = 0; i < days; i++) {
            const e = s[new Date(end - i * 86400000).toISOString().slice(0, 10)];
            if (!e) continue;
            ms += e.ms;
            Object.keys(e.by).forEach(function (l) { by[l] = (by[l] || 0) + e.by[l]; });
          }
          const top = Object.keys(by).sort(function (x, y) { return by[y] - by[x]; })[0] || '';
          return { name: p.name, ms: ms, top: top };
        });
      },
      /** Films and series that two or more profiles have watched. */
      overlap: function () {
        const count = {};
        st.profiles.forEach(function (p) {
          const d = st.data[p.id];
          if (!d || !d.progress) return;
          const mine = {};
          Object.keys(d.progress).forEach(function (k) {
            const e = d.progress[k];
            if (!e || e.kind === 'live' || !(e.pos > 60000)) return;
            mine[e.kind === 'series' ? e.showId : e.id] = 1;
          });
          Object.keys(d.watched || {}).forEach(function (k) { mine[k] = 1; });
          Object.keys(mine).forEach(function (k) { if (k) count[k] = (count[k] || 0) + 1; });
        });
        return Object.keys(count).filter(function (k) { return count[k] >= 2; });
      },
      /** What one profile watched on a day (0 = today, 1 = yesterday): {ms, top: [[label, ms]]}. */
      dayOf: function (pid, back) {
        const d = st.data[pid];
        const e = d && d.stats ? d.stats[new Date(Date.now() - back * 86400000).toISOString().slice(0, 10)] : null;
        if (!e) return { ms: 0, top: [] };
        return { ms: e.ms, top: Object.keys(e.by).sort(function (x, y) { return e.by[y] - e.by[x]; }).slice(0, 6).map(function (k) { return [k, e.by[k]]; }) };
      },
      dueReminders: function (now, windowMs, recExtra) {
        const d = cur();
        d.reminders = d.reminders.filter(function (r) { return r.start > now - 3600000; });
        const due = d.reminders.filter(function (r) { return !r.fired && r.start - now <= windowMs + (r.rec ? recExtra || 0 : 0); });
        due.forEach(function (r) {
          r.fired = true;
          if (r.weekly) d.reminders.push({ chId: r.chId, chName: r.chName, title: r.title, start: r.start + 7 * 86400000, end: r.end ? r.end + 7 * 86400000 : 0, rec: !!r.rec, weekly: true, fired: false });
        });
        if (due.length) save();
        return due;
      },

      /** Forgets progress, favourites, hidden categories and reminders of this profile; the look stays. */
      resetProfile: function (id) {
        const pid = id || st.profile;
        const ui = (st.data[pid] || {}).ui || {};
        st.data[pid] = Object.assign(blank(), { ui: id ? {} : ui });
        save();
      },

      // ----- my list, watched, history -----
      listItems: function () { return cur().list; },
      inList: function (id) { return cur().list.some(function (x) { return x.id === id; }); },
      /** Adds or removes a film or series from "Mijn lijst". Returns true when it is in the list afterwards. */
      toggleList: function (item) {
        const d = cur();
        const i = d.list.findIndex(function (x) { return x.id === item.id; });
        if (i >= 0) d.list.splice(i, 1);
        else d.list.unshift({ id: item.id, kind: item.kind, name: item.name, logo: item.logo || '', group: item.group || '' });
        save();
        return i < 0;
      },
      isWatched: function (id) { return !!cur().watched[id]; },
      markWatched: function (id) {
        cur().watched[id] = 1;
        save();
      },
      toggleWatched: function (id) {
        const w = cur().watched;
        if (w[id]) delete w[id];
        else w[id] = 1;
        save();
        return !!w[id];
      },
      removeProgress: function (id) {
        delete cur().progress[id];
        save();
      },
      /** Everything with progress, newest first (films and episodes). */
      historyList: function (limit) {
        const p = cur().progress;
        return Object.keys(p).map(function (k) { return p[k]; }).filter(function (e) { return e && e.kind !== 'live'; })
          .sort(function (a, b) { return b.ts - a.ts; }).slice(0, limit || 50);
      },

      // ----- viewing statistics (minutes per day and per channel or title, last 60 days) -----
      addWatch: function (ms, label, day) {
        if (!(ms > 0)) return;
        const s = cur().stats;
        const k = day || new Date().toISOString().slice(0, 10);
        const e = s[k] || (s[k] = { ms: 0, by: {} });
        e.ms += ms;
        e.by[label] = (e.by[label] || 0) + ms;
        const keys = Object.keys(s).sort();
        keys.slice(0, Math.max(0, keys.length - 400)).forEach(function (x) { delete s[x]; });
        save();
      },
      /** {total, byDay: [[day, ms]], top: [[label, ms]]} over the last n days. */
      statsFor: function (days, today) {
        const s = cur().stats;
        const end = new Date(today || Date.now());
        const out = { total: 0, byDay: [], top: [] };
        const by = {};
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10);
          const e = s[d];
          out.byDay.push([d, e ? e.ms : 0]);
          if (e) {
            out.total += e.ms;
            Object.keys(e.by).forEach(function (l) { by[l] = (by[l] || 0) + e.by[l]; });
          }
        }
        out.top = Object.keys(by).map(function (l) { return [l, by[l]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
        return out;
      },

      // ----- per channel settings: hidden, own number, own name -----
      chan: function (id) { return cur().chan[id] || {}; },
      setChan: function (id, patch) {
        const c = cur().chan;
        const n = Object.assign({}, c[id] || {}, patch);
        Object.keys(n).forEach(function (k) { if (n[k] === '' || n[k] === false || n[k] == null) delete n[k]; });
        if (Object.keys(n).length) c[id] = n;
        else delete c[id];
        save();
      },
      hiddenChannels: function () {
        const c = cur().chan;
        return Object.keys(c).filter(function (id) { return c[id].hide; });
      },

      // ----- quick zap list and recent searches -----
      zapList: function () { return cur().zap; },
      toggleZap: function (id) {
        const z = cur().zap;
        const i = z.indexOf(id);
        if (i >= 0) z.splice(i, 1);
        else z.push(id);
        save();
        return i < 0;
      },
      searches: function () { return cur().searches; },
      addSearch: function (q) {
        const t = (q || '').trim();
        if (t.length < 2) return;
        const d = cur();
        d.searches = [t].concat(d.searches.filter(function (x) { return x !== t; })).slice(0, 8);
        save();
      },

      // ----- last known size of a source, to tell what is new -----
      seen: function (sourceId) { return (st.seen || {})[sourceId] || 0; },
      setSeen: function (sourceId, n) {
        st.seen = st.seen || {};
        st.seen[sourceId] = n;
        save();
      },

      // ----- settings -----
      /** Global settings (update repositories, pin, locked words). */
      pref: function (k) { return st.prefs[k] || ''; },
      setPref: function (k, v) {
        st.prefs[k] = v;
        save();
      },

      /** Look and feel of the current profile. */
      ui: function (k, def) {
        const v = cur().ui[k];
        return v == null ? def : v;
      },
      setUi: function (k, v) {
        cur().ui[k] = v;
        save();
      }
    };
  }

  const api = { createStore: createStore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LumaStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
