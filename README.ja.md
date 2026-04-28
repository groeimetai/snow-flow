<p align="center">
<pre align="center">
███████╗███████╗██████╗  █████╗  ██████╗
██╔════╝██╔════╝██╔══██╗██╔══██╗██╔════╝
███████╗█████╗  ██████╔╝███████║██║     
╚════██║██╔══╝  ██╔══██╗██╔══██║██║     
███████║███████╗██║  ██║██║  ██║╚██████╗
╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝
</pre>
</p>
<p align="center">オープンソースのAIコーディングエージェント。</p>
<p align="center">
  <a href="https://www.npmjs.com/package/@serac-labs/serac"><img alt="npm" src="https://img.shields.io/npm/v/@serac-labs/serac?style=flat-square" /></a>
  <a href="https://github.com/serac-labs/serac/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/serac-labs/serac/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a>
</p>

[![Serac Terminal UI](serac-tui.png)](https://serac.build)

---

### インストール

```bash
# YOLO
curl -fsSL https://serac.build/install | bash

# パッケージマネージャー
npm i -g @serac-labs/serac@latest        # bun/pnpm/yarn でもOK
scoop install serac             # Windows
choco install serac             # Windows
brew install serac-labs/tap/serac # macOS と Linux（推奨。常に最新）
brew install serac-labs/tap/serac              # macOS と Linux（公式 brew formula。更新頻度は低め）
paru -S serac-bin               # Arch Linux
mise use -g serac               # どのOSでも
nix run nixpkgs#serac           # または github:serac-labs/serac で最新 dev ブランチ
```

> [!TIP]
> インストール前に 0.1.x より古いバージョンを削除してください。

#### インストールディレクトリ

インストールスクリプトは、インストール先パスを次の優先順位で決定します。

1. `$SERAC_INSTALL_DIR` - カスタムのインストールディレクトリ
2. `$XDG_BIN_DIR` - XDG Base Directory Specification に準拠したパス
3. `$HOME/bin` - 標準のユーザー用バイナリディレクトリ（存在する場合、または作成できる場合）
4. `$HOME/.serac/bin` - デフォルトのフォールバック

```bash
# 例
SERAC_INSTALL_DIR=/usr/local/bin curl -fsSL https://serac.build/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://serac.build/install | bash
```

### Agents

Serac には組み込みの Agent が2つあり、`Tab` キーで切り替えられます。

- **build** - デフォルト。開発向けのフルアクセス Agent
- **plan** - 分析とコード探索向けの読み取り専用 Agent
  - デフォルトでファイル編集を拒否
  - bash コマンド実行前に確認
  - 未知のコードベース探索や変更計画に最適

また、複雑な検索やマルチステップのタスク向けに **general** サブ Agent も含まれています。
内部的に使用されており、メッセージで `@general` と入力して呼び出せます。

[agents](https://serac.build/docs/agents) の詳細はこちら。

### ドキュメント

Serac の設定については [**ドキュメント**](https://serac.build/docs) を参照してください。

### コントリビュート

Serac に貢献したい場合は、Pull Request を送る前に [contributing docs](./CONTRIBUTING.md) を読んでください。

### Serac の上に構築する

Serac に関連するプロジェクトで、名前に "serac"（例: "serac-dashboard" や "serac-mobile"）を含める場合は、そのプロジェクトが Serac チームによって作られたものではなく、いかなる形でも関係がないことを README に明記してください。

### FAQ

#### Claude Code との違いは？

機能面では Claude Code と非常に似ています。主な違いは次のとおりです。

- 100% オープンソース
- 特定のプロバイダーに依存しません。[Serac Zen](https://serac.build/zen) で提供しているモデルを推奨しますが、Serac は Claude、OpenAI、Google、またはローカルモデルでも利用できます。モデルが進化すると差は縮まり価格も下がるため、provider-agnostic であることが重要です。
- そのまま使える LSP サポート
- TUI にフォーカス。Serac は neovim ユーザーと [terminal.shop](https://terminal.shop) の制作者によって作られており、ターミナルで可能なことの限界を押し広げます。
- クライアント/サーバー構成。例えば Serac をあなたのPCで動かし、モバイルアプリからリモート操作できます。TUI フロントエンドは複数あるクライアントの1つにすぎません。

---
