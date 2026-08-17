# tests

依存なし。node だけで動く。

```
node tests/mleague.test.js
node tests/street.test.js
```

アーカイブしたものも走る:

```
node archive/golf.test.js
```

## 横スクロールの実測 (tests/overflow.test.js)

本物の Chromium で 320 / 360 / 390px を開き、横に振れる箱が1つも無いことを確かめる。
CSSは頭で考えても当たらないので測る。サーバを立ててから:

```
npx http-server -p 8123 -s .   # 別ターミナル
node tests/overflow.test.js
```

空の表は必ず収まる = 測っても意味が無いので、street には混みあった状態を流し込み、
「表に中身がある」ことも同時に確かめている。900px では表が表のままかも見る。

`dom.js` は最小のDOM/localStorage/fetchのスタブ。各HTMLの `<script>` を抜き出して
`vm` で走らせ、**外から触れる入口だけ**を叩く:

- `localStorage` に汚染データを入れて起動する
- `location.hash` に共有リンクを入れて起動する
- `fetch` を差し替えて金庫(league-data.json / GitHub API)の応答を作る
- `confirm` の答え、`localStorage.setItem` の失敗を切り替える

内部関数は呼ばない。攻撃者が実際に触れる面と同じ所からしか入らないので、
テストが通る = その入口からは壊せない、と読める。

`dom.js` は innerHTML に流し込まれたタグ列を簡易に木へ起こすので、
`querySelector` / `closest` / `.dataset` が効く。入力欄を打って保存ボタンを押す、
という操作そのものをテストから再現できる。

## tests/old/(任意)

「修正前はこう壊れた」を並べて確認したい時だけ置く。無ければその項目は自動で省略。

```
git show 9674188:mleague-tracker.html > tests/old/mleague-tracker.html
git show 9674188:golf-tour.html       > tests/old/golf-tour.html   # archive/golf.test.js 用
```

(9674188 = データ保護を入れる前のコミット)
