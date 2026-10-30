(function (g) {
  'use strict';

  const ACCENTS = [
    ['Oranje', '#ff8a1f'], ['Blauw', '#4d8dff'], ['Groen', '#2fd08a'], ['Roze', '#ff4f9a'],
    ['Paars', '#9b7bff'], ['Rood', '#ff4d4d'], ['Geel', '#ffd23f'], ['Turquoise', '#27d3d3'], ['Champagne', '#e3c48f'],
    ['Blauw (kleurenblind)', '#0072b2'], ['Oranje (kleurenblind)', '#e69f00'], ['Hemelsblauw (kleurenblind)', '#56b4e9'], ['Groen (kleurenblind)', '#009e73'], ['Roze (kleurenblind)', '#cc79a7']
  ];

  /** "#abc" and "#aabbcc" (with or without #) become "#aabbcc"; anything else gives null. */
  function normHex(s) {
    let v = String(s || '').trim().replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(v)) v = v.split('').map(function (c) { return c + c; }).join('');
    return /^[0-9a-f]{6}$/.test(v) ? '#' + v : null;
  }

  /** Dark text on light accents and white text on dark ones, so a button stays readable in any colour. */
  function onColor(hex) {
    const h = normHex(hex) || '#ffffff';
    const c = [1, 3, 5].map(function (i) {
      const v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return lum > 0.4 ? '#14110a' : '#ffffff';
  }

  /** 'auto' follows the clock: light from 07:00 to 19:00. */
  function resolveMode(mode, date) {
    if (MODES.indexOf(mode) >= 0) return mode;
    const hr = (date || new Date()).getHours();
    return hr >= 7 && hr < 19 ? 'light' : 'dark';
  }

  const MODES = ['dark', 'black', 'light', 'ocean', 'forest', 'sunset', 'purple'];
  const SIZES = { small: 0.46875, normal: 0.52083, large: 0.5859 };

  const api = { ACCENTS: ACCENTS, normHex: normHex, onColor: onColor, resolveMode: resolveMode, MODES: MODES, SIZES: SIZES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LumaTheme = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
