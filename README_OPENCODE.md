# 🏔️ Snow-Flow with OpenCode

**Use ANY LLM for ServiceNow Development**

## What Changed?

Snow-Flow now works with **OpenCode** - an open-source AI coding agent that supports 75+ LLM providers!

### Why OpenCode?

| Feature | OpenCode | Claude Code |
|---------|----------|-------------|
| **LLM Support** | 75+ providers | Claude only |
| **Models** | Claude, GPT, Gemini, Local | Claude only |
| **Cost** | Your API costs | $20/month Claude Pro |
| **Offline** | ✅ Yes (Ollama) | ❌ No |
| **Open Source** | ✅ Yes | ❌ No |

## Quick Start (2 Minutes)

```bash
# 1. Install OpenCode
npm install -g @opencode/cli

# 2. Install Snow-Flow
npm install -g snow-flow

# 3. Configure OpenCode for Snow-Flow
cd /path/to/snow-flow
opencode config import opencode-config.example.json

# 4. Set your ServiceNow credentials
cp .env.example .env
# Edit .env with your details

# 5. Start developing!
opencode
```

In OpenCode:
```
> Create a ServiceNow incident widget with real-time updates
```

**That's it!** OpenCode handles:
- ✅ Model selection (you choose)
- ✅ Agent coordination
- ✅ MCP tool discovery
- ✅ Everything else

Snow-Flow provides:
- ✅ 235+ ServiceNow tools via MCP

## Choose Your Model

```bash
# Use Claude (expensive, best quality)
opencode config set model.model claude-sonnet-4

# Use GPT-4o-mini (cheap, good quality)
opencode config set model.model gpt-4o-mini

# Use Gemini (cheap, fast)
opencode config set model.model gemini-pro

# Use Llama locally (FREE!)
opencode config set model.provider ollama
opencode config set model.model llama3.1
```

## Full Documentation

See [OPENCODE_SETUP.md](./OPENCODE_SETUP.md) for:
- Complete setup instructions
- ServiceNow OAuth configuration
- Troubleshooting guide
- Example workflows
- Advanced configuration

## Original README

For the full Snow-Flow documentation (originally for Claude Code), see [README.md](./README.md)

---

**Snow-Flow + OpenCode = TRUE BYOLLM** 🎉

Bring Your Own LLM to ServiceNow development!
