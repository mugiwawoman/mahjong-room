# archive

使うのをやめたものを置く場所。**消していない** ので、いつでも戻せる。

| ファイル | 何 | 止めた日 | 状態 |
|---|---|---|---|
| `golf-tour.html` | 社内ゴルフツアー(コンペの年間シーズン管理) | 2026-08-17 | 動く。データ保護・入力ドラフトまで入った状態で凍結 |
| `golf.test.js` | 上のテスト(42件) | 同上 | `node archive/golf.test.js` で今も走る |

止めたのは「今は使わない」というだけで、壊れているからではない。
`index.html` と `README.md` からリンクを外しただけなので、
`archive/golf-tour.html` を直接開けば今までどおり動く。
記録は各自のブラウザ(localStorage `golf-tour-v1`)に残っているので、
戻せば見えるし、消してもいない。

## 戻すとき

```
git mv archive/golf-tour.html golf-tour.html
git mv archive/golf.test.js  tests/golf.test.js
```

そのうえで
- `tests/golf.test.js` の `NEW` / `OLD` / `require` のパスを元に戻す
- `index.html` に部屋カード(`.room.golf`)と `.golf` のCSSを戻す
- `README.md` の一覧と公開URLに1行ずつ戻す
