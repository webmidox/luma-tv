(function (g) {
  'use strict';

  /** "v1.2.10" -> [1,2,10] */
  function parts(v) {
    return String(v || '0').replace(/^(launcher-)?v?/i, '').split(/[.\-+]/).map(function (x) { return parseInt(x, 10) || 0; });
  }

  function isNewer(remote, local) {
    const a = parts(remote);
    const b = parts(local);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return false;
  }

  function releaseUrl(repo) {
    const r = String(repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
    return /^[\w.-]+\/[\w.-]+$/.test(r) ? 'https://api.github.com/repos/' + r + '/releases?per_page=20' : '';
  }

  /** The newest published release that carries an APK. */
  function pickRelease(list) {
    if (!Array.isArray(list)) return null;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r || r.draft || r.prerelease) continue;
      const found = parseRelease(r);
      if (found) return found;
    }
    return null;
  }

  /** One release: {version, apkUrl, notes} or null when it has no APK. */
  function parseRelease(json) {
    if (!json || !Array.isArray(json.assets)) return null;
    const apk = json.assets.filter(function (a) { return /\.apk$/i.test(a.name || '') && a.browser_download_url; })[0];
    if (!apk) return null;
    return { version: json.tag_name || json.name || '', apkUrl: apk.browser_download_url, notes: json.body || '' };
  }

  const api = { isNewer: isNewer, releaseUrl: releaseUrl, parseRelease: parseRelease, pickRelease: pickRelease };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LumaUpdate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
