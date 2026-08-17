'use strict';
const fs = require('fs');
const path = require('path');
const { run, settle } = require('./dom');
const NEW = path.join(__dirname, '..', 'golf-tour.html');
const OLD = path.join(__dirname, 'old', 'golf-tour.html');
/* tests/old/ は「修正前」のコピー。無ければ再現テストは飛ばす。
   作り直す時: git show <修正前のrev>:golf-tour.html > tests/old/golf-tour.html */
const HAS_OLD = fs.existsSync(OLD);
let skipped = 0;
const KEY = 'golf-tour-v1';

let pass = 0, fail = 0;
function chk(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const b64 = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const GOOD = {
  title: '社内ゴルフツアー',
  members: [{ name: '田中', hd: 10 }, { name: '佐藤', hd: 12 }],
  comps: [{ name: '第1戦', date: '2026-05-01', rows: [{ m: 0, gross: 90, hd: 10 }, { m: 1, gross: 95, hd: 12 }] }],
  badges: [{ m: 0, name: 'イーグル', comp: '第1戦' }],
  t: 1000
};
const seed = () => ({ [KEY]: JSON.stringify(GOOD) });
const readState = env => JSON.parse(env.store[KEY] || 'null');

console.log('\n=== golf-tour.html ===');

console.log('\n[1] 共有ハッシュの無言適用');
{
  const ATTACK = { members: [{ name: 'x', hd: 0 }], comps: [], badges: [], t: 9999999999999 };
  const hash = '#d=' + b64(ATTACK);

  if (HAS_OLD) {
    const o = run(OLD, { storage: seed(), hash, confirm: false });
    chk('OLD: 未来tのリンクが無確認で全記録を消す(再現)',
      o.log.confirms.length === 0 && readState(o).comps.length === 0,
      'confirms=' + o.log.confirms.length);
  } else skipped++;

  const n = run(NEW, { storage: seed(), hash, confirm: false });
  chk('NEW: 必ず確認が出る', n.log.confirms.length === 1, JSON.stringify(n.log.confirms));
  chk('NEW: 断れば記録はそのまま', readState(n).comps.length === 1 && readState(n).members.length === 2);
  chk('NEW: 例外なし', n.log.errors.length === 0, n.log.errors.join('|'));

  const y = run(NEW, { storage: seed(), hash, confirm: true });
  chk('NEW: 承諾すれば置き換わる', readState(y).comps.length === 0 && readState(y).members.length === 1);
}

console.log('\n[2] 自分のURLでは訊かない(往復)');
{
  const env = run(NEW, { storage: seed(), hash: '' });
  const own = env.ctx.location.hash;   // persist() が書いていれば入る
  const again = run(NEW, { storage: { [KEY]: env.store[KEY] || JSON.stringify(GOOD) }, hash: own || '#d=' + b64(GOOD) });
  chk('同じ中身のリンクでは確認が出ない', again.log.confirms.length === 0, JSON.stringify(again.log.confirms));
}

console.log('\n[3] 壊れたデータで画面が死なない');
const POISON = [
  ['rowsが無いコンペ', { members: [{ name: 'A', hd: 0 }], comps: [{ name: 'x' }], badges: [], t: 1 }],
  ['rowsが空のコンペ', { members: [{ name: 'A', hd: 0 }], comps: [{ name: 'x', rows: [] }], badges: [], t: 1 }],
  ['membersにnull', { members: [null, { name: 'A', hd: 0 }], comps: [], badges: [], t: 1 }],
  ['__proto__バッジ', { members: [{ name: 'A', hd: 0 }], comps: [], badges: [{ m: 0, name: '__proto__' }], t: 1 }],
  ['居ないメンバー宛の行', { members: [{ name: 'A', hd: 0 }], comps: [{ name: 'x', rows: [{ m: 99, gross: 90, hd: 0 }] }], badges: [{ m: 42, name: 'イーグル' }], t: 1 }],
  ['数値であるべき所が文字列', { members: [{ name: 'A', hd: 'x<script>' }], comps: [{ name: 'x', rows: [{ m: 0, gross: 'NaN', hd: {} }] }], badges: [], t: 1 }],
  ['membersが配列でない', { members: { a: 1 }, comps: [], badges: [], t: 1 }],
];
for (const [label, data] of POISON) {
  const n = run(NEW, { storage: { [KEY]: JSON.stringify(data) } });
  let tag = '';
  if (HAS_OLD) {
    const o = run(OLD, { storage: { [KEY]: JSON.stringify(data) } });
    tag = o.log.errors.length > 0 ? ' (OLDは死ぬ)' : ' (OLDも耐える)';
  }
  chk('NEW: ' + label + ' で例外なし' + tag, n.log.errors.length === 0, n.log.errors.join('|'));
}

console.log('\n[4] sanitize が実際に値を直す');
{
  const data = {
    members: [{ name: 'A'.repeat(999), hd: 1e9 }, { name: '<img src=x onerror=1>', hd: -5 }],
    comps: [{ name: 'c', rows: [{ m: 0, gross: 90, hd: 0 }, { m: 77, gross: 90, hd: 0 }] }],
    badges: [{ m: 0, name: 'constructor' }, { m: 1, name: 'イーグル', comp: 'c' }],
    t: 1
  };
  const n = run(NEW, { storage: { [KEY]: JSON.stringify(data) } });
  // load() だけでは保存し直さないので、1回 persist を起こして中身を確定させる
  n.el('m-name').value = 'Z';
  n.el('m-add').fire('click');
  const s = readState(n);
  chk('名前が12字に丸められる', s.members[0].name.length === 12, s.members[0].name.length);
  chk('hdが範囲内に収まる', s.members[0].hd === 60 && s.members[1].hd === -5, JSON.stringify([s.members[0].hd, s.members[1].hd]));
  chk('居ないメンバー宛の行が消える', s.comps[0].rows.length === 1, JSON.stringify(s.comps[0].rows));
  chk('危険なバッジ名が消える', s.badges.length === 1 && s.badges[0].name === 'イーグル', JSON.stringify(s.badges));
}

console.log('\n[5] 保存できない時に黙らない');
{
  const n = run(NEW, { storage: seed(), storageFull: true });
  n.el('bd-member').value = '0';
  n.el('bd-name').value = 'イーグル';
  n.el('bd-add').fire('click');
  const w = n.storeWarn();
  chk('赤バナーが出る', w && w.hidden === false && /保存できていません/.test(w.text), JSON.stringify(w));
  chk('トーストが成功を騙らない', /保存できていません/.test(n.toastText()), n.toastText());

  if (HAS_OLD) {
    const o = run(OLD, { storage: seed(), storageFull: true });
    o.el('bd-member').value = '0';
    o.el('bd-name').value = 'イーグル';
    o.el('bd-add').fire('click');
    chk('OLD: 失敗を握りつぶして「殿堂入り」と出す(再現)', /殿堂入り/.test(o.toastText()), o.toastText());
  } else skipped++;
}

console.log('\n[6] 普段使いが重くなっていないこと');
{
  const fresh = run(NEW, { storage: {}, hash: '' });
  chk('新規: 確認ゼロで起動', fresh.log.confirms.length === 0 && fresh.log.errors.length === 0, fresh.log.errors.join('|'));
  fresh.el('m-name').value = '鈴木';
  fresh.el('m-add').fire('click');
  chk('メンバー追加が保存される', readState(fresh).members.length === 1 && readState(fresh).members[0].name === '鈴木',
    JSON.stringify(readState(fresh) && readState(fresh).members));
  chk('保存できていれば赤バナーは出ない', fresh.storeWarn().hidden === true);

  const keep = run(NEW, { storage: seed(), hash: '' });
  chk('既存データが確認なしでそのまま読める',
    keep.log.confirms.length === 0 && keep.log.errors.length === 0, keep.log.errors.join('|'));
  keep.el('m-name').value = '高橋';
  keep.el('m-add').fire('click');
  const s2 = readState(keep);
  chk('既存のコンペ記録が壊れない', s2.comps.length === 1 && s2.comps[0].rows.length === 2 && s2.members.length === 3,
    JSON.stringify({ c: s2.comps.length, r: s2.comps[0].rows.length, m: s2.members.length }));
  chk('既存のバッジが残る', s2.badges.length === 1 && s2.badges[0].name === 'イーグル', JSON.stringify(s2.badges));
}

console.log('\ngolf: ' + pass + ' passed, ' + fail + ' failed' + (skipped ? ', ' + skipped + ' 再現テストはtests/old/が無いので省略' : ''));
process.exitCode = fail ? 1 : 0;
