# 麻雀部屋 🀄

麻雀の記録ツール置き場。各ページはHTML1枚で完結し、GitHub Pagesでそのまま動きます。

| ページ | ファイル | 用途 |
|---|---|---|
| 入口 | `index.html` | 各部屋への入口 |
| Tリーグ | `mleague-tracker.html` | Mリーグルール準拠・5人固定リーグ戦(順位表/座席表/役満バッジ/自動保存) |
| セット麻雀スコアラー | `street-scorer.html` | 3麻・4麻対応のポイント制セット記録(チップpt換算あり) |
| 点数下敷き | `scoring.html` | 点数計算機・符計算チェックリスト・早見表 |

- リーグのルール・個人タイトル・景品・完璧試合数は [regulations.md](regulations.md)
- リーグの成績データは **`league-data.json`**(記録係の端末から自動コミットされる保存版)。手で編集しない

## 公開URL(GitHub Pages)

- 入口: https://mugiwawoman.github.io/mahjong-room/
- Tリーグ: https://mugiwawoman.github.io/mahjong-room/mleague-tracker.html
- セット: https://mugiwawoman.github.io/mahjong-room/street-scorer.html
- 点数下敷き: https://mugiwawoman.github.io/mahjong-room/scoring.html

更新が反映されない端末は、ページを引っ張って再読み込み(Pagesのキャッシュは最大10分)。データだけ古いときはアプリ内「共有・バックアップ → 金庫から最新データを読み込む」。

## アプリ本体の更新のしかた(記録係向け)

**同じファイル名のまま**上書きアップロードするのが鉄則:

1. リポジトリの **Add file → Upload files**
2. `mleague-tracker.html` などをドラッグ。**ファイル名が `mleague-tracker 2.html` 等の連番付きになっていないか必ず確認**(なっていたらアップ前にリネーム)
3. Commit changes

名前が1文字でも違うと新規ファイルとして追加され、本命のURLは古いまま残ります。

## 全自動同期(記録係だけ設定)

記録係のブラウザにGitHubトークンを1回設定すると、**結果を保存するたびに成績が自動でこのリポジトリにコミット**され、メンバー全員のページに自動反映されます。

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token
   - Repository access: **Only select repositories → mahjong-room**
   - Permissions: **Contents → Read and write**(それ以外は不要)
   - 有効期限はお好みで(切れたら再発行して貼り直し)
2. トークンをコピーして、トラッカーの「共有・バックアップ」→ **GitHub自動保存**欄に貼って「設定」
3. 以後は何もしなくてOK。リーグとセットの両アプリで共通のトークンが使われます

トークンは設定したブラウザの中にだけ保存され、共有リンクやこのリポジトリには含まれません。

## データが絶対に消えない運用

アプリのデータは「ブラウザ保存+URL埋め込み(#d=…)+このリポジトリの保存版」の3重構え。ブラウザの記録が空の状態でアプリを開くと(=データが消えたとき・新しい端末のとき)、保存版 `league-data.json` が**自動で復元されます**。手動バックアップにはアプリの「ファイルに書き出し」も使えます。
