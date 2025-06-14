[![OpenCode Terminal UI](screenshot.png)](https://github.com/sst/opencode)

AI coding agent, built for the terminal.

⚠️ **Note:** version 0.1.x is a full rewrite and we do not have proper documentation for it yet. Should have this out week of June 17th 2025 📚

### Installation

```bash
# YOLO
curl -fsSL https://opencode.ai/install | bash

# Package managers
npm i -g opencode-ai@latest        # or bun/pnpm/yarn
brew install sst/tap/opencode      # macOS
paru -S opencode-bin               # Arch Linux
```

> **Note:** Remove previous versions < 0.1.x first if installed

### Providers

The recommended approach is to sign up for claude pro or max and do `opencode auth login` and select Anthropic. It is the most cost effective way to use this tool.

Additionally opencode is powered by the provider list at [models.dev](https://models.dev) so you can use `opencode auth login` to configure api keys for any provider you'd like to use. This is stored in `~/.local/share/opencode/auth.json`

```bash
$ opencode auth login

┌  Add credential
│
◆  Select provider
│  ● Anthropic (recommended)
│  ○ OpenAI
│  ○ Google
│  ○ Amazon Bedrock
│  ○ Azure
│  ○ DeepSeek
│  ○ Groq
│  ...
└
```

The models.dev dataset is also used to detect common environment variables like `OPENAI_API_KEY` to autoload that provider.

If there are additional providers you want to use you can submit a PR to the [models.dev repo](https://github.com/sst/models.dev). If configuring just for yourself check out the Config section below

### Project Config

Project configuration is optional. You can place an `opencode.json` file in the root of your repo and it will be loaded.

```json title="opencode.json"
{
  "$schema": "http://opencode.ai/config.json"
}
```

#### MCP

```json title="opencode.json"
{
  "$schema": "http://opencode.ai/config.json",
  "mcp": {
    "localmcp": {
      "type": "local",
      "command": ["bun", "x", "my-mcp-command"],
      "environment": {
        "MY_ENV_VAR": "my_env_var_value"
      }
    },
    "remotemcp": {
      "type": "remote",
      "url": "https://my-mcp-server.com"
    }
  }
}
```

### Contributing

To run opencode locally you need

- bun
- golang 1.24.x

To run

```
$ bun install
$ cd packages/opencode
$ bun run src/index.ts
```
