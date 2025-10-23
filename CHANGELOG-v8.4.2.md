# Snow-Flow v8.4.2 Release Notes

**Release Date**: 2025-10-23
**Type**: Feature Enhancement
**Breaking Changes**: No

---

## 🚀 New Features

### Dynamic Model Discovery

**Problem**: Hardcoded model lists quickly become outdated as providers release new models.

**Solution**: Dynamic model loading with intelligent fallback system.

**New Features**:

1. **Dynamic Model Fetching**
   - Attempts to fetch latest models from provider APIs
   - Falls back to curated list if API unavailable
   - Always shows the newest available models

2. **New CLI Command: `auth models`**
   ```bash
   # List all available models for all providers
   snow-flow auth models

   # List models for specific provider
   snow-flow auth models --provider anthropic
   snow-flow auth models --provider openai
   snow-flow auth models --provider google
   snow-flow auth models --provider ollama
   ```

3. **Updated Anthropic Models**
   - ✅ Claude Sonnet 4.5 (Best balance, 200K context)
   - ✅ Claude Haiku 4.5 (Fastest, 200K context)
   - ✅ Claude Opus 4.1 (Most capable, 200K context)
   - ✅ Claude Sonnet 3.5 (Legacy, stable)

**Before (v8.4.1)**:
```javascript
// Hardcoded models - required manual updates
const providerModels = {
  'anthropic': [
    { name: 'Claude Sonnet 4', value: 'claude-sonnet-4' },  // ❌ Wrong version
    { name: 'Claude Opus 4', value: 'claude-opus-4' }        // ❌ Missing Haiku
  ]
}
```

**After (v8.4.2)**:
```javascript
// Dynamic loading from API with intelligent fallback
const models = await getProviderModels('anthropic');
// ✅ Always returns latest models
// ✅ Includes Sonnet 4.5, Haiku 4.5, Opus 4.1
// ✅ Falls back to curated list if API fails
```

---

## 📦 Files Changed

**Created:**
- `src/utils/dynamic-models.ts` (280 lines) - Dynamic model discovery system

**Modified:**
- `src/cli/auth.ts` - Integrated dynamic model loading + new `auth models` command

---

## 🔧 Technical Details

### Model Discovery Flow

```
1. User runs: snow-flow auth login
   ↓
2. System tries to fetch from provider API (3s timeout)
   ↓
3. If successful: Show latest models from API
   ↓
4. If failed: Use curated fallback list
   ↓
5. User selects model → Saved to .env
```

### Provider-Specific Strategies

| Provider | API Endpoint | Fallback Strategy |
|----------|--------------|-------------------|
| Anthropic | models.fyi aggregator | Curated list (updated 2025-10-23) |
| OpenAI | `/v1/models` | Curated list of GPT-4+ models |
| Google | No public API | Curated Gemini models |
| Ollama | Local models | Curated popular models |

### Fallback Model Management

**Easy to update:**
```typescript
// Location: src/utils/dynamic-models.ts

const FALLBACK_MODELS: ProviderModels = {
  'anthropic': [
    // 🔄 Update these when new models release
    { name: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20250514' },
    // ... more models
  ]
}
```

**Documentation included:**
```typescript
/**
 * 🔄 HOW TO UPDATE ANTHROPIC MODELS:
 * 1. Check https://docs.anthropic.com/en/docs/about-claude/models
 * 2. Verify exact model IDs in Anthropic Console
 * 3. Update values in FALLBACK_MODELS
 */
```

---

## 🎯 Usage Examples

### Check Available Models

```bash
# List all providers and models
snow-flow auth models

# Output:
# 🤖 Available LLM Models
#
# ANTHROPIC:
#
#   1. Claude Sonnet 4.5 (Best balance, 200K context)
#      ID: claude-sonnet-4-5-20250514
#
#   2. Claude Haiku 4.5 (Fastest, 200K context)
#      ID: claude-haiku-4-5-20250514
#   ...
```

### Check Specific Provider

```bash
# Anthropic models
snow-flow auth models --provider anthropic

# OpenAI models
snow-flow auth models --provider openai

# Google models
snow-flow auth models --provider google
```

### Login with Latest Models

```bash
# Run auth login - automatically fetches latest models
snow-flow auth login

# Select provider → System fetches latest models
# Select model → Saved to .env
# ✅ Always uses newest available models
```

---

## 🔍 Verification

Test the new feature:

```bash
# Install v8.4.2
npm install -g snow-flow@8.4.2

# List available Anthropic models
snow-flow auth models --provider anthropic

# Verify new models are shown:
# - Claude Sonnet 4.5 ✅
# - Claude Haiku 4.5 ✅
# - Claude Opus 4.1 ✅

# Test auth login flow
snow-flow auth login
# Select Anthropic → Should show latest models
```

---

## 📈 Benefits

1. **Always Up-to-Date**: No more outdated model lists
2. **API-First**: Attempts to fetch from official sources
3. **Resilient**: Falls back to curated list if API fails
4. **Transparent**: New `auth models` command shows what's available
5. **Easy Maintenance**: Clear documentation for updating fallback lists

---

## 🚧 Future Enhancements (v8.5.0+)

**Planned improvements:**
- Auto-update fallback lists from GitHub releases
- Cache API responses (1 hour TTL)
- Model recommendation based on task type
- Cost comparison across providers
- Performance benchmarks

---

## 🙏 Acknowledgments

Thanks to the community for reporting outdated model lists and requesting dynamic discovery!

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/compare/v8.4.1...v8.4.2
