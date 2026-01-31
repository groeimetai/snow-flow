function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

// Helper to check both SNOW_CODE_* and OPENCODE_* (for backwards compatibility)
function truthyBoth(key: string) {
  return truthy(`SNOW_CODE_${key}`) || truthy(`OPENCODE_${key}`)
}

function envBoth(key: string) {
  return process.env[`SNOW_CODE_${key}`] || process.env[`OPENCODE_${key}`]
}

export namespace Flag {
  // Support both SNOW_CODE_* and OPENCODE_* environment variables
  export const OPENCODE_AUTO_SHARE = truthyBoth("AUTO_SHARE")
  export const OPENCODE_GIT_BASH_PATH = envBoth("GIT_BASH_PATH")
  export const OPENCODE_CONFIG = envBoth("CONFIG")
  export declare const SNOW_CODE_CONFIG_DIR: string | undefined
  export declare const OPENCODE_CONFIG_DIR: string | undefined
  export const OPENCODE_CONFIG_CONTENT = envBoth("CONFIG_CONTENT")
  export const OPENCODE_DISABLE_AUTOUPDATE = truthyBoth("DISABLE_AUTOUPDATE")
  export const OPENCODE_DISABLE_PRUNE = truthyBoth("DISABLE_PRUNE")
  export const OPENCODE_DISABLE_TERMINAL_TITLE = truthyBoth("DISABLE_TERMINAL_TITLE")
  export const OPENCODE_PERMISSION = envBoth("PERMISSION")
  export const OPENCODE_DISABLE_DEFAULT_PLUGINS = truthyBoth("DISABLE_DEFAULT_PLUGINS")
  export const OPENCODE_DISABLE_LSP_DOWNLOAD = truthyBoth("DISABLE_LSP_DOWNLOAD")
  export const OPENCODE_ENABLE_EXPERIMENTAL_MODELS = truthyBoth("ENABLE_EXPERIMENTAL_MODELS")
  export const OPENCODE_DISABLE_AUTOCOMPACT = truthyBoth("DISABLE_AUTOCOMPACT")
  export const OPENCODE_DISABLE_MODELS_FETCH = truthyBoth("DISABLE_MODELS_FETCH")
  export const OPENCODE_DISABLE_CLAUDE_CODE = truthyBoth("DISABLE_CLAUDE_CODE")
  export const OPENCODE_DISABLE_CLAUDE_CODE_PROMPT =
    OPENCODE_DISABLE_CLAUDE_CODE || truthyBoth("DISABLE_CLAUDE_CODE_PROMPT")
  export const OPENCODE_DISABLE_CLAUDE_CODE_SKILLS =
    OPENCODE_DISABLE_CLAUDE_CODE || truthyBoth("DISABLE_CLAUDE_CODE_SKILLS")
  export declare const OPENCODE_DISABLE_PROJECT_CONFIG: boolean
  export const OPENCODE_FAKE_VCS = envBoth("FAKE_VCS")
  export const OPENCODE_CLIENT = envBoth("CLIENT") ?? "cli"
  export const OPENCODE_SERVER_PASSWORD = envBoth("SERVER_PASSWORD")
  export const OPENCODE_SERVER_USERNAME = envBoth("SERVER_USERNAME")

  // Experimental
  export const OPENCODE_EXPERIMENTAL = truthyBoth("EXPERIMENTAL")
  export const OPENCODE_EXPERIMENTAL_FILEWATCHER = truthyBoth("EXPERIMENTAL_FILEWATCHER")
  export const OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER = truthyBoth("EXPERIMENTAL_DISABLE_FILEWATCHER")
  export const OPENCODE_EXPERIMENTAL_ICON_DISCOVERY =
    OPENCODE_EXPERIMENTAL || truthyBoth("EXPERIMENTAL_ICON_DISCOVERY")
  export const OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT = truthyBoth("EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const OPENCODE_ENABLE_EXA =
    truthyBoth("ENABLE_EXA") || OPENCODE_EXPERIMENTAL || truthyBoth("EXPERIMENTAL_EXA")
  export const OPENCODE_EXPERIMENTAL_BASH_MAX_OUTPUT_LENGTH = number("EXPERIMENTAL_BASH_MAX_OUTPUT_LENGTH")
  export const OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const OPENCODE_EXPERIMENTAL_OXFMT = OPENCODE_EXPERIMENTAL || truthyBoth("EXPERIMENTAL_OXFMT")
  export const OPENCODE_EXPERIMENTAL_LSP_TY = truthyBoth("EXPERIMENTAL_LSP_TY")
  export const OPENCODE_EXPERIMENTAL_LSP_TOOL = OPENCODE_EXPERIMENTAL || truthyBoth("EXPERIMENTAL_LSP_TOOL")
  export const OPENCODE_DISABLE_FILETIME_CHECK = truthyBoth("DISABLE_FILETIME_CHECK")
  export const OPENCODE_EXPERIMENTAL_PLAN_MODE = OPENCODE_EXPERIMENTAL || truthyBoth("EXPERIMENTAL_PLAN_MODE")
  export const OPENCODE_MODELS_URL = envBoth("MODELS_URL")

  function number(key: string) {
    const value = envBoth(key)
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for OPENCODE_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "OPENCODE_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("SNOW_CODE_DISABLE_PROJECT_CONFIG") || truthy("OPENCODE_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for SNOW_CODE_CONFIG_DIR (preferred)
Object.defineProperty(Flag, "SNOW_CODE_CONFIG_DIR", {
  get() {
    return process.env["SNOW_CODE_CONFIG_DIR"] || process.env["OPENCODE_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for OPENCODE_CONFIG_DIR (backwards compatibility)
Object.defineProperty(Flag, "OPENCODE_CONFIG_DIR", {
  get() {
    return process.env["SNOW_CODE_CONFIG_DIR"] || process.env["OPENCODE_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})
