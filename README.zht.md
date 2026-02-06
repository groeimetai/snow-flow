<p align="center">
<pre align="center">
███████╗███╗   ██╗ ██████╗ ██╗    ██╗███████╗██╗      ██████╗ ██╗    ██╗
██╔════╝████╗  ██║██╔═══██╗██║    ██║██╔════╝██║     ██╔═══██╗██║    ██║
███████╗██╔██╗ ██║██║   ██║██║ █╗ ██║█████╗  ██║     ██║   ██║██║ █╗ ██║
╚════██║██║╚██╗██║██║   ██║██║███╗██║██╔══╝  ██║     ██║   ██║██║███╗██║
███████║██║ ╚████║╚██████╔╝╚███╔███╔╝██║     ███████╗╚██████╔╝╚███╔███╔╝
╚══════╝╚═╝  ╚═══╝ ╚═════╝  ╚══╝╚══╝ ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝
</pre>
</p>
<p align="center">開源的 AI Coding Agent。</p>
<p align="center">
  <a href="https://snow-flow.dev/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/snow-code-ai"><img alt="npm" src="https://img.shields.io/npm/v/snow-code-ai?style=flat-square" /></a>
  <a href="https://github.com/groeimetai/snow-flow/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/groeimetai/snow-flow/publish.yml?style=flat-square&branch=dev" /></a>
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

[![Snow-Flow Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://snow-flow.dev)

---

### 安裝

```bash
# 直接安裝 (YOLO)
curl -fsSL https://snow-flow.dev/install | bash

# 套件管理員
npm i -g snow-code-ai@latest        # 也可使用 bun/pnpm/yarn
scoop install snow-code             # Windows
choco install snow-code             # Windows
brew install groeimetai/tap/snow-code # macOS 與 Linux（推薦，始終保持最新）
brew install snow-code              # macOS 與 Linux（官方 brew formula，更新頻率較低）
paru -S snow-code-bin               # Arch Linux
mise use -g snow-code               # 任何作業系統
nix run nixpkgs#snow-code           # 或使用 github:groeimetai/snow-flow 以取得最新開發分支
```

> [!TIP]
> 安裝前請先移除 0.1.x 以前的舊版本。

### 桌面應用程式 (BETA)

Snow-Flow 也提供桌面版應用程式。您可以直接從 [發佈頁面 (releases page)](https://github.com/groeimetai/snow-flow/releases) 或 [snow-flow.dev/download](https://snow-flow.dev/download) 下載。

| 平台                  | 下載連結                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `snow-code-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `snow-code-desktop-darwin-x64.dmg`     |
| Windows               | `snow-code-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, 或 AppImage           |

```bash
# macOS (Homebrew Cask)
brew install --cask snow-code-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/snow-code-desktop
```

#### 安裝目錄

安裝腳本會依據以下優先順序決定安裝路徑：

1. `$SNOW_CODE_INSTALL_DIR` - 自定義安裝目錄
2. `$XDG_BIN_DIR` - 符合 XDG 基礎目錄規範的路徑
3. `$HOME/bin` - 標準使用者執行檔目錄 (若存在或可建立)
4. `$HOME/.snow-code/bin` - 預設備用路徑

```bash
# 範例
SNOW_CODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://snow-flow.dev/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://snow-flow.dev/install | bash
```

### Agents

Snow-Flow 內建了兩種 Agent，您可以使用 `Tab` 鍵快速切換。

- **build** - 預設模式，具備完整權限的 Agent，適用於開發工作。
- **plan** - 唯讀模式，適用於程式碼分析與探索。
  - 預設禁止修改檔案。
  - 執行 bash 指令前會詢問權限。
  - 非常適合用來探索陌生的程式碼庫或規劃變更。

此外，Snow-Flow 還包含一個 **general** 子 Agent，用於處理複雜搜尋與多步驟任務。此 Agent 供系統內部使用，亦可透過在訊息中輸入 `@general` 來呼叫。

了解更多關於 [Agents](https://snow-flow.dev/docs/agents) 的資訊。

### 線上文件

關於如何設定 Snow-Flow 的詳細資訊，請參閱我們的 [**官方文件**](https://snow-flow.dev/docs)。

### 參與貢獻

如果您有興趣參與 Snow-Flow 的開發，請在提交 Pull Request 前先閱讀我們的 [貢獻指南 (Contributing Docs)](./CONTRIBUTING.md)。

### 基於 Snow-Flow 進行開發

如果您正在開發與 Snow-Flow 相關的專案，並在名稱中使用了 "snow-code"（例如 "snow-code-dashboard" 或 "snow-code-mobile"），請在您的 README 中加入聲明，說明該專案並非由 Snow-Flow 團隊開發，且與我們沒有任何隸屬關係。

### 常見問題 (FAQ)

#### 這跟 Claude Code 有什麼不同？

在功能面上與 Claude Code 非常相似。以下是關鍵差異：

- 100% 開源。
- 不綁定特定的服務提供商。雖然我們推薦使用透過 [Snow-Flow Zen](https://snow-flow.dev/zen) 提供的模型，但 Snow-Flow 也可搭配 Claude, OpenAI, Google 甚至本地模型使用。隨著模型不斷演進，彼此間的差距會縮小且價格會下降，因此具備「不限廠商 (provider-agnostic)」的特性至關重要。
- 內建 LSP (語言伺服器協定) 支援。
- 專注於終端機介面 (TUI)。Snow-Flow 由 Neovim 愛好者與 [terminal.shop](https://terminal.shop) 的創作者打造；我們將不斷挑戰終端機介面的極限。
- 客戶端/伺服器架構 (Client/Server Architecture)。這讓 Snow-Flow 能夠在您的電腦上運行的同時，由行動裝置進行遠端操控。這意味著 TUI 前端只是眾多可能的客戶端之一。

---

**加入我們的社群** [Discord](https://discord.gg/snow-flow) | [X.com](https://x.com/snow-flow)
