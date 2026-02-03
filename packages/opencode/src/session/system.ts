import { Ripgrep } from "../file/ripgrep"

import { Instance } from "../project/instance"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_ANTHROPIC_WITHOUT_TODO from "./prompt/qwen.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_CODER from "./prompt/coder.txt"

import PROMPT_CODEX from "./prompt/codex_header.txt"
import type { Provider } from "@/provider/provider"

export namespace SystemPrompt {
  export function instructions() {
    return PROMPT_CODEX.trim()
  }

  export function provider(model: Provider.Model) {
    const id = model.api.id.toLowerCase()

    // Codex (GPT-5 with OAuth)
    if (id.includes("gpt-5")) return [PROMPT_CODEX]

    // Autonomous/Research (GPT, Perplexity, xAI, Cohere)
    if (
      id.includes("gpt-") ||
      id.includes("o1") ||
      id.includes("o3") ||
      id.includes("sonar") ||
      id.includes("perplexity") ||
      id.includes("grok") ||
      id.includes("command-")
    )
      return [PROMPT_BEAST]

    // Google Gemini
    if (id.includes("gemini-")) return [PROMPT_GEMINI]

    // Anthropic Claude
    if (id.includes("claude")) return [PROMPT_ANTHROPIC]

    // Code-Focused Models (DeepSeek, Codestral, Qwen Coder, StarCoder)
    if (id.includes("deepseek") || id.includes("codestral") || id.includes("coder") || id.includes("starcoder"))
      return [PROMPT_CODER]

    // General Purpose / Fallback (Llama, Mistral, Qwen, Mixtral, Yi, Phi, etc.)
    return [PROMPT_ANTHROPIC_WITHOUT_TODO]
  }

  export async function environment(model: Provider.Model) {
    const project = Instance.project
    return [
      [
        `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Working directory: ${Instance.directory}`,
        `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`,
        `  Platform: ${process.platform}`,
        `  Today's date: ${new Date().toDateString()}`,
        `</env>`,
        `<files>`,
        `  ${
          project.vcs === "git" && false
            ? await Ripgrep.tree({
                cwd: Instance.directory,
                limit: 200,
              })
            : ""
        }`,
        `</files>`,
      ].join("\n"),
    ]
  }
}
