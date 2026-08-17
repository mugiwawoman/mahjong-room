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
