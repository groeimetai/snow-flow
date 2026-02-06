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
<p align="center">El agente de programación con IA de código abierto.</p>
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

### Instalación

```bash
# YOLO
curl -fsSL https://snow-flow.dev/install | bash

# Gestores de paquetes
npm i -g snow-code-ai@latest        # o bun/pnpm/yarn
scoop install snow-code             # Windows
choco install snow-code             # Windows
brew install groeimetai/tap/snow-code # macOS y Linux (recomendado, siempre al día)
brew install snow-code              # macOS y Linux (fórmula oficial de brew, se actualiza menos)
paru -S snow-code-bin               # Arch Linux
mise use -g snow-code               # cualquier sistema
nix run nixpkgs#snow-code           # o github:groeimetai/snow-flow para la rama dev más reciente
```

> [!TIP]
> Elimina versiones anteriores a 0.1.x antes de instalar.

### App de escritorio (BETA)

Snow-Flow también está disponible como aplicación de escritorio. Descárgala directamente desde la [página de releases](https://github.com/groeimetai/snow-flow/releases) o desde [snow-flow.dev/download](https://snow-flow.dev/download).

| Plataforma            | Descarga                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `snow-code-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `snow-code-desktop-darwin-x64.dmg`     |
| Windows               | `snow-code-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, o AppImage            |

```bash
# macOS (Homebrew)
brew install --cask snow-code-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/snow-code-desktop
```

#### Directorio de instalación

El script de instalación respeta el siguiente orden de prioridad para la ruta de instalación:

1. `$SNOW_CODE_INSTALL_DIR` - Directorio de instalación personalizado
2. `$XDG_BIN_DIR` - Ruta compatible con la especificación XDG Base Directory
3. `$HOME/bin` - Directorio binario estándar del usuario (si existe o se puede crear)
4. `$HOME/.snow-code/bin` - Alternativa por defecto

```bash
# Ejemplos
SNOW_CODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://snow-flow.dev/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://snow-flow.dev/install | bash
```

### Agents

Snow-Flow incluye dos agents integrados que puedes alternar con la tecla `Tab`.

- **build** - Por defecto, agent con acceso completo para trabajo de desarrollo
- **plan** - Agent de solo lectura para análisis y exploración de código
  - Niega ediciones de archivos por defecto
  - Pide permiso antes de ejecutar comandos bash
  - Ideal para explorar codebases desconocidas o planificar cambios

Además, incluye un subagent **general** para búsquedas complejas y tareas de varios pasos.
Se usa internamente y se puede invocar con `@general` en los mensajes.

Más información sobre [agents](https://snow-flow.dev/docs/agents).

### Documentación

Para más información sobre cómo configurar Snow-Flow, [**ve a nuestra documentación**](https://snow-flow.dev/docs).

### Contribuir

Si te interesa contribuir a Snow-Flow, lee nuestras [docs de contribución](./CONTRIBUTING.md) antes de enviar un pull request.

### Construyendo sobre Snow-Flow

Si estás trabajando en un proyecto relacionado con Snow-Flow y usas "snow-code" como parte del nombre; por ejemplo, "snow-code-dashboard" u "snow-code-mobile", agrega una nota en tu README para aclarar que no está construido por el equipo de Snow-Flow y que no está afiliado con nosotros de ninguna manera.

### FAQ

#### ¿En qué se diferencia de Claude Code?

Es muy similar a Claude Code en cuanto a capacidades. Estas son las diferencias clave:

- 100% open source
- No está acoplado a ningún proveedor. Aunque recomendamos los modelos que ofrecemos a través de [Snow-Flow Zen](https://snow-flow.dev/zen); Snow-Flow se puede usar con Claude, OpenAI, Google o incluso modelos locales. A medida que evolucionan los modelos, las brechas se cerrarán y los precios bajarán, por lo que ser agnóstico al proveedor es importante.
- Soporte LSP listo para usar
- Un enfoque en la TUI. Snow-Flow está construido por usuarios de neovim y los creadores de [terminal.shop](https://terminal.shop); vamos a empujar los límites de lo que es posible en la terminal.
- Arquitectura cliente/servidor. Esto, por ejemplo, permite ejecutar Snow-Flow en tu computadora mientras lo controlas de forma remota desde una app móvil. Esto significa que el frontend TUI es solo uno de los posibles clientes.

---

**Únete a nuestra comunidad** [Discord](https://discord.gg/snow-flow) | [X.com](https://x.com/snow-flow)
