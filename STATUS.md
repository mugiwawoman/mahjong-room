# STATUS
- 更新: 2026-08-17
- 今: データ保護 P0 完了。street / mleague / golf の3つとも、共有リンクの無言適用なし・
  競合判定から時計を排除・保存失敗の可視化・sanitize が入った状態で main に載っている
- 運用: **GitHubのmainが唯一の正**。zip等でのファイル受け渡しはしない（版ズレの事故を断つため）
- テスト: `node tests/mleague.test.js`(40件) / `node tests/golf.test.js`(24件) — 依存なし、node のみ
- 次: P1（実戦UX）。入力途中のドラフト自動保存 → Undoスタック → 44px化・iOS自動ズーム
- LOLO待ち: なし
