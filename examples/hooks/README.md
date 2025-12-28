# Snow-Flow Hooks System

Snow-Flow supports a hybrid hook system combining:
1. **TypeScript plugins** - For complex logic (existing plugin system)
2. **Shell command hooks** - For simple automations (Claude Code style)

## Configuration

Hooks are configured in `.snow-flow/settings.json` or `opencode.jsonc`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "snow_execute_background_script",
        "hooks": [
          {
            "type": "command",
            "command": "./validate-es5.sh",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

## Available Hook Types

### Lifecycle Hooks

| Hook | Trigger | Can Block? |
|------|---------|------------|
| `PreToolUse` | Before any tool execution | Yes |
| `PostToolUse` | After tool execution | No |
| `SessionStart` | When session starts/resumes | No |
| `SessionEnd` | When session ends | No |
| `PromptSubmit` | Before prompt is processed | Yes |
| `ResponseComplete` | When LLM response is complete | No |
| `PreCompact` | Before context compaction | Yes |

### ServiceNow-Specific Hooks

| Hook | Trigger | Use Case |
|------|---------|----------|
| `PreDeploy` | Before artifact deployment | Validate widgets, check coherence |
| `PostDeploy` | After artifact deployment | Run tests, notify team |
| `PreScript` | Before background script | ES5 validation, block dangerous commands |
| `PostScript` | After background script | Log results, notify on errors |
| `UpdateSetChange` | Update set modifications | Track changes, audit |
| `InstanceConnect` | Instance connection | Security logging |

## Matcher Patterns

Matchers determine which tools trigger your hook:

- `"Bash"` - Match single tool
- `"Write|Edit"` - Match multiple tools (pipe separator)
- `"*"` - Match all tools
- `"snow_*"` - Match all ServiceNow tools (glob pattern)
- `"mcp__memory__*"` - Match MCP tools

## Exit Codes

- `0` - Success, action proceeds
- `2` - Block action, stderr is sent as reason to LLM
- Other - Non-blocking error, logged but action proceeds

## Environment Variables

Your hooks have access to these variables:

| Variable | Description |
|----------|-------------|
| `SNOW_FLOW_PROJECT_DIR` | Project root directory |
| `SNOW_FLOW_INSTANCE_URL` | ServiceNow instance URL |
| `SNOW_FLOW_SESSION_ID` | Current session ID |
| `SNOW_FLOW_TOOL_NAME` | Tool that triggered the hook |
| `SNOW_FLOW_TOOL_INPUT` | JSON stringified tool input (also piped to stdin) |
| `SNOW_FLOW_TOOL_OUTPUT` | JSON stringified tool output (PostToolUse only) |
| `SNOW_FLOW_HOOK_TYPE` | Type of hook being executed |

## Examples

### Block Table Creation (Requires Approval)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "snow_create_table",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Table creation requires approval!' >&2 && exit 2"
          }
        ]
      }
    ]
  }
}
```

### Log All Artifact Pushes

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "snow_push_artifact",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"[$(date)] Push completed\" >> ~/.snow-flow/deploy.log"
          }
        ]
      }
    ]
  }
}
```

### Optional: ES5 Validation for Widgets/Script Includes

Only enable this if you want to enforce ES5 syntax:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "snow_push_artifact",
        "hooks": [
          {
            "type": "command",
            "command": "type=$(echo $SNOW_FLOW_TOOL_INPUT | jq -r '.type'); if [ \"$type\" = 'widget' ] || [ \"$type\" = 'script_include' ]; then echo $SNOW_FLOW_TOOL_INPUT | jq -r '.content.script // .content.server_script // \"\"' | grep -qE '(const |let |=>)' && { echo 'ES6 syntax detected!' >&2; exit 2; }; fi; exit 0"
          }
        ]
      }
    ]
  }
}
```

### Auto-Format Code After Edits

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo $SNOW_FLOW_TOOL_INPUT | jq -r '.file_path' | xargs -I {} prettier --write {}"
          }
        ]
      }
    ]
  }
}
```

### Slack Notification on Deployment

```json
{
  "hooks": {
    "PostDeploy": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "curl -X POST -H 'Content-type: application/json' --data '{\"text\":\"Deployment completed: '$SNOW_FLOW_TOOL_NAME'\"}' $SLACK_WEBHOOK_URL"
          }
        ]
      }
    ]
  }
}
```

## TypeScript Plugin Hooks

For complex logic, use TypeScript plugins in `.snow-flow/plugin/`:

```typescript
// .snow-flow/plugin/my-hooks.ts
import type { Plugin } from "@groeimetai/snow-flow-plugin"

export const myHooks: Plugin = async (input) => {
  return {
    "servicenow.deploy.before": async (input, output) => {
      // Complex validation logic
      if (!validateWidget(input.config)) {
        output.allow = false
        output.reason = "Widget validation failed"
      }
    },

    "audit.log": async (input) => {
      // Send to external audit system
      await sendToAuditSystem(input)
    }
  }
}
```

## Best Practices

1. **Keep hooks fast** - Use timeouts, avoid slow operations
2. **Handle errors gracefully** - Don't block on non-critical failures
3. **Use logging** - Write to log files for debugging
4. **Test hooks locally** - Verify before deploying
5. **Use environment variables** - Don't hardcode secrets in hooks
