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
<p align="center">O agente de programação com IA de código aberto.</p>
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

### Instalação

```bash
# YOLO
curl -fsSL https://serac.build/install | bash

# Gerenciadores de pacotes
npm i -g @serac-labs/serac@latest        # ou bun/pnpm/yarn
scoop install serac             # Windows
choco install serac             # Windows
brew install serac-labs/tap/serac # macOS e Linux (recomendado, sempre atualizado)
brew install serac-labs/tap/serac              # macOS e Linux (fórmula oficial do brew, atualiza menos)
paru -S serac-bin               # Arch Linux
mise use -g serac               # qualquer sistema
nix run nixpkgs#serac           # ou github:serac-labs/serac para a branch dev mais recente
```

> [!TIP]
> Remova versões anteriores a 0.1.x antes de instalar.

#### Diretório de instalação

O script de instalação respeita a seguinte ordem de prioridade para o caminho de instalação:

1. `$SERAC_INSTALL_DIR` - Diretório de instalação personalizado
2. `$XDG_BIN_DIR` - Caminho compatível com a especificação XDG Base Directory
3. `$HOME/bin` - Diretório binário padrão do usuário (se existir ou puder ser criado)
4. `$HOME/.serac/bin` - Fallback padrão

```bash
# Exemplos
SERAC_INSTALL_DIR=/usr/local/bin curl -fsSL https://serac.build/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://serac.build/install | bash
```

### Agents

O Serac inclui dois agents integrados, que você pode alternar com a tecla `Tab`.

- **build** - Padrão, agent com acesso total para trabalho de desenvolvimento
- **plan** - Agent somente leitura para análise e exploração de código
  - Nega edições de arquivos por padrão
  - Pede permissão antes de executar comandos bash
  - Ideal para explorar codebases desconhecidas ou planejar mudanças

Também há um subagent **general** para buscas complexas e tarefas em várias etapas.
Ele é usado internamente e pode ser invocado com `@general` nas mensagens.

Saiba mais sobre [agents](https://serac.build/docs/agents).

### Documentação

Para mais informações sobre como configurar o Serac, [**veja nossa documentação**](https://serac.build/docs).

### Contribuir

Se você tem interesse em contribuir com o Serac, leia os [contributing docs](./CONTRIBUTING.md) antes de enviar um pull request.

### Construindo com Serac

Se você estiver trabalhando em um projeto relacionado ao Serac e estiver usando "serac" como parte do nome (por exemplo, "serac-dashboard" ou "serac-mobile"), adicione uma nota no README para deixar claro que não foi construído pela equipe do Serac e não é afiliado a nós de nenhuma forma.

### FAQ

#### Como isso é diferente do Claude Code?

É muito parecido com o Claude Code em termos de capacidade. Aqui estão as principais diferenças:

- 100% open source
- Não está acoplado a nenhum provedor. Embora recomendemos os modelos que oferecemos pelo [Serac Zen](https://serac.build/zen); o Serac pode ser usado com Claude, OpenAI, Google ou até modelos locais. À medida que os modelos evoluem, as diferenças diminuem e os preços caem, então ser provider-agnostic é importante.
- Suporte a LSP pronto para uso
- Foco em TUI. O Serac é construído por usuários de neovim e pelos criadores do [terminal.shop](https://terminal.shop); vamos levar ao limite o que é possível no terminal.
- Arquitetura cliente/servidor. Isso, por exemplo, permite executar o Serac no seu computador enquanto você o controla remotamente por um aplicativo mobile. Isso significa que o frontend TUI é apenas um dos possíveis clientes.

---
