# STATUS
- 更新: 2026-08-17
- 今: 横スクロールを撲滅。本物のChromiumで実測し、320/360/390px の全5ページで
  横に振れる箱ゼロ(`tests/overflow.test.js` 39件)。900pxでは表は表のまま
- 直前: フォント3トークン統一 / ポイント推移をスライダー+◀▶で送れるように
- 稼働は Tリーグ(mleague-tracker) と セット(street-scorer)。データを持つのもこの2つだけ
- 運用: **GitHubのmainが唯一の正**。zip等でのファイル受け渡しはしない
- テスト: `node tests/mleague.test.js`(80) / `node tests/street.test.js`(33)
  / `node tests/overflow.test.js`(39・要 http-server) / `node archive/golf.test.js`(42)
- 次: P1の残り。streetの汎用Undoスタック → 修正/削除ボタンの44px化・分離
  → iOS自動ズーム(入力欄16px下限) → 既定名「プレイヤー1〜4」の廃止
- LOLO待ち: なし
