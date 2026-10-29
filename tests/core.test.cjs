const test = require('node:test');
const assert = require('node:assert');
const w = 'app/src/main/assets/www/js/';
const M3U = require('../' + w + 'm3u.js');
const XMLTV = require('../' + w + 'xmltv.js');
const { Epg } = require('../' + w + 'epg.js');
const XT = require('../' + w + 'xtream.js');
const { createStore } = require('../' + w + 'store.js');
const U = require('../' + w + 'util.js');

const PL = `#EXTM3U url-tvg="http://x.test/guide.xml"
#EXTINF:-1 tvg-id="rtl4.nl" tvg-logo="http://l/rtl4.png" group-title="NL, Algemeen",RTL 4 HD
http://h/live/u/p/1.ts
#EXTINF:-1 group-title="Films",De Film (2020)
http://h/movie/u/p/2.mp4
#EXTINF:-1 group-title="Series",Show Naam S01E02 Pilot
http://h/series/u/p/3.mp4
#EXTINF:-1 group-title="Series",Show Naam S01E01
http://h/series/u/p/4.mp4
`;

test('m3u parse and library', () => {
  const items = M3U.parseM3U(PL);
  assert.strictEqual(items.length, 4);
  assert.strictEqual(items[0].name, 'RTL 4 HD');
  assert.strictEqual(items[0].group, 'NL, Algemeen');
  assert.strictEqual(items[0].tvgId, 'rtl4.nl');
  assert.strictEqual(M3U.epgFromHeader(PL), 'http://x.test/guide.xml');
  const lib = M3U.buildLibrary(items, 'src');
  assert.strictEqual(lib.live.length, 1);
  assert.strictEqual(lib.vod.length, 1);
  assert.strictEqual(lib.series.length, 1);
  assert.deepStrictEqual(lib.series[0].episodes.map(e => e.e), [1, 2]);
  assert.strictEqual(lib.series[0].episodes[0].title, 'Aflevering 1');
});

const XML = `<tv><channel id="rtl4.nl"><display-name>RTL 4</display-name><icon src="http://i/a.png"/></channel>
<programme start="20261029180000 +0100" stop="20261029190000 +0100" channel="rtl4.nl"><title lang="nl">RTL Nieuws &amp; Weer</title><desc>Dag</desc></programme>
<programme start="20261029190000 +0100" stop="20261029200000 +0100" channel="rtl4.nl"><title>Film</title></programme></tv>`;

test('xmltv time zones and filtering', () => {
  assert.strictEqual(XMLTV.parseTime('20261029180000 +0100'), Date.UTC(2026, 9, 29, 17, 0, 0));
  assert.strictEqual(XMLTV.parseTime('20261029180000'), Date.UTC(2026, 9, 29, 18, 0, 0));
  const d = XMLTV.parseXmltv(XML, Date.UTC(2026, 9, 29, 17, 30), Date.UTC(2026, 9, 29, 20, 0));
  assert.strictEqual(d.programmes['rtl4.nl'].length, 2);
  assert.strictEqual(d.programmes['rtl4.nl'][0].title, 'RTL Nieuws & Weer');
  const d2 = XMLTV.parseXmltv(XML, Date.UTC(2026, 9, 29, 18, 30), null);
  assert.strictEqual(d2.programmes['rtl4.nl'].length, 1);
});

test('epg matches by id and by name, now/next', () => {
  const lib = M3U.buildLibrary(M3U.parseM3U(PL), 'src');
  const d = XMLTV.parseXmltv(XML, null, null);
  const epg = new Epg(d, lib.live);
  assert.strictEqual(epg.size, 1);
  const t = Date.UTC(2026, 9, 29, 17, 30);
  const nn = epg.nowNext(lib.live[0], t);
  assert.strictEqual(nn.now.title, 'RTL Nieuws & Weer');
  assert.strictEqual(nn.next.title, 'Film');
  const byName = new Epg(d, [{ id: 'x', name: 'rtl4 HD', tvgId: '' }]);
  assert.strictEqual(byName.size, 1);
});

test('xtream urls and normalising', () => {
  const src = { id: 's1', server: 'host:8080/', user: 'a b', pass: 'p' };
  assert.strictEqual(XT.liveUrl(src, 7), 'http://host:8080/live/a%20b/p/7.ts');
  assert.ok(XT.apiUrl(src, 'get_series').includes('action=get_series'));
  const live = XT.normalizeLive(src, [{ stream_id: 7, name: 'NPO 1', category_id: '3', epg_channel_id: 'npo1' }], [{ category_id: '3', category_name: 'NL' }]);
  assert.strictEqual(live[0].group, 'NL');
  assert.strictEqual(live[0].tvgId, 'npo1');
  const eps = XT.normalizeSeriesInfo(src, { episodes: { 2: [{ id: 22, episode_num: 1, title: 'B', container_extension: 'mkv' }], 1: [{ id: 11, episode_num: 1, title: 'A' }] } });
  assert.deepStrictEqual(eps.map(e => e.s), [1, 2]);
  assert.ok(eps[1].url.endsWith('/22.mkv'));
});

test('store: sources, continue list, damaged data', () => {
  const mem = {};
  const st = { getItem: k => mem[k] || null, setItem: (k, v) => { mem[k] = v; } };
  const s = createStore(st);
  const a = s.addSource({ type: 'm3u', url: 'u' });
  assert.strictEqual(s.active().id, a.id);
  s.setProgress('m1', { id: 'm1', kind: 'vod', pos: 60000, dur: 100000, ts: 2 });
  s.setProgress('m2', { id: 'm2', kind: 'vod', pos: 99000, dur: 100000, ts: 3 });
  s.setProgress('m3', { id: 'm3', kind: 'vod', pos: 5000, dur: 100000, ts: 4 });
  assert.deepStrictEqual(s.continueList().map(p => p.id), ['m1']);
  assert.strictEqual(createStore(st).sources().length, 1);
  s.removeSource(a.id);
  assert.strictEqual(s.active(), null);
  assert.strictEqual(createStore({ getItem: () => '{oops', setItem() {} }).sources().length, 0);
});

test('util', () => {
  assert.strictEqual(U.duration(3725000), '1:02:05');
  assert.strictEqual(U.hash('a'), U.hash('a'));
  assert.notStrictEqual(U.hash('a'), U.hash('b'));
});

test('update helpers', () => {
  const UP = require('../' + w + 'update.js');
  assert.ok(UP.isNewer('v0.10', '0.9'));
  assert.ok(!UP.isNewer('0.1', '0.1'));
  assert.ok(!UP.isNewer('v0.1', '0.2'));
  assert.strictEqual(UP.releaseUrl('https://github.com/me/luma-tv.git'), 'https://api.github.com/repos/me/luma-tv/releases?per_page=20');
  assert.strictEqual(UP.releaseUrl('nonsense'), '');
  const r = UP.parseRelease({ tag_name: 'v0.2', assets: [{ name: 'notes.txt', browser_download_url: 'x' }, { name: 'luma.apk', browser_download_url: 'https://d/luma.apk' }] });
  assert.deepStrictEqual([r.version, r.apkUrl], ['v0.2', 'https://d/luma.apk']);
  assert.strictEqual(UP.parseRelease({ assets: [] }), null);
});

test('pick newest release with apk', () => {
  const UP = require('../' + w + 'update.js');
  const mk = (tag, apk) => ({ tag_name: tag, assets: apk ? [{ name: apk, browser_download_url: 'https://d/' + apk }] : [] });
  const list = [{ draft: true, tag_name: 'v9', assets: [] }, mk('v3.3', null), mk('v3.2', 'launcher.apk')];
  assert.strictEqual(UP.pickRelease(list).apkUrl, 'https://d/launcher.apk');
  assert.ok(UP.isNewer('v3.3', '3.2'));
  assert.strictEqual(UP.pickRelease([]), null);
});
