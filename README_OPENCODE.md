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
npm install -g opencode-ai

# 2. Install Snow-Flow
npm install -g snow-flow

# 3. Configure OpenCode for Snow-Flow
cd /path/to/snow-flow
opencode config import opencode-config.example.json

# 4. Configure .env file
cp .env.example .env
# Edit .env with:
#   - ServiceNow credentials (SNOW_INSTANCE, SNOW_CLIENT_ID, etc.)
#   - LLM provider API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
#   - Default model (DEFAULT_LLM_PROVIDER, DEFAULT_ANTHROPIC_MODEL, etc.)

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

**Method 1: Set in .env (Recommended)**

Edit your `.env` file:
```bash
# Use Claude (expensive, best quality)
DEFAULT_LLM_PROVIDER=anthropic
DEFAULT_ANTHROPIC_MODEL=claude-sonnet-4
ANTHROPIC_API_KEY=sk-ant-...

# OR use GPT-4o-mini (cheap, good quality)
DEFAULT_LLM_PROVIDER=openai
DEFAULT_OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...

# OR use Gemini (cheap, fast)
DEFAULT_LLM_PROVIDER=google
DEFAULT_GOOGLE_MODEL=gemini-1.5-pro
GOOGLE_API_KEY=...

# OR use Llama locally (FREE!)
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_OLLAMA_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434
```

**Method 2: Override via CLI**
```bash
opencode config set model.provider anthropic
opencode config set model.model claude-sonnet-4
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
