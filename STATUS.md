# STATUS
- 更新: 2026-08-17
- 今: P1「入力ドラフト自動保存」を3ファイルとも完了。打ちかけはタブが飛んでも残り、
  復元バナーから本人の操作で戻す（勝手には書き戻さない）
- 運用: **GitHubのmainが唯一の正**。zip等でのファイル受け渡しはしない
- テスト: `node tests/mleague.test.js`(62) / `node tests/street.test.js`(33) / `node tests/golf.test.js`(42)
  依存なし・node のみ。`tests/old/` を置くと修正前との比較も走る
- 次: P1の続き。streetの汎用Undoスタック → 修正/削除ボタンの44px化・分離 → iOS自動ズーム(16px下限)
- LOLO待ち: なし
