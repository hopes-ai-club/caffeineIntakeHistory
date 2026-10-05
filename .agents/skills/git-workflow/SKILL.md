---
name: git-workflow
description: Safely manage branches, commits, pushes, and pull requests for this repository when an implementation task involves Git or GitHub delivery.
---

# Git Workflow

開発者に代わって、このリポジトリの Git 操作を安全に進める。操作内容と結果は専門用語だけで済ませず、日本語で短く説明する。

## 適用範囲

実装、修正、文書更新など、最終的にブランチ・コミット・push・Pull Request が必要になる作業で使用する。履歴や差分を見るだけの依頼には、不要なブランチ作成や外部変更を行わない。

この Skill は作業そのものの許可を置き換えない。ユーザーが依頼した範囲だけを扱う。

## 作業開始

変更前に次を確認する。

- `git status --short` と現在のブランチ
- `origin` のURLと追跡関係
- `git config user.name` と `git config user.email`
- push や PR が必要なら `gh auth status`

確認結果に応じて次のように判断する。

- clean な `main` にいる場合は、作業内容を表す新しいブランチを自動作成する。接頭辞は機能追加=`feat/`、不具合修正=`fix/`、文書のみ=`docs/`、保守作業=`chore/` とする。
- 未コミット変更がある場合は、差分を確認して今回の依頼に属するか判断する。別作業の可能性がある変更を、勝手に破棄、退避、stage、commitしない。区別できなければユーザーに確認する。
- 既存の作業ブランチが今回の依頼に合う場合は継続する。別作業のブランチなら、新しいブランチを作る前に状況と安全な選択肢を説明して確認する。
- remote の更新と競合する可能性がある場合は、fetch後に差分を調べる。自動でrebaseや競合解消をしない。
- Gitの氏名・メールが未設定、またはGitHubのログイン利用者と一致する合理的な根拠がない場合は、コミットせず設定方法を案内する。
- GitHub認証が無効な場合は、ローカル作業と検証は継続できるが、push前に再認証が必要だと伝える。

## 実装後の検証

コミット候補を作る前に、変更内容に応じた関連テストを実行する。このリポジトリでアプリコードや設定を変更した場合は、原則として次を候補にする。

- `npm test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`

文書やSkillだけの変更では、無関係なアプリのbuildを機械的に要求しない。対象ファイルの構文検証、リンク確認、専用validatorなど、変更に比例した検証を選ぶ。失敗した検証を成功として扱わず、修正できない場合はコミット前に止めて報告する。

## コミット前の必須確認

ユーザーの明示的な承認を得るまで、`git add` と `git commit` を実行しない。次を日本語で提示して確認を待つ。

- 変更予定ファイルと各変更の短い理由
- `git diff --stat` と重要な差分の要約
- 実行した検証、その結果、未検証事項
- 英語の Conventional Commits 形式による予定コミットメッセージ
- 承認後は対象ファイルだけをcommitし、そのままpushまで進めること

承認後は、今回の対象パスを明示してstageする。`git add .` や `git add -A` によって無関係な変更を混ぜない。`git diff --cached --check` と `git diff --cached` で内容を再確認してからcommitし、現在の作業ブランチを `origin` へpushする。

承認後に差分が実質的に変わった場合は、以前の承認を流用せず、改めてコミット前確認を行う。

## Pull Request前の必須確認

push後、既存PRの有無とbase/headを確認する。PRを新規作成する場合は次を提示し、ユーザーの2回目の明示的な承認を待つ。

- PRタイトル
- 日本語のPR本文（概要、変更内容、検証、未検証事項）
- base=`main` とhead=現在の作業ブランチ

承認後に `gh pr create` でPRを作成する。同じheadのPRがすでにある場合は重複作成せず、そのURLと状態を報告する。AIはPRをマージしない。

## 禁止する操作

次の操作は標準フローでは行わない。必要になった場合は、理由、影響、代替手段を説明し、その操作に対する個別の明示的承認を得る。

- `git reset --hard`
- `git clean`
- force-push
- 公開済み履歴のrebase
- ユーザー未承認のstash
- ブランチ削除
- commit amend
- Pull Requestのmerge

秘密情報や環境ファイルをcommitしない。push失敗、認証失敗、競合、同名ブランチなどが発生した場合は、危険な回避策を自動実行せず、現在の状態を保って原因と次の手順を説明する。

## 完了報告

PR作成後は、初心者にも分かる日本語で次だけを簡潔に報告する。

- PRのURL
- ブランチ名とコミット
- 変更ファイルと短い理由
- 実施した検証
- 未検証事項
- マージは人間のレビュー後に行うこと
