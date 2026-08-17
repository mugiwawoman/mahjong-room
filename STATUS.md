# STATUS
- 更新: 2026-08-17
- 今: フォント統一（3トークン化・5ページ一致）と、ポイント推移の振り返り操作を実装
  - グラフは1半荘あたり7pxの的を指で狙わせていた → スライダー+◀▶(44px)+タップ固定。
    浮かぶツールチップは廃止し、直下の固定パネルに一本化
- 稼働は Tリーグ(mleague-tracker) と セット(street-scorer)。データを持つのもこの2つだけ
- 運用: **GitHubのmainが唯一の正**。zip等でのファイル受け渡しはしない
- テスト: `node tests/mleague.test.js`(80) / `node tests/street.test.js`(33)
  アーカイブ分: `node archive/golf.test.js`(42)。依存なし・node のみ
- 次: **横スクロールの撲滅**（順位表が一番の対象。代表方針で横に振らせない）
  → その後 streetの汎用Undoスタック、44px化・iOS自動ズーム
- LOLO待ち: なし
