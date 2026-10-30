const test = require('node:test');
const assert = require('node:assert');
const { createStore } = require('../app/src/main/assets/www/js/store.js');

function mem() {
  const m = {};
  return { getItem: function (k) { return m[k] || null; }, setItem: function (k, v) { m[k] = v; } };
}

function twoProfiles() {
  const s = createStore(mem());
  s.addProfile({ name: 'Mike', color: 0 });
  s.addProfile({ name: 'Sam', color: 1, kid: true });
  return s;
}

test('a damaged store starts empty and keeps working', () => {
  const st = { getItem: function () { return '{kapot'; }, setItem: function () {} };
  const s = createStore(st);
  assert.ok(s.profiles().length >= 1);
  assert.deepStrictEqual(s.sources(), []);
});

test('overlap finds titles watched by two profiles', () => {
  const s = twoProfiles();
  const ids = s.profiles().map(function (p) { return p.id; });
  s.switchProfile(ids[0]);
  s.setProgress('film1', { id: 'film1', kind: 'vod', pos: 120000, dur: 600000, ts: Date.now() });
  s.setProgress('film2', { id: 'film2', kind: 'vod', pos: 120000, dur: 600000, ts: Date.now() });
  s.switchProfile(ids[1]);
  s.setProgress('film1', { id: 'film1', kind: 'vod', pos: 90000, dur: 600000, ts: Date.now() });
  assert.deepStrictEqual(s.overlap(), ['film1']);
});

test('lastOf gives the latest title of a profile', () => {
  const s = twoProfiles();
  const p = s.profiles()[0];
  s.switchProfile(p.id);
  s.setProgress('a', { id: 'a', kind: 'vod', title: 'Oud', pos: 1, dur: 2, ts: 1000 });
  s.setProgress('b', { id: 'b', kind: 'vod', title: 'Nieuw', pos: 1, dur: 2, ts: 2000 });
  assert.strictEqual(s.lastOf(p.id), 'Nieuw');
});

test('statsAll and dayOf add up what was watched', () => {
  const s = twoProfiles();
  const p = s.profiles().filter(function (x) { return x.name === 'Mike'; })[0];
  s.switchProfile(p.id);
  s.addWatch(600000, 'NPO 1');
  s.addWatch(300000, 'RTL 4');
  const row = s.statsAll(7).filter(function (r) { return r.name === 'Mike'; })[0];
  assert.strictEqual(row.ms, 900000);
  assert.strictEqual(row.top, 'NPO 1');
  assert.strictEqual(s.dayOf(p.id, 0).ms, 900000);
  assert.strictEqual(s.dayOf(p.id, 1).ms, 0);
});

test('reminders: recordings start early, plain ones do not', () => {
  const s = createStore(mem());
  const now = Date.now();
  s.toggleReminder({ chId: 'c1', chName: 'A', title: 'Opname', start: now + 150000, rec: true });
  s.toggleReminder({ chId: 'c2', chName: 'B', title: 'Gewoon', start: now + 150000 });
  const due = s.dueReminders(now, 60000, 120000);
  assert.deepStrictEqual(due.map(function (r) { return r.title; }), ['Opname']);
});

test('channel overrides drop empty values', () => {
  const s = createStore(mem());
  s.setChan('x', { sport: true, folder: 'Sport' });
  assert.strictEqual(s.chan('x').sport, true);
  s.setChan('x', { sport: false, folder: '' });
  assert.deepStrictEqual(s.chan('x'), {});
});
