<p align="center">
  <a href="https://snow-flow.dev">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Snow-Flow logo">
    </picture>
  </a>
</p>
<p align="center">The autonomous ServiceNow development agent.</p>
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

### Installation

```bash
# YOLO
curl -fsSL https://snow-flow.dev/install | bash

# Package managers
npm i -g snow-code-ai@latest        # or bun/pnpm/yarn
scoop install snow-code             # Windows
choco install snow-code             # Windows
brew install groeimetai/tap/snow-code # macOS and Linux (recommended, always up to date)
paru -S snow-code-bin               # Arch Linux
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

Snow-Flow is also available as a desktop application. Download directly from the [releases page](https://github.com/groeimetai/snow-flow/releases) or [snow-flow.dev/download](https://snow-flow.dev/download).

| Platform              | Download                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `snow-code-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `snow-code-desktop-darwin-x64.dmg`     |
| Windows               | `snow-code-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, or AppImage           |

```bash
# macOS (Homebrew)
brew install --cask snow-code-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/snow-code-desktop
```

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$SNOW_CODE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if exists or can be created)
4. `$HOME/.snow-code/bin` - Default fallback

```bash
# Examples
SNOW_CODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://snow-flow.dev/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://snow-flow.dev/install | bash
```

### Agents

Snow-Flow includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also, included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://snow-flow.dev/docs/agents).

### Documentation

For more info on how to configure Snow-Flow [**head over to our docs**](https://snow-flow.dev/docs).

### Contributing

If you're interested in contributing to Snow-Flow, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on Snow-Flow

If you are working on a project that's related to Snow-Flow and is using "snow-flow" or "snow-code" as a part of its name; for example, "snow-flow-dashboard" or "snow-code-mobile", please add a note to your README to clarify that it is not built by the Snow-Flow team and is not affiliated with us in any way.

### FAQ

#### What is Snow-Flow?

Snow-Flow is an autonomous ServiceNow development agent powered by AI. It helps you:

- Develop ServiceNow widgets, scripts, and business rules
- Query and manage ServiceNow tables and records
- Deploy and validate ServiceNow artifacts
- Automate repetitive ServiceNow tasks

#### How is this different from other coding agents?

Snow-Flow is specifically designed for ServiceNow development:

- 100% open source
- ServiceNow-specific MCP tools and integrations
- Not coupled to any AI provider - works with Claude, OpenAI, Google or local models
- Out of the box LSP support
- A focus on TUI built by terminal enthusiasts
- A client/server architecture that allows remote control

---

**Join our community** [Discord](https://discord.gg/snow-flow) | [X.com](https://x.com/snow-flow)
