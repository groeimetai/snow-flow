import { Config } from "../config/config"
import z from "zod/v4"
import { Provider } from "../provider/provider"
import { generateObject, type ModelMessage } from "ai"
import PROMPT_GENERATE from "./generate.txt"
import { SystemPrompt } from "../session/system"
import { Instance } from "../project/instance"
import { mergeDeep } from "remeda"

export namespace Agent {
  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      mode: z.union([z.literal("subagent"), z.literal("primary"), z.literal("all")]),
      builtIn: z.boolean(),
      topP: z.number().optional(),
      temperature: z.number().optional(),
      permission: z.object({
        edit: Config.Permission,
        bash: z.record(z.string(), Config.Permission),
        webfetch: Config.Permission.optional(),
      }),
      model: z
        .object({
          modelID: z.string(),
          providerID: z.string(),
        })
        .optional(),
      prompt: z.string().optional(),
      tools: z.record(z.string(), z.boolean()),
      options: z.record(z.string(), z.any()),
    })
    .meta({
      ref: "Agent",
    })
  export type Info = z.infer<typeof Info>

  const state = Instance.state(async () => {
    const cfg = await Config.get()
    const defaultTools = cfg.tools ?? {}
    const defaultPermission: Info["permission"] = {
      edit: "allow",
      bash: {
        "*": "allow",
      },
      webfetch: "allow",
    }
    const agentPermission = mergeAgentPermissions(defaultPermission, cfg.permission ?? {})

    const planPermission = mergeAgentPermissions(
      {
        edit: "deny",
        bash: {
          allow: [
            // Unix utilities (read-only)
            "awk*",
            "cut*",
            "diff*",
            "du*",
            "file *",
            "find *",
            "grep*",
            "head*",
            "less*",
            "ls*",
            "more*",
            "pwd*",
            "rg*",
            "sed -n *",
            "sort*",
            "stat*",
            "tail*",
            "tree*",
            "uniq*",
            "wc*",
            "whereis*",
            "which*",

            // Git commands (read-only)
            "git diff*",
            "git log*",
            "git show*",
            "git status*",
            "git branch",
            "git branch -v",
            "git branch -a",
            "git branch --list*",
            "git remote*",
            "git config --get*",
            "git config --list*",

            // Jira CLI (read-only) - supports both jira-cli and acli
            "jira issue view*",
            "jira issue list*",
            "jira issue search*",
            "jira sprint list*",
            "jira sprint view*",
            "jira board list*",
            "jira board view*",
            "jira project list*",
            "jira project view*",
            "jira me*",
            "acli jira workitem show*",
            "acli jira workitem list*",
            "acli jira workitem query*",
            "acli jira project list*",
            "acli jira project show*",
            "acli jira sprint list*",
            "acli jira board list*",

            // Azure DevOps CLI (read-only)
            "az devops project list*",
            "az devops project show*",
            "az devops extension list*",
            "az devops extension show*",
            "az devops configure --list*",
            "az devops --help*",
            "az pipelines list*",
            "az pipelines show*",
            "az pipelines runs list*",
            "az pipelines runs show*",
            "az pipelines variable list*",
            "az repos list*",
            "az repos show*",
            "az repos pr list*",
            "az repos pr show*",
            "az boards list*",
            "az boards query*",
            "az boards work-item show*",
            "az boards iteration project list*",
            "az boards iteration project show*",
            "az boards iteration team list*",
            "az boards iteration team list-work-items*",
            "az boards iteration team show-backlog*",
            "az boards iteration team show-work-items*",
            "az boards area project list*",
            "az boards area project show*",
            "az boards area team list*",
            "az artifacts list*",
            "az artifacts universal list*",
          ],
          ask: [
            // Unix utilities (destructive)
            "awk -i inplace*",
            "awk --inplace*",
            "find * -delete*",
            "find * -exec*",
            "find * -fprint*",
            "find * -fls*",
            "find * -fprintf*",
            "find * -ok*",
            "sed --in-place*",
            "sed -i*",
            "sort --output=*",
            "sort -o *",
            "tree -o *",

            // Git commands (write operations)
            "git add*",
            "git commit*",
            "git push*",
            "git pull*",
            "git merge*",
            "git rebase*",
            "git reset*",
            "git checkout*",
            "git switch*",
            "git stash*",
            "git tag*",
            "git branch -d*",
            "git branch -D*",
            "git branch -m*",
            "git config --add*",
            "git config --set*",
            "git config --unset*",

            // Jira CLI (write operations)
            "jira issue create*",
            "jira issue edit*",
            "jira issue update*",
            "jira issue delete*",
            "jira issue assign*",
            "jira issue move*",
            "jira issue transition*",
            "jira issue comment*",
            "jira sprint add*",
            "jira sprint remove*",
            "acli jira workitem create*",
            "acli jira workitem update*",
            "acli jira workitem delete*",
            "acli jira workitem transition*",
            "acli jira workitem assign*",

            // Azure DevOps CLI (write operations)
            "az devops project create*",
            "az devops project delete*",
            "az devops extension install*",
            "az devops extension uninstall*",
            "az pipelines create*",
            "az pipelines delete*",
            "az pipelines update*",
            "az pipelines run*",
            "az pipelines variable create*",
            "az pipelines variable delete*",
            "az repos create*",
            "az repos delete*",
            "az repos update*",
            "az repos pr create*",
            "az repos pr update*",
            "az boards work-item create*",
            "az boards work-item update*",
            "az boards work-item delete*",
            "az boards iteration project create*",
            "az boards iteration project delete*",
            "az boards iteration team add*",
            "az boards iteration team remove*",
            "az boards area project create*",
            "az boards area project delete*",
            "az boards area team add*",
            "az boards area team remove*",
            "az artifacts universal publish*",

            // Catch-all for unknown commands
            "*",
          ],
        },
        webfetch: "allow",
      },
      cfg.permission ?? {},
    )

    const result: Record<string, Info> = {
      general: {
        name: "general",
        description:
          "General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you.",
        tools: {
          todoread: false,
          todowrite: false,
          ...defaultTools,
        },
        options: {},
        permission: agentPermission,
        mode: "subagent",
        builtIn: true,
      },
      build: {
        name: "build",
        tools: { ...defaultTools },
        options: {},
        permission: agentPermission,
        mode: "primary",
        builtIn: true,
      },
      plan: {
        name: "plan",
        options: {},
        permission: planPermission,
        tools: {
          ...defaultTools,
        },
        mode: "primary",
        builtIn: true,
      },
    }
    for (const [key, value] of Object.entries(cfg.agent ?? {})) {
      if (value.disable) {
        delete result[key]
        continue
      }
      let item = result[key]
      if (!item)
        item = result[key] = {
          name: key,
          mode: "all",
          permission: agentPermission,
          options: {},
          tools: {},
          builtIn: false,
        }
      const { name, model, prompt, tools, description, temperature, top_p, mode, permission, ...extra } = value
      item.options = {
        ...item.options,
        ...extra,
      }
      if (model) item.model = Provider.parseModel(model)
      if (prompt) item.prompt = prompt
      if (tools)
        item.tools = {
          ...item.tools,
          ...tools,
        }
      item.tools = {
        ...defaultTools,
        ...item.tools,
      }
      if (description) item.description = description
      if (temperature != undefined) item.temperature = temperature
      if (top_p != undefined) item.topP = top_p
      if (mode) item.mode = mode
      // just here for consistency & to prevent it from being added as an option
      if (name) item.name = name

      if (permission ?? cfg.permission) {
        item.permission = mergeAgentPermissions(cfg.permission ?? {}, permission ?? {})
      }
    }
    return result
  })

  export async function get(agent: string) {
    return state().then((x) => x[agent])
  }

  export async function list() {
    return state().then((x) => Object.values(x))
  }

  export async function generate(input: { description: string }) {
    const defaultModel = await Provider.defaultModel()
    const model = await Provider.getModel(defaultModel.providerID, defaultModel.modelID)
    const system = SystemPrompt.header(defaultModel.providerID)
    system.push(PROMPT_GENERATE)
    const existing = await list()
    const result = await generateObject({
      temperature: 0.3,
      prompt: [
        ...system.map(
          (item): ModelMessage => ({
            role: "system",
            content: item,
          }),
        ),
        {
          role: "user",
          content: `Create an agent configuration based on this request: \"${input.description}\".\n\nIMPORTANT: The following identifiers already exist and must NOT be used: ${existing.map((i) => i.name).join(", ")}\n  Return ONLY the JSON object, no other text, do not wrap in backticks`,
        },
      ],
      model: model.language,
      schema: z.object({
        identifier: z.string(),
        whenToUse: z.string(),
        systemPrompt: z.string(),
      }),
    })
    return result.object
  }
}

function mergeAgentPermissions(basePermission: any, overridePermission: any): Agent.Info["permission"] {
  if (typeof basePermission.bash === "string") {
    basePermission.bash = {
      "*": basePermission.bash,
    }
  }
  if (typeof overridePermission.bash === "string") {
    overridePermission.bash = {
      "*": overridePermission.bash,
    }
  }
  const merged = mergeDeep(basePermission ?? {}, overridePermission ?? {}) as any
  let mergedBash
  if (merged.bash) {
    if (typeof merged.bash === "string") {
      mergedBash = {
        "*": merged.bash,
      }
    } else if (typeof merged.bash === "object") {
      mergedBash = mergeDeep(
        {
          "*": "allow",
        },
        merged.bash,
      )
    }
  }

  const result: Agent.Info["permission"] = {
    edit: merged.edit ?? "allow",
    webfetch: merged.webfetch ?? "allow",
    bash: mergedBash ?? { "*": "allow" },
  }

  return result
}
