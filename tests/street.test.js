'use strict';
const fs = require('fs');
const path = require('path');
const { run, settle } = require('./dom');
const NEW = path.join(__dirname, '..', 'street-scorer.html');
const KEY = 'street-scorer-v1';
const DK = KEY + '-draft';

let pass = 0, fail = 0;
function chk(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const readState = env => JSON.parse(env.store[KEY] || 'null');
const rowsOf = env => env.ctx.document.querySelectorAll('#entry-rows .erow');
const picksOf = env => env.ctx.document.querySelectorAll('#pick-row button[data-pick]');
const noNet = () => Promise.reject(new Error('offline'));

/* 4人選んで pt を打ち込む。最後の1人は空のまま(自動で帳尻が合う) */
async function typeGame(env) {
  picksOf(env).slice(0, 4).forEach(b => env.el('pick-row').fire('click', { target: b }));
  const rows = rowsOf(env);
  rows[0].querySelector('input').value = '30';
  rows[1].querySelector('input').value = '10';
  rows[2].querySelector('input').value = '10';
  env.el('entry-rows').fire('input', { target: rows[2].querySelector('input') });
  env.el('entry-rows').fire('click', { target: rows[2].querySelector('.sgn') });   // 3人目を −10 に
  env.flush();
  return rows;
}

(async () => {
console.log('\n=== street-scorer.html ===');

console.log('\n[1] 起動');
{
  const e = run(NEW, { storage: {}, fetch: noNet });
  await settle(e);
  chk('例外なく起動', e.log.errors.length === 0, e.log.errors.join('|'));
  chk('復元バナーは出ていない', e.el('draft-bar').hidden === true);
  chk('メンバーが4人いる', picksOf(e).length === 4, picksOf(e).length);
}

console.log('\n[2] 入力ドラフト');
{
  const a = run(NEW, { storage: {}, fetch: noNet });
  await settle(a);
  await typeGame(a);
  const d = JSON.parse(a.store[DK] || 'null');
  chk('打ちかけが自動で残る', !!d && d.vals[0] === '30' && d.vals[1] === '10', JSON.stringify(d && d.vals));
  chk('選んだ人も残る', !!d && d.picked.length === 4, JSON.stringify(d && d.picked));
  chk('マイナス符号も残る', !!d && d.sgns[2] === -1, JSON.stringify(d && d.sgns));
  chk('本体にはまだ1戦も入らない', (readState(a) === null) || readState(a).days[readState(a).cur].games.length === 0);

  // 落ちた後に開き直す
  const b = run(NEW, { storage: { [KEY]: a.store[KEY], [DK]: a.store[DK] }, fetch: noNet });
  await settle(b);
  chk('復元バナーが出る', b.el('draft-bar').hidden === false);
  chk('何人分かを言う', /入力が途中で残っています\(4人/.test(b.el('draft-msg').textContent), b.el('draft-msg').textContent);
  chk('勝手には戻さない', rowsOf(b).length === 0, 'erows=' + rowsOf(b).length);

  b.el('draft-restore').fire('click');
  const back = rowsOf(b).map(r => r.querySelector('input').value);
  chk('「入力を戻す」で人と値が戻る', back.length === 4 && back[0] === '30' && back[1] === '10', JSON.stringify(back));
  chk('符号も戻る', rowsOf(b)[2].querySelector('.sgn').dataset.sgn === '-1', rowsOf(b)[2].querySelector('.sgn').dataset.sgn);
  chk('戻したらバナーは消える', b.el('draft-bar').hidden === true);
  chk('戻しただけでは金庫へ出さない', b.log.puts === undefined || b.log.puts.length === 0);

  // 破棄
  const c = run(NEW, { storage: { [KEY]: a.store[KEY], [DK]: a.store[DK] }, fetch: noNet });
  await settle(c);
  c.el('draft-drop').fire('click');
  chk('「破棄」で下書きが消える', !(DK in c.store) && c.el('draft-bar').hidden === true);
}

console.log('\n[3] 保存したら下書きは残らない');
{
  const e = run(NEW, { storage: {}, fetch: noNet });
  await settle(e);
  await typeGame(e);
  chk('保存前は下書きがある', DK in e.store);
  chk('保存ボタンが有効', e.el('btn-save').disabled === false, 'disabled=' + e.el('btn-save').disabled);
  e.el('btn-save').fire('click');
  const st = readState(e);
  chk('1戦が本体に入る', st.days[st.cur].games.length === 1, JSON.stringify(st.days[st.cur].games));
  chk('合計0ptで記録される', Math.round(st.days[st.cur].games[0].pts.reduce((a, b) => a + b, 0) * 10) / 10 === 0,
    JSON.stringify(st.days[st.cur].games[0].pts));
  chk('下書きは消える', !(DK in e.store), JSON.stringify(Object.keys(e.store)));
}

console.log('\n[4] 出してはいけない下書きは出さない');
{
  const base = run(NEW, { storage: {}, fetch: noNet });
  await settle(base);
  await typeGame(base);
  const good = JSON.parse(base.store[DK]);

  const otherDay = run(NEW, { storage: { [KEY]: base.store[KEY], [DK]: JSON.stringify(Object.assign({}, good, { day: 99 })) }, fetch: noNet });
  await settle(otherDay);
  chk('別の日の打ちかけは出さない', otherDay.el('draft-bar').hidden === true);

  const gone = run(NEW, { storage: { [KEY]: base.store[KEY], [DK]: JSON.stringify(Object.assign({}, good, { picked: [9991, 9992] })) }, fetch: noNet });
  await settle(gone);
  chk('居ないメンバー宛の打ちかけは出さない', gone.el('draft-bar').hidden === true);

  const empty = run(NEW, { storage: { [KEY]: base.store[KEY], [DK]: JSON.stringify(Object.assign({}, good, { vals: ['', '', '', ''] })) }, fetch: noNet });
  await settle(empty);
  chk('空の下書きは出さない', empty.el('draft-bar').hidden === true);

  const JUNK = ['null', '{}', '[]', 'not json', JSON.stringify({ day: 0, vals: 'x' }),
    JSON.stringify({ day: 0, vals: new Array(99).fill('1'), picked: new Array(99).fill(1) }),
    JSON.stringify({ day: 0, vals: ['a'.repeat(9999)], picked: [1], sgns: 'x', editing: 1e9 })];
  let ok = true, err = '';
  for (const j of JUNK) {
    const z = run(NEW, { storage: { [KEY]: base.store[KEY], [DK]: j }, fetch: noNet });
    await settle(z);
    if (z.log.errors.length) { ok = false; err = j.slice(0, 30) + ': ' + z.log.errors.join('|'); }
  }
  chk('壊れた下書きで落ちない(' + JUNK.length + '種)', ok, err);
}

console.log('\n[4b] 描き直しても打ちかけを落とさない');
{
  const e = run(NEW, { storage: {}, fetch: noNet });
  await settle(e);
  // 3人選んで打ち込み → あとから4人目を足す
  picksOf(e).slice(0, 3).forEach(b => e.el('pick-row').fire('click', { target: b }));
  let r = rowsOf(e);
  r[0].querySelector('input').value = '30';
  r[1].querySelector('input').value = '10';
  e.el('entry-rows').fire('input', { target: r[1].querySelector('input') });
  e.el('entry-rows').fire('click', { target: r[1].querySelector('.sgn') });   // 2人目を −10 に
  e.flush();
  e.el('pick-row').fire('click', { target: picksOf(e)[3] });                  // 4人目を追加
  r = rowsOf(e);
  chk('人を足しても入れた数字が残る', r.length === 4 && r[0].querySelector('input').value === '30' && r[1].querySelector('input').value === '10',
    JSON.stringify(r.map(x => x.querySelector('input').value)));
  chk('符号も残る', r[1].querySelector('.sgn').dataset.sgn === '-1', r[1].querySelector('.sgn').dataset.sgn);

  // 保存後は値だけ消えて、人の選択は残る
  r[2].querySelector('input').value = '10';
  e.el('entry-rows').fire('input', { target: r[2].querySelector('input') });
  e.flush();
  e.el('btn-save').fire('click');
  const after = rowsOf(e);
  chk('保存後は値が空になる', after.every(x => x.querySelector('input').value === ''),
    JSON.stringify(after.map(x => x.querySelector('input').value)));
  chk('保存後も打った人は残る(連戦しやすさ)', after.length === 4, 'rows=' + after.length);
  chk('保存後に符号も戻る', after.every(x => x.querySelector('.sgn').dataset.sgn === '1'),
    JSON.stringify(after.map(x => x.querySelector('.sgn').dataset.sgn)));
  chk('保存後はバナーが出ない', e.el('draft-bar').hidden === true);
}

console.log('\n[5] データ保護が効いていること(回帰の網)');
{
  const POISON = { players: [{ id: 'x' }, null], days: 'nope', rules: 5, cur: 99, nextId: 'x' };
  const p = run(NEW, { storage: { [KEY]: JSON.stringify(POISON) }, fetch: noNet });
  await settle(p);
  chk('汚染されたlocalStorageで落ちない', p.log.errors.length === 0, p.log.errors.join('|'));

  const full = run(NEW, { storage: {}, storageFull: true, fetch: noNet });
  await settle(full);
  await typeGame(full);
  full.el('btn-save').fire('click');
  const w = full.storeWarn();
  chk('保存できない時は赤バナーが出る', w && w.hidden === false && /保存できていません/.test(w.text), JSON.stringify(w));
  chk('トーストが成功を騙らない', /保存できていません/.test(full.toastText()), full.toastText());
}

console.log('\nstreet: ' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
})();
