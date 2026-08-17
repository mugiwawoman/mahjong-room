# STATUS
- 更新: 2026-08-17
- 今: 稼働は Tリーグ(mleague-tracker) と セット(street-scorer) の2つ。
  どちらもデータ保護(P0)と入力ドラフト(P1)まで入って main に載っている
- データを持つのはこの2つだけ。index / scoring / biz-lp は localStorage を一切使わない（移行対象なし）
- ゴルフ(golf-tour)は 2026-08-17 に archive/ へ。動く状態で凍結、消していない（戻し方は archive/README.md）
- 運用: **GitHubのmainが唯一の正**。zip等でのファイル受け渡しはしない
- テスト: `node tests/mleague.test.js`(62) / `node tests/street.test.js`(33)
  アーカイブ分: `node archive/golf.test.js`(42)。依存なし・node のみ
- 次: P1の続き。streetの汎用Undoスタック → 修正/削除ボタンの44px化・分離 → iOS自動ズーム(16px下限)
- LOLO待ち: なし
