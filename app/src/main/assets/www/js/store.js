(function (g) {
  'use strict';

  const KEY = 'luma.v1';
  const MAX_PROGRESS = 200;

  /**
   * Everything the app remembers: the sources the owner added, how far they got in films and episodes, and the
   * channels they watched recently. It all stays on this device. Pass localStorage, or any object with the same
   * getItem/setItem, so the logic can be tested.
   */
  function createStore(storage) {
    let st = { sources: [], active: null, progress: {}, recent: [], prefs: {} };
    try {
      const raw = storage.getItem(KEY);
      if (raw) st = Object.assign(st, JSON.parse(raw));
    } catch (e) {
      // A damaged store starts empty.
    }

    function save() {
      try {
        storage.setItem(KEY, JSON.stringify(st));
      } catch (e) {
        // Storage full or blocked: keep working in memory.
      }
    }

    function prune() {
      const ids = Object.keys(st.progress);
      if (ids.length <= MAX_PROGRESS) return;
      ids.sort(function (a, b) { return st.progress[a].ts - st.progress[b].ts; });
      ids.slice(0, ids.length - MAX_PROGRESS).forEach(function (id) { delete st.progress[id]; });
    }

    return {
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

      setActive: function (id) {
        st.active = id;
        save();
      },

      removeSource: function (id) {
        st.sources = st.sources.filter(function (s) { return s.id !== id; });
        if (st.active === id) st.active = st.sources.length ? st.sources[0].id : null;
        save();
      },

      setProgress: function (id, entry) {
        st.progress[id] = entry;
        prune();
        save();
      },

      getProgress: function (id) {
        return st.progress[id] || null;
      },

      /** Films and episodes that were started and not finished, newest first. */
      continueList: function (limit) {
        const out = [];
        Object.keys(st.progress).forEach(function (id) {
          const p = st.progress[id];
          if (!p || p.kind === 'live') return;
          if (!(p.pos > 20000)) return;
          if (p.dur > 0 && p.pos / p.dur >= 0.95) return;
          out.push(p);
        });
        out.sort(function (a, b) { return b.ts - a.ts; });
        return out.slice(0, limit || 12);
      },

      pushRecent: function (id) {
        st.recent = [id].concat(st.recent.filter(function (x) { return x !== id; })).slice(0, 24);
        save();
      },

      recent: function () {
        return st.recent;
      },

      pref: function (k) {
        return (st.prefs || {})[k] || '';
      },

      setPref: function (k, v) {
        st.prefs = st.prefs || {};
        st.prefs[k] = v;
        save();
      }
    };
  }

  const api = { createStore: createStore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LumaStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
