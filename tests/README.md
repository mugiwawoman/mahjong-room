# tests

依存なし。node だけで動く。

```
node tests/golf.test.js
node tests/mleague.test.js
```

`dom.js` は最小のDOM/localStorage/fetchのスタブ。各HTMLの `<script>` を抜き出して
`vm` で走らせ、**外から触れる入口だけ**を叩く:

- `localStorage` に汚染データを入れて起動する
- `location.hash` に共有リンクを入れて起動する
- `fetch` を差し替えて金庫(league-data.json / GitHub API)の応答を作る
- `confirm` の答え、`localStorage.setItem` の失敗を切り替える

内部関数は呼ばない。攻撃者が実際に触れる面と同じ所からしか入らないので、
テストが通る = その入口からは壊せない、と読める。

## tests/old/(任意)

「修正前はこう壊れた」を並べて確認したい時だけ置く。無ければその項目は自動で省略。

```
git show 9674188:golf-tour.html      > tests/old/golf-tour.html
git show 9674188:mleague-tracker.html > tests/old/mleague-tracker.html
```

(9674188 = データ保護を入れる前のコミット)
