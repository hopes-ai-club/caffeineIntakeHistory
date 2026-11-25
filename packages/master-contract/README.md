# packages/master-contract

飲み物マスタサービスの `/v1/` API の契約（OpenAPI）を置くパッケージです。現在はディレクトリのみで、中身は [#48](https://github.com/hopes-ai-club/caffeineIntakeHistory/issues/48) の各Issueで追加します。

## 置くもの
- OpenAPI の仕様書（API契約の正）
  - エンドポイント（例: 飲み物マスタの一覧取得）
  - リクエスト（認証、クエリパラメータ）
  - レスポンスの形（飲み物1件の項目など）
  - エラーレスポンスの形
- 仕様書から生成する TypeScript の型
  - `apps/intake`（呼ぶ側）と `apps/master`（返す側）の両方がこの型を使う
  - ルートの `npm run generate` から、このパッケージの `generate` script で生成する

## 置かないもの
- DB・Supabase への接続処理（`apps/master` に置く）
- 画面部品や共通ユーティリティ

アプリ間で共有するのはAPI契約のみとする（#48）。

## 未決定（#52 で決める）
- コード生成ツール
- 仕様書と実装のずれを検出する方法（CIでのチェック内容）
- 命名・エラー形式・日時形式・キャッシュヘッダーの規約
- 生成物をgitにコミットするか
- APIドキュメントの公開の要否

`package.json` を追加するまでは npm workspaces の対象になりません。
