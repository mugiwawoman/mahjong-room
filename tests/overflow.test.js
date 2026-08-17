'use strict';
/* 横スクロールが起きていないかを、実際のブラウザで測る。
   代表方針: 横に振らせる設計にしない。 */
const path = require('path');
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const PAGES = ['index.html', 'mleague-tracker.html', 'street-scorer.html', 'scoring.html', 'biz-lp.html'];
const WIDTHS = [320, 360, 390];

/* 空の表は必ず収まる = 測っても意味が無い。
   street は金庫が小さいので、混みあった状態を作ってから測る。 */
const STREET_SEED = {
  players: [
    { id: 1, name: '大迫', c: 1 }, { id: 2, name: 'MUGI', c: 2 }, { id: 3, name: '鼓太王', c: 3 },
    { id: 4, name: 'サイトウ', c: 4 }, { id: 5, name: 'かずお。', c: 5 }, { id: 6, name: 'たなか', c: 6 }
  ],
  nextId: 7,
  rules: {
    r4: { start: 25000, target: 30000, uma: [20, 10, -10, -20] },
    r3: { start: 35000, target: 40000, uma: [15, 0, -15] },
    chipBase: 20, chipPt: 1, ex: [{ n: '飛ばし', pt: 10 }]
  },
  days: [{
    date: '2026-08-10',
    games: [
      { k: 'pt', pids: [1, 2, 3, 4], pts: [30.5, 10.2, -10.1, -30.6] },
      { k: 'pt', pids: [1, 2, 5, 6], pts: [45.0, -5.0, -15.0, -25.0] },
      { k: 'pt', pids: [3, 4, 5, 6], pts: [20.0, 10.0, -10.0, -20.0] },
      { k: 'pt', pids: [1, 3, 5, 6], pts: [-12.3, 40.1, 2.2, -30.0] }
    ],
    chips: { 1: 5, 2: -3, 3: 2, 4: -4, 5: 1, 6: -1 },
    ex: [{ f: 2, t: 1, pt: 10, n: '飛ばし' }]
  }],
  cur: 0, im: 'pt', rota: { ids: [1, 2, 3, 4, 5, 6], mode: 4 }, t: 1000
};
const SEEDS = { 'street-scorer.html': { 'street-scorer-v1': JSON.stringify(STREET_SEED) } };

let pass = 0, fail = 0;
function chk(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '\n      ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome' })
    .catch(() => chromium.launch());
  console.log('\n=== 横スクロール実測 (Chromium) ===');

  for (const w of WIDTHS) {
    console.log('\n--- 幅 ' + w + 'px ---');
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    /* 外部フォントは測定に関係なく、取りに行くと詰まるので遮断 */
    await page.route('**://fonts.googleapis.com/**', r => r.abort());
    await page.route('**://fonts.gstatic.com/**', r => r.abort());
    page.setDefaultTimeout(15000);
    for (const p of PAGES) {
      const seed = SEEDS[p];
      if (seed) {
        /* 金庫ファイルを取りに行かせない。シードが上書きされて空の表を測ってしまう */
        await page.route('**/street-data.json*', r => r.abort());
        await page.route('**/streetdata.json*', r => r.abort());
        await page.goto(BASE + '/' + p, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.evaluate(s => { for (const k in s) localStorage.setItem(k, s[k]); }, seed);
      }
      await page.goto(BASE + '/' + p, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(700);   /* 描画とデータ取り込みを待つ */

      /* 空の表を測って通ったことにしない */
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('table')].reduce((a, t) => a + t.querySelectorAll('tbody tr').length, 0));
      if (/mleague|street/.test(p)) chk(`${p} — 表に中身がある(測る意味がある)`, rows >= 8, '合計 ' + rows + ' 行');

      const res = await page.evaluate(() => {
        const out = { docOverflow: 0, elems: [] };
        const de = document.documentElement;
        out.docOverflow = de.scrollWidth - de.clientWidth;
        document.querySelectorAll('*').forEach(el => {
          const over = el.scrollWidth - el.clientWidth;
          if (over <= 1) return;
          const cs = getComputedStyle(el);
          if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') return;  // 実際に横スクロールする箱だけ
          const id = el.id ? '#' + el.id : '';
          const cls = el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/).join('.') : '';
          const inner = el.firstElementChild;
          const innerId = inner && inner.id ? '#' + inner.id : (inner ? inner.tagName.toLowerCase() : '');
          out.elems.push({ sel: (el.tagName.toLowerCase() + id + cls).slice(0, 60), inner: innerId, over });
        });
        return out;
      });

      const detail = res.elems.map(e => `${e.sel} (中身 ${e.inner}) が ${e.over}px はみ出し`).join('\n      ');
      chk(`${p} — ページ全体が横に振れない`, res.docOverflow <= 1, 'scrollWidth - clientWidth = ' + res.docOverflow);
      chk(`${p} — 横スクロールする箱が無い`, res.elems.length === 0, detail);
    }
    await ctx.close();
  }

  /* 広い画面では表が表のままであること(積みっぱなしにしない) */
  {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
    const page = await ctx.newPage();
    await page.route('**://fonts.googleapis.com/**', r => r.abort());
    await page.route('**://fonts.gstatic.com/**', r => r.abort());
    console.log('\n--- 幅 900px (PC) ---');
    for (const p2 of ['mleague-tracker.html', 'street-scorer.html', 'scoring.html']) {
      await page.goto(BASE + '/' + p2, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(500);
      const asTable = await page.evaluate(() =>
        [...document.querySelectorAll('table.stack-sm, table.yaku-table')]
          .every(t => getComputedStyle(t).display === 'table'));
      chk(`${p2} — PCでは表のまま`, asTable);
    }
    await ctx.close();
  }

  await browser.close();
  console.log('\noverflow: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
