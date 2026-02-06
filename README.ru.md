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
<p align="center">Открытый AI-агент для программирования.</p>
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

### Установка

```bash
# YOLO
curl -fsSL https://snow-flow.dev/install | bash

# Менеджеры пакетов
npm i -g snow-code-ai@latest        # или bun/pnpm/yarn
scoop install snow-code             # Windows
choco install snow-code             # Windows
brew install groeimetai/tap/snow-code # macOS и Linux (рекомендуем, всегда актуально)
brew install snow-code              # macOS и Linux (официальная формула brew, обновляется реже)
paru -S snow-code-bin               # Arch Linux
mise use -g snow-code               # любая ОС
nix run nixpkgs#snow-code           # или github:groeimetai/snow-flow для самой свежей ветки dev
```

> [!TIP]
> Перед установкой удалите версии старше 0.1.x.

### Десктопное приложение (BETA)

Snow-Flow также доступен как десктопное приложение. Скачайте его со [страницы релизов](https://github.com/groeimetai/snow-flow/releases) или с [snow-flow.dev/download](https://snow-flow.dev/download).

| Платформа             | Загрузка                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `snow-code-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `snow-code-desktop-darwin-x64.dmg`     |
| Windows               | `snow-code-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm` или AppImage           |

```bash
# macOS (Homebrew)
brew install --cask snow-code-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/snow-code-desktop
```

#### Каталог установки

Скрипт установки выбирает путь установки в следующем порядке приоритета:

1. `$SNOW_CODE_INSTALL_DIR` - Пользовательский каталог установки
2. `$XDG_BIN_DIR` - Путь, совместимый со спецификацией XDG Base Directory
3. `$HOME/bin` - Стандартный каталог пользовательских бинарников (если существует или можно создать)
4. `$HOME/.snow-code/bin` - Fallback по умолчанию

```bash
# Примеры
SNOW_CODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://snow-flow.dev/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://snow-flow.dev/install | bash
```

### Agents

В Snow-Flow есть два встроенных агента, между которыми можно переключаться клавишей `Tab`.

- **build** - По умолчанию, агент с полным доступом для разработки
- **plan** - Агент только для чтения для анализа и изучения кода
  - По умолчанию запрещает редактирование файлов
  - Запрашивает разрешение перед выполнением bash-команд
  - Идеален для изучения незнакомых кодовых баз или планирования изменений

Также включен сабагент **general** для сложных поисков и многошаговых задач.
Он используется внутренне и может быть вызван в сообщениях через `@general`.

Подробнее об [agents](https://snow-flow.dev/docs/agents).

### Документация

Больше информации о том, как настроить Snow-Flow: [**наши docs**](https://snow-flow.dev/docs).

### Вклад

Если вы хотите внести вклад в Snow-Flow, прочитайте [contributing docs](./CONTRIBUTING.md) перед тем, как отправлять pull request.

### Разработка на базе Snow-Flow

Если вы делаете проект, связанный с Snow-Flow, и используете "snow-code" как часть имени (например, "snow-code-dashboard" или "snow-code-mobile"), добавьте примечание в README, чтобы уточнить, что проект не создан командой Snow-Flow и не аффилирован с нами.

### FAQ

#### Чем это отличается от Claude Code?

По возможностям это очень похоже на Claude Code. Вот ключевые отличия:

- 100% open source
- Не привязано к одному провайдеру. Мы рекомендуем модели из [Snow-Flow Zen](https://snow-flow.dev/zen); но Snow-Flow можно использовать с Claude, OpenAI, Google или даже локальными моделями. По мере развития моделей разрыв будет сокращаться, а цены падать, поэтому важна независимость от провайдера.
- Поддержка LSP из коробки
- Фокус на TUI. Snow-Flow построен пользователями neovim и создателями [terminal.shop](https://terminal.shop); мы будем раздвигать границы того, что возможно в терминале.
- Архитектура клиент/сервер. Например, это позволяет запускать Snow-Flow на вашем компьютере, а управлять им удаленно из мобильного приложения. Это значит, что TUI-фронтенд - лишь один из возможных клиентов.

---

**Присоединяйтесь к нашему сообществу** [Discord](https://discord.gg/snow-flow) | [X.com](https://x.com/snow-flow)
