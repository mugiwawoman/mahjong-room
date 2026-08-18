# STATUS
- 更新: 2026-08-17
- 今: 横スクロールを撲滅し、縦の長さも調整。実測で全5ページ・320/360/390pxで
  横に振れる箱ゼロ(`tests/overflow.test.js` 39件)。900pxでは表は表のまま
  - 積み方は「1セル=1行」でなく「チップ折り返し」(順位表1387→571px、座席2059→1059px)
  - 点数早見表は格子のまま縮小(引く表は積むと探せない)
- 直前: フォント3トークン統一 / ポイント推移をスライダー+◀▶で送れるように
- 稼働は Tリーグ(mleague-tracker) と セット(street-scorer)。データを持つのもこの2つだけ
- 運用: **GitHubのmainが唯一の正**。zip等でのファイル受け渡しはしない
- テスト: `node tests/mleague.test.js`(80) / `node tests/street.test.js`(33)
  / `node tests/overflow.test.js`(39・要 http-server) / `node archive/golf.test.js`(42)
- 文字の方針(2026-08-17確定): 道具ページは sans一本 + ページ名と牌だけ明朝。
  手書き(Klee One)は営業LP専用。ダブルタップズームは全ページで停止(ピンチは効く)
- 次: P1の残り。streetの汎用Undoスタック → 修正/削除ボタンの44px化・分離
  → iOS自動ズーム(入力欄16px下限) → 既定名「プレイヤー1〜4」の廃止
- LOLO待ち: なし
