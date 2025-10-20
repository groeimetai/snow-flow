# Testing BYOLLM Branch in GitHub Codespace

## 🚀 Quick Setup (5 minutes)

### Step 1: Create GitHub Codespace

1. Go to https://github.com/groeimetai/snow-flow
2. Click **Code** → **Codespaces** → **Create codespace on feature/byollm-implementation**
3. Wait for Codespace to start

### Step 2: Build Snow-Flow

```bash
# In the Codespace terminal:

# Install dependencies
npm install

# Build the project
npm run build

# Link for local testing (instead of global install)
npm link
```

### Step 3: Install OpenCode

```bash
npm install -g opencode-ai
```

### Step 4: Configure Environment

```bash
# Copy example .env
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required in .env:**
```bash
# ServiceNow
SNOW_INSTANCE=your-instance.service-now.com
SNOW_CLIENT_ID=your-client-id
SNOW_CLIENT_SECRET=your-client-secret

# LLM Provider (choose one)
DEFAULT_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OR use OpenAI
# DEFAULT_LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# DEFAULT_OPENAI_MODEL=gpt-4o-mini

# OR use Ollama (local, free)
# DEFAULT_LLM_PROVIDER=ollama
# DEFAULT_OLLAMA_MODEL=llama3.1
# OLLAMA_BASE_URL=http://localhost:11434
```

### Step 5: Configure OpenCode

```bash
# Import Snow-Flow MCP configuration
opencode config import opencode-config.example.json
```

### Step 6: Authenticate with ServiceNow

```bash
snow-flow auth login
```

### Step 7: Test Snow-Flow Swarm with OpenCode!

```bash
# This should launch OpenCode with your configured LLM
snow-flow swarm "create a simple test widget"
```

---

## 🔍 Verification Steps

### Check Installation

```bash
# Check Snow-Flow is linked
which snow-flow
# Should show: /home/codespace/.nvm/versions/node/vXX.X.X/bin/snow-flow

# Check OpenCode is installed
which opencode
# Should show: /home/codespace/.nvm/versions/node/vXX.X.X/bin/opencode

# Check version
snow-flow --version
```

### Check Configuration

```bash
# Check .env exists and has required vars
cat .env | grep -E "SNOW_INSTANCE|DEFAULT_LLM_PROVIDER|ANTHROPIC_API_KEY|OPENAI_API_KEY"

# Check OpenCode config
cat ~/.opencode/config.json
```

### Test Components

```bash
# Test OpenCode CLI
opencode --version

# Test Snow-Flow status
snow-flow status

# Test authentication
snow-flow auth status
```

---

## 🐛 Troubleshooting

### "OpenCode CLI not found"

```bash
npm install -g opencode-ai
```

### "OpenCode configuration not found"

```bash
# Make sure you're in the snow-flow directory
cd /workspaces/snow-flow
opencode config import opencode-config.example.json
```

### ".env file not found"

```bash
cp .env.example .env
nano .env  # Add your credentials
```

### "snow-flow command not found"

```bash
# Re-link the package
npm link

# Or install globally from local directory
npm install -g .
```

### OpenCode doesn't start

```bash
# Check OpenCode config
cat ~/.opencode/config.json

# Try manual start
opencode
# Then paste objective manually
```

---

## 📦 Alternative: Install from GitHub Directly

If you want to install without cloning:

```bash
# Install directly from GitHub branch
npm install -g git+https://github.com/groeimetai/snow-flow.git#feature/byollm-implementation

# This installs the built dist/ from the branch
snow-flow --version
```

**Note:** This requires the dist/ to be committed to the branch, which it currently isn't.

---

## 🔧 Development Workflow

If you want to make changes and test:

```bash
# 1. Make changes to src/cli.ts or other files

# 2. Rebuild
npm run build

# 3. Test immediately (npm link keeps it updated)
snow-flow swarm "test objective"
```

---

## ✅ Expected Behavior

When you run `snow-flow swarm "create test widget"`:

1. ✅ Snow-Flow checks for OpenCode installation
2. ✅ Validates opencode-config.example.json exists
3. ✅ Validates .env has required configuration
4. ✅ Launches OpenCode with the objective
5. ✅ OpenCode connects to Snow-Flow's MCP servers (235+ tools)
6. ✅ OpenCode uses your configured LLM from .env
7. ✅ Creates real ServiceNow artifacts

---

## 📊 What to Test

### Basic Tests

- [ ] `snow-flow swarm "create simple widget"`
- [ ] `snow-flow swarm "query incidents"`
- [ ] `snow-flow swarm "create business rule"`

### Provider Tests

- [ ] Test with Anthropic (Claude)
- [ ] Test with OpenAI (GPT)
- [ ] Test with Ollama (local)

### Error Handling

- [ ] Run without .env → Should show helpful error
- [ ] Run without OpenCode installed → Should prompt to install
- [ ] Run without opencode config → Should show import command

---

## 🎯 Success Criteria

- ✅ `snow-flow swarm` launches OpenCode (not Claude Code)
- ✅ OpenCode uses LLM from .env configuration
- ✅ MCP servers connect (235+ ServiceNow tools available)
- ✅ Can create real ServiceNow artifacts
- ✅ Can switch LLM providers by editing .env

---

## 📝 Report Issues

If you encounter issues, please provide:

1. Command you ran
2. Error message
3. Output of:
   ```bash
   snow-flow --version
   opencode --version
   cat .env | grep -E "DEFAULT_LLM_PROVIDER|SNOW_INSTANCE"
   ls -la opencode-config.example.json
   ```
