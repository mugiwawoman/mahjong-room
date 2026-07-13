# 麻雀部屋 🀄

麻雀の記録ツール置き場。リーグとストリート(セット)は完全に独立したアプリです。

| アプリ | ファイル | 用途 |
|---|---|---|
| 社内Sリーグ | `mleague-tracker.html` | Mリーグルール準拠・5人固定・週2半荘のリーグ戦 |
| セット麻雀スコアラー | `street-scorer.html` | 3麻・4麻対応のポイント制セット記録(チップpt換算あり) |

- [リーグのレギュレーション](regulations.md)/[対局スケジュール](schedule.md)/[成績表テンプレート](results.md)
- どちらのアプリもHTML1枚で完結。ブラウザで開くだけで動きます
- `index.html` は両アプリへの入口ページ

## データが絶対に消えない運用

アプリのデータは「ブラウザ保存+URL埋め込み(#d=…)」に加えて、**このリポジトリを保存版(バックアップの親玉)にできます**:

1. アプリで「ファイルに書き出し」を押してJSONを保存
2. そのファイルを **`league-data.json`**(リーグ)または **`street-data.json`**(ストリート)という名前でこのリポジトリにアップロード(上書きコミット)
3. 以後、ブラウザの記録が空の状態でアプリを開くと(=データが消えたとき・新しい端末のとき)、**保存版が自動で復元されます**

※自動復元が効くのは、アプリをこのリポジトリ経由(GitHub Pagesなど)で配信した場合です。

## GitHub Pagesで公開する(ログイン不要URLにする)

リポジトリをPublicにして Settings → Pages → Branch: `main` / root を選ぶと、

- 入口: `https://<ユーザー名>.github.io/mahjong-room/`
- リーグ: `https://<ユーザー名>.github.io/mahjong-room/mleague-tracker.html`
- ストリート: `https://<ユーザー名>.github.io/mahjong-room/street-scorer.html`

が誰でもログインなしで開けるURLになります。
