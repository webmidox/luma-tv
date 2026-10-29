(function (g) {
  'use strict';

  /** Tiny element builder: h('div', {class: 'x', onclick: fn}, [children]). */
  function h(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  /** FNV-1a, 32 bit: short stable ids for items, so progress survives a reload. */
  function hash(str) {
    let x = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      x ^= str.charCodeAt(i);
      x = Math.imul(x, 0x01000193) >>> 0;
    }
    return x.toString(36);
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function clock(ms) {
    const d = new Date(ms);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function duration(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return hh > 0 ? hh + ':' + pad(mm) + ':' + pad(ss) : mm + ':' + pad(ss);
  }

  const api = { h: h, hash: hash, pad: pad, clock: clock, duration: duration };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LumaUtil = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
