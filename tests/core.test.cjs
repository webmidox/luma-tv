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

test('store: profiles keep their own data; old data becomes the first profile', () => {
  const mem = { 'luma.v1': JSON.stringify({ sources: [], progress: { a: { id: 'a', kind: 'vod', pos: 60000, dur: 100000, ts: 1 } }, recent: ['x'], prefs: { repo: 'a/b' } }) };
  const st = { getItem: k => mem[k] || null, setItem: (k, v) => { mem[k] = v; } };
  const s = createStore(st);
  assert.strictEqual(s.profiles().length, 1);
  assert.deepStrictEqual(s.continueList().map(p => p.id), ['a']);
  assert.strictEqual(s.pref('repo'), 'a/b');
  const kid = s.addProfile({ name: 'Kids', kid: true });
  s.switchProfile(kid.id);
  assert.strictEqual(s.continueList().length, 0);
  assert.strictEqual(s.toggleFav('c1'), true);
  s.setUi('theme', 'light');
  s.toggleHidden('Adult');
  assert.ok(s.isHidden('Adult'));
  s.switchProfile(s.profiles()[0].id);
  assert.strictEqual(s.isFav('c1'), false);
  assert.strictEqual(s.ui('theme', 'dark'), 'dark');
  assert.strictEqual(createStore(st).profiles().length, 2);
  assert.strictEqual(s.removeProfile(kid.id), true);
  assert.strictEqual(s.removeProfile(s.profiles()[0].id), false);
});

test('store: reminders fire once, favourites toggle', () => {
  const s = createStore({ getItem: () => null, setItem() {} });
  const now = 1000000000000;
  assert.strictEqual(s.toggleReminder({ chId: 'c', chName: 'C', title: 'T', start: now + 30000 }), true);
  assert.strictEqual(s.toggleReminder({ chId: 'c', chName: 'C', title: 'Later', start: now + 3600000 }), true);
  assert.strictEqual(s.dueReminders(now, 60000).length, 1);
  assert.strictEqual(s.dueReminders(now, 60000).length, 0);
  assert.strictEqual(s.hasReminder('c', now + 3600000), true);
  assert.strictEqual(s.toggleReminder({ chId: 'c', start: now + 3600000 }), false);
  s.resetProfile();
  assert.strictEqual(s.reminders().length, 0);
});

test('theme helpers', () => {
  const T = require('../' + w + 'theme.js');
  assert.strictEqual(T.normHex('F50'), '#ff5500');
  assert.strictEqual(T.normHex('#ff8a1f'), '#ff8a1f');
  assert.strictEqual(T.normHex('rood'), null);
  assert.strictEqual(T.onColor('#ffd23f'), '#14110a');
  assert.strictEqual(T.onColor('#2a2fff'), '#ffffff');
  assert.strictEqual(T.resolveMode('auto', new Date(2026, 0, 1, 12)), 'light');
  assert.strictEqual(T.resolveMode('auto', new Date(2026, 0, 1, 22)), 'dark');
  assert.strictEqual(T.resolveMode('black'), 'black');
});

test('meta: title cleaning, lookup and cache', async () => {
  const Meta = require('../' + w + 'meta.js');
  assert.deepStrictEqual(Meta.cleanTitle('NL: De Film (2020) 4K HD'), { title: 'De Film', year: 2020 });
  assert.deepStrictEqual(Meta.cleanTitle('Show Naam S01E02'), { title: 'Show Naam', year: 0 });
  assert.strictEqual(await Meta.lookup('vod', 'x', '', 'nl-NL', async () => ({})), null);
  let seen = '';
  const r = await Meta.lookup('vod', 'De Film (2020)', 'KEY', 'nl-NL', async (u) => {
    seen = u;
    return { results: [{ title: 'zonder', overview: 'a' }, { backdrop_path: '/b.jpg', poster_path: '/p.jpg', vote_average: 7.46, release_date: '2020-05-01', overview: 'Uitleg' }] };
  });
  assert.ok(seen.includes('search/movie') && seen.includes('year=2020') && seen.includes('api_key=KEY'));
  assert.strictEqual(r.backdrop, 'https://image.tmdb.org/t/p/w1280/b.jpg');
  assert.strictEqual(r.rating, 7.5);
  assert.strictEqual(r.year, 2020);
  const mem = {};
  const c = Meta.createCache({ getItem: k => mem[k] || null, setItem: (k, v) => { mem[k] = v; } }, 'm', 2);
  c.set('a', 1); c.set('b', 2); c.set('c', 3);
  assert.strictEqual(c.get('a'), undefined);
  assert.strictEqual(c.get('c'), 3);
});

test('store: my list, watched, stats, channel overrides, searches', () => {
  const s = createStore({ getItem: () => null, setItem() {} });
  assert.strictEqual(s.toggleList({ id: 'm1', kind: 'vod', name: 'A' }), true);
  assert.ok(s.inList('m1'));
  assert.strictEqual(s.toggleList({ id: 'm1' }), false);
  assert.strictEqual(s.toggleWatched('m1'), true);
  s.addWatch(60000, 'NPO 1', '2026-10-29');
  s.addWatch(120000, 'Film', '2026-10-29');
  s.addWatch(30000, 'NPO 1', '2026-10-30');
  const st = s.statsFor(2, '2026-10-30T12:00:00Z');
  assert.strictEqual(st.total, 210000);
  assert.deepStrictEqual(st.top[0], ['Film', 120000]);
  s.setChan('c1', { hide: true, num: 7 });
  assert.deepStrictEqual(s.hiddenChannels(), ['c1']);
  s.setChan('c1', { hide: false });
  assert.deepStrictEqual(s.chan('c1'), { num: 7 });
  s.addSearch('rtl'); s.addSearch('npo'); s.addSearch('rtl');
  assert.deepStrictEqual(s.searches(), ['rtl', 'npo']);
  assert.strictEqual(s.toggleZap('c1'), true);
});

test('xmltv keeps category and picture', () => {
  const d = XMLTV.parseXmltv('<tv><programme start="20261029183000 +0000" stop="20261029193000 +0000" channel="a"><title>T</title><category lang="nl">Film</category><icon src="http://i/x.jpg"/></programme></tv>', null, null);
  assert.strictEqual(d.programmes.a[0].cat, 'Film');
  assert.strictEqual(d.programmes.a[0].img, 'http://i/x.jpg');
});
