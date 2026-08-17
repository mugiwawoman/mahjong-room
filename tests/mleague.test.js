'use strict';
const fs = require('fs');
const path = require('path');
const { run, settle } = require('./dom');
const NEW = path.join(__dirname, '..', 'mleague-tracker.html');
const OLD = path.join(__dirname, 'old', 'mleague-tracker.html');
/* tests/old/ は「修正前」のコピー。無ければ再現テストは飛ばす。
   作り直す時: git show <修正前のrev>:mleague-tracker.html > tests/old/mleague-tracker.html */
const HAS_OLD = fs.existsSync(OLD);
let skipped = 0;
const KEY = 'shanai-mleague-v1';
const GHK = 'mahjong-room-ghtoken';
const GH = 'https://api.github.com/repos/mugiwawoman/mahjong-room/contents/league-data.json';

let pass = 0, fail = 0;
function chk(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const b64u = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64 = o => Buffer.from(JSON.stringify(o, null, 2), 'utf8').toString('base64');

const PRIZES = ['10万円相当', '3万円相当', 'なし', '5,000円貯金', '1万円貯金', '各1万円相当'];
const mk = (results, extra) => Object.assign({
  players: ['あ', 'い', 'う', 'え', 'お'], results, map: {}, pen: [], yaku: [],
  prizes: PRIZES.slice(), season: 65, t: 1000
}, extra || {});
const GOOD = mk({ 1: [35000, 30000, 25000, 10000], 2: [40000, 28000, 22000, 10000] });

const vaultBody = o => JSON.stringify({ p: o.players, r: o.results, m: o.map || {}, e: o.pen || [], y: o.yaku || [], z: o.prizes, q: o.season });
const hashOf = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('0000000' + h.toString(16)).slice(-8) + ':' + s.length; };

function mkFetch(cfg) {
  cfg = cfg || {};
  return (url, init) => {
    const R = (ok, status, body) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
    if (url.indexOf('api.github.com') >= 0) {
      if (init.method === 'PUT') {
        const st = cfg.putStatus || 200;
        return R(st < 300, st, { content: { sha: 'sha-new' } });
      }
      if (!cfg.gh) return R(false, 404, null);
      return R(true, 200, { sha: cfg.ghSha || 'sha-remote', content: b64(cfg.gh) });
    }
    if (!cfg.vault) return R(false, 404, null);
    return R(true, 200, cfg.vault);
  };
}
const readState = env => JSON.parse(env.store[KEY] || 'null');

(async () => {
console.log('\n=== mleague-tracker.html ===');

console.log('\n[1] 共有ハッシュの無言適用(未来tで無確認置換)');
{
  const ATTACK = mk({}, { t: 9999999999999 });
  const hash = '#d=' + b64u({ p: ATTACK.players, r: ATTACK.results, m: {}, e: [], y: [], z: PRIZES.slice(), q: 65, t: 9999999999999 });

  if (HAS_OLD) {
    const o = run(OLD, { storage: { [KEY]: JSON.stringify(GOOD) }, hash, confirm: false, fetch: mkFetch({}) });
    await settle(o);
    chk('OLD: 閲覧者は無確認で全記録を消される(再現)',
      o.log.confirms.length === 0 && Object.keys(readState(o).results).length === 0,
      'confirms=' + o.log.confirms.length);
  } else skipped++;

  const n = run(NEW, { storage: { [KEY]: JSON.stringify(GOOD) }, hash, confirm: false, fetch: mkFetch({}) });
  await settle(n);
  chk('NEW: 閲覧者にも確認が出る', n.log.confirms.length === 1, JSON.stringify(n.log.confirms));
  chk('NEW: 断れば2半荘そのまま', Object.keys(readState(n).results).length === 2);

  const y = run(NEW, { storage: { [KEY]: JSON.stringify(GOOD) }, hash, confirm: true, fetch: mkFetch({}) });
  await settle(y);
  chk('NEW: 承諾すれば置き換わる', Object.keys(readState(y).results).length === 0);
  chk('NEW: 取り込みで金庫へ即pushしない', y.log.puts.length === 0, JSON.stringify(y.log.puts.length));
}

console.log('\n[2] 自分のURLでは訊かない(往復)');
{
  const first = run(NEW, { storage: { [KEY]: JSON.stringify(GOOD) }, hash: '', fetch: mkFetch({}) });
  await settle(first);
  first.el('season-len').value = '35';
  first.el('season-len').fire('change');
  const own = first.ctx.location.hash;
  chk('persist() が #d= を書いている', /^#d=/.test(own), own.slice(0, 12));
  const again = run(NEW, { storage: { [KEY]: first.store[KEY] }, hash: own, fetch: mkFetch({}) });
  await settle(again);
  chk('同じ中身のリンクでは確認が出ない', again.log.confirms.length === 0, JSON.stringify(again.log.confirms));
}

console.log('\n[3] sanitize');
{
  const POISON = {
    players: [{ evil: 1 }, 'い', 'う', 'え', 'お'.repeat(500)],
    results: { 1: [35000, 30000, 25000, 10000], 2: ['x', 1, 2, 3], 'abc': [1, 2, 3, 4], 3: [1, 2, 3], 0: [1, 2, 3, 4], 99999: [1, 2, 3, 4] },
    map: { 1: 'zzz', 2: 3 },
    pen: [{ p: 99, pt: 5 }, { p: 1, pt: 'x' }, { p: 2, pt: -10, note: 'n'.repeat(300) }],
    yaku: [{ p: -1, n: 1, name: 'x' }, { p: 3, n: 1, name: 'y'.repeat(300) }],
    prizes: [1, 2, 3, 4, 5, 6], season: 1e9, t: 1000,
    log: [{ t: 1, m: 'ok' }, { t: 2, m: '' }, 'junk']
  };
  if (HAS_OLD) {
    const o = run(OLD, { storage: { [KEY]: JSON.stringify(POISON) }, fetch: mkFetch({}) });
    await settle(o);
    o.el('season-len').value = '35'; o.el('season-len').fire('change');
    chk('OLD: 1フィールド壊れているだけで全記録が初期化される(再現)',
      Object.keys(readState(o).results).length === 0 && readState(o).players.join() === 'A,B,C,D,E',
      JSON.stringify({ r: Object.keys(readState(o).results), p: readState(o).players }));
  } else skipped++;

  const n = run(NEW, { storage: { [KEY]: JSON.stringify(POISON) }, fetch: mkFetch({}) });
  await settle(n);
  chk('NEW: 例外なく起動', n.log.errors.length === 0, n.log.errors.join('|'));
  n.el('season-len').value = '35';
  n.el('season-len').fire('change');
  const s = readState(n);
  chk('playersが5つの文字列に矯正される', s.players.length === 5 && s.players.every(p => typeof p === 'string'), JSON.stringify(s.players).slice(0, 60));
  chk('名前が24字に丸められる', s.players[4].length === 24, s.players[4].length);
  /* 残るのは 1 だけ: 2=非数値, abc=非数値キー, 3=要素3つ, 0=範囲外, 99999=上限超え */
  chk('壊れたresultsが落ちて正しい1件だけ残る', Object.keys(s.results).join() === '1', Object.keys(s.results).join());
  chk('NEW: 汚染されても正しい成績は失わない', JSON.stringify(s.results['1']) === '[35000,30000,25000,10000]', JSON.stringify(s.results['1']));
  chk('mapの非数値が落ちる', JSON.stringify(s.map) === '{"2":3}', JSON.stringify(s.map));
  chk('居ない席宛のpenが落ちる', s.pen.length === 1 && s.pen[0].p === 2, JSON.stringify(s.pen));
  chk('penのnoteが40字に丸められる', s.pen[0].note.length === 40, s.pen[0].note.length);
  chk('居ない席宛のyakuが落ちる', s.yaku.length === 1 && s.yaku[0].p === 3, JSON.stringify(s.yaku).slice(0, 60));
  chk('prizesが文字列化される', s.prizes.every(x => typeof x === 'string'), JSON.stringify(s.prizes));
  chk('seasonが上限内(手動変更後は35)', s.season === 35, s.season);
  chk('logの空要素が落ちる', s.log.filter(e => e && e.m === 'ok').length === 1 && !s.log.some(e => !e || !e.m), JSON.stringify(s.log).slice(0, 80));
}

console.log('\n[4] resultsの件数上限(DoS)');
{
  const many = {}; for (let i = 1; i <= 5000; i++) many[i] = [1, 2, 3, 4];
  const n = run(NEW, { storage: { [KEY]: JSON.stringify(mk(many)) }, fetch: mkFetch({}) });
  await settle(n);
  chk('例外なく起動', n.log.errors.length === 0, n.log.errors.join('|'));
  n.el('season-len').value = '35'; n.el('season-len').fire('change');
  chk('400件で頭打ち', Object.keys(readState(n).results).length === 400, Object.keys(readState(n).results).length);
}

console.log('\n[5] 競合ガード: 金庫が自分の知る版から動いていたら押さない');
{
  const A = mk({ 1: [35000, 30000, 25000, 10000] });         // 自分が最後に見た金庫
  const B = mk({ 1: [35000, 30000, 25000, 10000], 5: [1, 2, 3, 4] }); // 他の端末が保存した版
  const local = mk({ 1: [35000, 30000, 25000, 10000], 2: [40000, 28000, 22000, 10000] },
    { dirty: 0, syncedH: hashOf(vaultBody(A)) });

  const n = run(NEW, {
    storage: { [KEY]: JSON.stringify(local), [GHK]: 'ghp_test' },
    fetch: mkFetch({ gh: B })   // league-data.json は404、GitHub APIだけB
  });
  await settle(n);
  n.el('season-len').value = '35'; n.el('season-len').fire('change');
  await settle(n);
  chk('PUTを出さない', n.log.puts.length === 0, 'puts=' + n.log.puts.length);
  chk('競合を通知する', /他の人が先に保存/.test(n.toastText()), n.toastText());

  const ok = run(NEW, {
    storage: { [KEY]: JSON.stringify(mk({ 1: [35000, 30000, 25000, 10000] }, { dirty: 0, syncedH: hashOf(vaultBody(A)) })), [GHK]: 'ghp_test' },
    fetch: mkFetch({ gh: A })   // 金庫は自分の知る版のまま
  });
  await settle(ok);
  ok.el('season-len').value = '35'; ok.el('season-len').fire('change');
  await settle(ok);
  chk('動いていなければ普通に保存する', ok.log.puts.length === 1, 'puts=' + ok.log.puts.length);
  chk('保存後は同期済みになる', readState(ok).dirty === 0 && !!readState(ok).syncedH, JSON.stringify({ d: readState(ok).dirty, h: readState(ok).syncedH }));
}

console.log('\n[6] 409の盲目リトライ撤去');
{
  const A = mk({ 1: [35000, 30000, 25000, 10000] });
  const st = mk({ 1: [35000, 30000, 25000, 10000] }, { dirty: 0, syncedH: hashOf(vaultBody(A)) });

  if (HAS_OLD) {
    const o = run(OLD, { storage: { [KEY]: JSON.stringify(GOOD), [GHK]: 'ghp_test' }, fetch: mkFetch({ gh: A, putStatus: 409 }) });
    await settle(o);
    o.el('season-len').value = '35'; o.el('season-len').fire('change');
    await settle(o);
    chk('OLD: 409で盲目に再送する(再現)', o.log.puts.length === 2, 'puts=' + o.log.puts.length);
  } else skipped++;

  const n = run(NEW, { storage: { [KEY]: JSON.stringify(st), [GHK]: 'ghp_test' }, fetch: mkFetch({ gh: A, putStatus: 409 }) });
  await settle(n);
  n.el('season-len').value = '35'; n.el('season-len').fire('change');
  await settle(n);
  chk('NEW: 1回で止めて競合として通知', n.log.puts.length === 1 && /他の人が先に保存/.test(n.toastText()), 'puts=' + n.log.puts.length + ' toast=' + n.toastText());
}

console.log('\n[7] 初回push: 金庫に別の中身があれば黙って潰さない');
{
  const other = mk({ 7: [1, 2, 3, 4] });
  const local = mk({ 1: [35000, 30000, 25000, 10000] });   // syncedH なし = このブラウザから初送信
  const n = run(NEW, {
    storage: { [KEY]: JSON.stringify(local), [GHK]: 'ghp_test' },
    fetch: mkFetch({ gh: other }), confirm: false
  });
  await settle(n);
  n.el('season-len').value = '35'; n.el('season-len').fire('change');
  await settle(n);
  chk('確認が出る', n.log.confirms.some(c => /金庫には別の内容/.test(c)), JSON.stringify(n.log.confirms));
  chk('断ればPUTしない', n.log.puts.length === 0, 'puts=' + n.log.puts.length);
}

console.log('\n[8] 金庫の取り込み: 未送信の編集を黙って捨てない');
{
  const vault = mk({ 1: [35000, 30000, 25000, 10000], 9: [1, 2, 3, 4] }, { t: 5000 });

  const clean = run(NEW, { storage: { [KEY]: JSON.stringify(mk({ 1: [35000, 30000, 25000, 10000] })) }, fetch: mkFetch({ vault }) });
  await settle(clean);
  chk('未送信の編集が無ければ黙って合わせる',
    clean.log.confirms.length === 0 && Object.keys(readState(clean).results).length === 2,
    'confirms=' + clean.log.confirms.length + ' n=' + Object.keys(readState(clean).results || {}).length);

  const dirty = run(NEW, {
    storage: { [KEY]: JSON.stringify(mk({ 1: [35000, 30000, 25000, 10000], 3: [9, 8, 7, 6] }, { dirty: 1 })) },
    fetch: mkFetch({ vault }), confirm: false
  });
  await settle(dirty);
  chk('未送信の編集があれば訊く', dirty.log.confirms.some(c => /未送信の編集は失われます/.test(c)), JSON.stringify(dirty.log.confirms));
  chk('断れば手元が残る', JSON.stringify(Object.keys(readState(dirty).results)) === '["1","3"]', JSON.stringify(Object.keys(readState(dirty).results)));
}

console.log('\n[9] 保存できない時に黙らない');
{
  const n = run(NEW, { storage: { [KEY]: JSON.stringify(GOOD) }, storageFull: true, fetch: mkFetch({}) });
  await settle(n);
  n.el('season-len').value = '35'; n.el('season-len').fire('change');
  const w = n.storeWarn();
  chk('赤バナーが出る', w && w.hidden === false && /保存できていません/.test(w.text), JSON.stringify(w));
  chk('トーストが成功を騙らない', /保存できていません/.test(n.toastText()), n.toastText());

  if (HAS_OLD) {
    const o = run(OLD, { storage: { [KEY]: JSON.stringify(GOOD) }, storageFull: true, fetch: mkFetch({}) });
    await settle(o);
    o.el('season-len').value = '35'; o.el('season-len').fire('change');
    chk('OLD: 失敗を握りつぶして成功と出す(再現)', /半荘にしました/.test(o.toastText()), o.toastText());
  } else skipped++;
}

console.log('\n[9b] 金庫と同じ中身なら空コミットを作らない');
{
  const same = mk({ 1: [35000, 30000, 25000, 10000] });
  // dirty=1 だが中身は金庫と一致(前回の送信が通信断で終わった等)
  const n = run(NEW, {
    storage: { [KEY]: JSON.stringify(Object.assign({}, same, { dirty: 1 })), [GHK]: 'ghp_test' },
    fetch: mkFetch({ gh: same })
  });
  await settle(n);
  n.el('season-len').value = '65';        // 同じ値 = 成績の中身は変わらない
  n.el('season-len').fire('change');
  await settle(n);
  chk('PUTしない', n.log.puts.length === 0, 'puts=' + n.log.puts.length);
  chk('それでも同期済みになる', readState(n).dirty === 0 && !!readState(n).syncedH,
    JSON.stringify({ d: readState(n).dirty, h: readState(n).syncedH }));
}

console.log('\n[9c] 入力ドラフト(打ちかけを失わない)');
{
  const DK = KEY + '-draft';
  const rowsOf = env => env.ctx.document.querySelectorAll('#entry-rows .erow');
  const type = (env, vals) => {
    rowsOf(env).forEach((r, i) => { if (vals[i] !== undefined) r.querySelector('input').value = vals[i]; });
    env.el('entry-rows').fire('input');
    env.flush();
  };

  // 打ちかけが自動で残る
  const a = run(NEW, { storage: { [KEY]: JSON.stringify(GOOD) }, fetch: mkFetch({}) });
  await settle(a);
  chk('起動時は復元バナーが出ていない', a.el('draft-bar').hidden === true);
  type(a, ['42300', '30000']);
  const saved = JSON.parse(a.store[DK] || 'null');
  chk('入力すると下書きが保存される', !!saved && saved.vals[0] === '42300' && saved.vals[1] === '30000',
    JSON.stringify(saved && saved.vals));
  chk('本体のstateはまだ変わらない', Object.keys(readState(a).results).length === 2,
    Object.keys(readState(a).results).join());

  // 符号(箱下のマイナス)も残る
  const sgnBtn = rowsOf(a)[2].querySelector('.sgn');
  a.el('entry-rows').fire('click', { target: sgnBtn });
  a.flush();
  chk('マイナス符号も下書きに入る', JSON.parse(a.store[DK]).sgns[2] === -1, JSON.stringify(JSON.parse(a.store[DK]).sgns));

  // 落ちた後に開き直す
  const b = run(NEW, { storage: { [KEY]: a.store[KEY], [DK]: a.store[DK] }, fetch: mkFetch({}) });
  await settle(b);
  chk('復元バナーが出る', b.el('draft-bar').hidden === false);
  chk('どの半荘の途中かを言う', /半荘の入力が途中で残っています/.test(b.el('draft-msg').textContent),
    b.el('draft-msg').textContent);
  chk('勝手には戻さない', rowsOf(b).every(r => r.querySelector('input').value === ''),
    JSON.stringify(rowsOf(b).map(r => r.querySelector('input').value)));

  b.el('draft-restore').fire('click');
  const back = rowsOf(b).map(r => r.querySelector('input').value);
  chk('「入力を戻す」で値が戻る', back[0] === '42300' && back[1] === '30000', JSON.stringify(back));
  chk('符号も戻る', rowsOf(b)[2].querySelector('.sgn').dataset.sgn === '-1',
    rowsOf(b)[2].querySelector('.sgn').dataset.sgn);
  chk('戻したらバナーは消える', b.el('draft-bar').hidden === true);

  // 破棄
  const c = run(NEW, { storage: { [KEY]: a.store[KEY], [DK]: a.store[DK] }, fetch: mkFetch({}) });
  await settle(c);
  c.el('draft-drop').fire('click');
  chk('「破棄」で下書きが消える', !(DK in c.store) && c.el('draft-bar').hidden === true, JSON.stringify(Object.keys(c.store)));

  // 保存したら下書きは残らない
  const d = run(NEW, { storage: { [KEY]: JSON.stringify(GOOD) }, fetch: mkFetch({}) });
  await settle(d);
  type(d, ['42300', '30000', '15000', '12700']);
  chk('4人分そろえば保存ボタンが有効', d.el('btn-save').disabled === false, 'disabled=' + d.el('btn-save').disabled);
  chk('保存前は下書きがある', DK in d.store);
  d.el('btn-save').fire('click');
  chk('保存すると下書きが消える', !(DK in d.store), JSON.stringify(Object.keys(d.store)));
  chk('半荘は本体に入る', Object.keys(readState(d).results).length === 3, Object.keys(readState(d).results).join());

  // 保存済みと同じ内容の下書きは黙って捨てる
  const stale = { n: 1, vals: ['35000', '30000', '25000', '10000'], sgns: [1, 1, 1, 1], t: 1000 };
  const e2 = run(NEW, { storage: { [KEY]: JSON.stringify(GOOD), [DK]: JSON.stringify(stale) }, fetch: mkFetch({}) });
  await settle(e2);
  chk('保存済みと同内容ならバナーを出さない', e2.el('draft-bar').hidden === true);
  chk('その下書きは捨てられる', !(DK in e2.store));

  // 汚染された下書き
  const JUNK = ['null', '{}', '[]', 'not json', JSON.stringify({ n: 'x', vals: 1 }),
    JSON.stringify({ n: 1e9, vals: ['1', '2', '3', '4'] }),
    JSON.stringify({ n: 1, vals: ['a'.repeat(9999), '', '', ''], sgns: 'x' })];
  let junkOk = true, junkErr = '';
  for (const j of JUNK) {
    const z = run(NEW, { storage: { [KEY]: JSON.stringify(GOOD), [DK]: j }, fetch: mkFetch({}) });
    await settle(z);
    if (z.log.errors.length) { junkOk = false; junkErr = j.slice(0, 30) + ': ' + z.log.errors.join('|'); }
  }
  chk('壊れた下書きで落ちない(' + JUNK.length + '種)', junkOk, junkErr);
}

console.log('\n[9d] 途中で画面が描き直されても戻せる');
{
  const DK = KEY + '-draft';
  const rowsOf = env => env.ctx.document.querySelectorAll('#entry-rows .erow');
  const e = run(NEW, { storage: { [KEY]: JSON.stringify(GOOD) }, fetch: mkFetch({}) });
  await settle(e);
  rowsOf(e)[0].querySelector('input').value = '42300';
  e.el('entry-rows').fire('input');
  e.flush();
  // ペナルティ保存など、入力中に renderAll() が走る操作
  e.el('pen-player').value = '0';
  e.el('pen-pt').value = '20';
  e.el('pen-sgn').dataset.sgn = '-1';
  e.el('btn-pen-add').fire('click');
  chk('(前提)ペナルティが記録され画面が描き直された', readState(e).pen.length === 1, JSON.stringify(readState(e).pen));
  chk('描き直しで打ちかけは消える(元々の挙動)', rowsOf(e)[0].querySelector('input').value === '',
    rowsOf(e)[0].querySelector('input').value);
  chk('その場で復元バナーが出る(再読み込み不要)', e.el('draft-bar').hidden === false);
  e.el('draft-restore').fire('click');
  chk('戻せる', rowsOf(e)[0].querySelector('input').value === '42300',
    rowsOf(e)[0].querySelector('input').value);
}

console.log('\n[9e] ポイント推移: 指で狙わずに1半荘ずつ振り返れる');
{
  const many = {};
  for (let i = 1; i <= 8; i++) many[i] = [40000, 30000, 20000, 10000];
  const e = run(NEW, { storage: { [KEY]: JSON.stringify(mk(many)) }, fetch: mkFetch({}) });
  await settle(e);
  const readout = () => String(e.el('chart-readout').innerHTML);

  chk('送り操作が出ている', e.el('chart-scrub').hidden === false);
  chk('スライダーの範囲が半荘数に合う', e.el('chart-range').max === '8', 'max=' + e.el('chart-range').max);
  chk('既定で最新を表示している', /第8半荘.*最新/.test(readout()), readout().slice(0, 60));
  chk('最新では ▶ と「最新」が押せない', e.el('chart-next').disabled === true && e.el('chart-latest').disabled === true);

  e.el('chart-prev').fire('click');
  chk('◀ で1半荘もどる', /第7半荘/.test(readout()), readout().slice(0, 40));
  chk('スライダーも連動する', e.el('chart-range').value === '7', e.el('chart-range').value);
  chk('もどると ▶ が押せるようになる', e.el('chart-next').disabled === false);

  e.el('chart-range').value = '3';
  e.el('chart-range').fire('input');
  chk('スライダーで飛べる', /第3半荘/.test(readout()), readout().slice(0, 40));

  e.el('chart-next').fire('click');
  chk('▶ で1半荘すすむ', /第4半荘/.test(readout()), readout().slice(0, 40));

  e.el('chart-latest').fire('click');
  chk('「最新」で最後まで戻る', /第8半荘.*最新/.test(readout()) && e.el('chart-range').value === '8', e.el('chart-range').value);

  // 端で止まる
  e.el('chart-range').value = '0';
  e.el('chart-range').fire('input');
  chk('先頭は「開始時」', /開始時/.test(readout()), readout().slice(0, 40));
  chk('先頭では ◀ が押せない', e.el('chart-prev').disabled === true);
  e.el('chart-prev').fire('click');
  chk('◀ を押しても先頭を越えない', e.el('chart-range').value === '0', e.el('chart-range').value);

  // 全員分の値が出ている(tooltipを唯一の経路にしない)
  chk('5人ぶんの行が出る', (readout().match(/tt-row/g) || []).length === 5,
    (readout().match(/tt-row/g) || []).length);
  const xh = e.ctx.document.querySelectorAll('#chart #xhair')[0];
  chk('縦線が指を離しても出たまま', !!xh && xh.attrs.visibility === 'visible',
    xh ? 'visibility=' + xh.attrs.visibility : 'xhairが見つからない');
  chk('縦線が選択位置に動く', !!xh && xh.attrs.x1 === xh.attrs.x2 && Number(xh.attrs.x1) > 0,
    xh ? 'x1=' + xh.attrs.x1 : '-');

  // 半荘が無ければ操作ごと隠す
  const zero = run(NEW, { storage: { [KEY]: JSON.stringify(mk({})) }, fetch: mkFetch({}) });
  await settle(zero);
  chk('0半荘なら送り操作は出ない', zero.el('chart-scrub').hidden === true);
  chk('0半荘なら読み取り欄も空', String(zero.el('chart-readout').innerHTML) === '');
}

console.log('\n[10] 普段使いが重くなっていないこと');
{
  // 新しい端末で開く: 金庫を黙って表示、確認ゼロ
  const vault = mk({ 1: [35000, 30000, 25000, 10000] }, { t: 5000 });
  const fresh = run(NEW, { storage: {}, fetch: mkFetch({ vault, gh: vault }) });
  await settle(fresh);
  chk('新規端末: 確認ゼロで金庫を表示', fresh.log.confirms.length === 0 && Object.keys(readState(fresh).results).length === 1,
    'confirms=' + fresh.log.confirms.length);

  // 金庫を取り込んだ記録係が編集 → 確認なしで1回だけpush
  const rec = run(NEW, { storage: { [GHK]: 'ghp_test' }, fetch: mkFetch({ vault, gh: vault }) });
  await settle(rec);
  rec.el('season-len').value = '35'; rec.el('season-len').fire('change');
  await settle(rec);
  chk('記録係: 取り込み直後の編集は確認なしでpush', rec.log.confirms.length === 0 && rec.log.puts.length === 1,
    'confirms=' + JSON.stringify(rec.log.confirms) + ' puts=' + rec.log.puts.length);
  chk('push後は同期済み', readState(rec).dirty === 0, JSON.stringify({ d: readState(rec).dirty }));

  // 再読み込みしても訊かれない(金庫の中身と一致しているため)
  const back = run(NEW, {
    storage: { [KEY]: rec.store[KEY], [GHK]: 'ghp_test' },
    hash: rec.ctx.location.hash,
    fetch: mkFetch({ vault: JSON.parse(Buffer.from(JSON.parse(rec.log.puts[0].body).content, 'base64').toString('utf8')), gh: vault })
  });
  await settle(back);
  chk('再読み込みで確認が出ない', back.log.confirms.length === 0, JSON.stringify(back.log.confirms));

  // 半荘の保存が普通に通る
  const play = run(NEW, { storage: { [KEY]: JSON.stringify(GOOD), [GHK]: 'ghp_test' }, fetch: mkFetch({ gh: GOOD }) });
  await settle(play);
  const before = Object.keys(readState(play).results).length;
  play.el('game-select').value = '3';
  const rows = [];
  play.ctx.document.querySelectorAll = () => rows;
  chk('起動時に例外なし(通常データ)', play.log.errors.length === 0, play.log.errors.join('|'));
  chk('保存済み2半荘が読めている', before === 2, before);
}

console.log('\nmleague: ' + pass + ' passed, ' + fail + ' failed' + (skipped ? ', ' + skipped + ' 再現テストはtests/old/が無いので省略' : ''));
process.exitCode = fail ? 1 : 0;
})();
