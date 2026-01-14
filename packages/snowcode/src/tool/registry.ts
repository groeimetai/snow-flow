import { BashTool } from "./bash"
import { EditTool } from "./edit"
import { GlobTool } from "./glob"
import { GrepTool } from "./grep"
import { ListTool } from "./ls"
import { PatchTool } from "./patch"
import { ReadTool } from "./read"
import { TaskTool } from "./task"
import { TodoWriteTool, TodoReadTool } from "./todo"
import { WebFetchTool } from "./webfetch"
import { WriteTool } from "./write"
import { InvalidTool } from "./invalid"
import { ToolSearchTool, ToolSearch, type ToolIndexEntry } from "./tool-search"
import { SkillTool } from "./skill"
// DeferredToolExecutor is no longer needed - tools are now dynamically loaded after tool_search
import type { Agent } from "../agent/agent"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import { Config } from "../config/config"
import { Log } from "../util/log"
import path from "path"
// @ts-expect-error - workspace package resolved at runtime by Bun
import { type ToolDefinition } from "@groeimetai/snow-flow-plugin"
import z from "zod/v4"
import { Plugin } from "../plugin"

const log = Log.create({ service: "tool-registry" })

export namespace ToolRegistry {
  export const state = Instance.state(async () => {
    const custom = [] as Tool.Info[]
    const glob = new Bun.Glob("tool/*.{js,ts}")

    for (const dir of await Config.directories()) {
      for await (const match of glob.scan({ cwd: dir, absolute: true, followSymlinks: true, dot: true })) {
        const namespace = path.basename(match, path.extname(match))
        const mod = await import(match)
        for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
          custom.push(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def))
        }
      }
    }

    const plugins = await Plugin.list()
    for (const plugin of plugins) {
      for (const [id, def] of Object.entries(plugin.tool ?? {})) {
        custom.push(fromPlugin(id, def))
      }
    }

    return { custom }
  })

  function fromPlugin(id: string, def: ToolDefinition): Tool.Info {
    return {
      id,
      init: async () => ({
        parameters: z.object(def.args),
        description: def.description,
        execute: async (args, ctx) => {
          const result = await def.execute(args as any, ctx)
          return {
            title: "",
            output: result,
            metadata: {},
          }
        },
      }),
    }
  }

  export async function register(tool: Tool.Info) {
    const { custom } = await state()
    const idx = custom.findIndex((t) => t.id === tool.id)
    if (idx >= 0) {
      custom.splice(idx, 1, tool)
      return
    }
    custom.push(tool)
  }

  // Core tools that are ALWAYS loaded (never deferred)
  // Tool discovery works via tool_search, which enables tools that become
  // available in the next loop iteration (dynamic tool loading)
  const CORE_TOOLS: Tool.Info[] = [
    InvalidTool,
    BashTool,
    EditTool,
    WebFetchTool,
    GlobTool,
    GrepTool,
    ListTool,
    PatchTool,
    ReadTool,
    WriteTool,
    TodoWriteTool,
    TodoReadTool,
    TaskTool,
    ToolSearchTool, // Meta-tool for discovering and enabling tools dynamically
    SkillTool, // Semantic skill activation - model decides when to use skills
  ]

  async function all(): Promise<Tool.Info[]> {
    const custom = await state().then((x) => x.custom)
    return [...CORE_TOOLS, ...custom]
  }

  /**
   * Get only immediately available tools (not deferred)
   * This significantly reduces token usage at startup
   */
  export async function immediateTools(): Promise<Tool.Info[]> {
    const allTools = await all()
    return allTools.filter((t) => !t.deferred)
  }

  /**
   * Get only deferred tools
   */
  export async function deferredTools(): Promise<Tool.Info[]> {
    const allTools = await all()
    return allTools.filter((t) => t.deferred)
  }

  /**
   * Register all tools with the search index
   * This should be called during initialization
   */
  export async function buildSearchIndex(): Promise<void> {
    const allTools = await all()
    const entries: ToolIndexEntry[] = []

    for (const tool of allTools) {
      const initialized = await tool.init().catch(() => null)
      if (!initialized) continue

      entries.push({
        id: tool.id,
        description: initialized.description.substring(0, 200), // Truncate for index
        category: tool.category ?? "general",
        keywords: tool.keywords ?? [],
        deferred: tool.deferred ?? false,
      })
    }

    await ToolSearch.registerTools(entries)
    log.info("Built tool search index", {
      total: entries.length,
      deferred: entries.filter((e) => e.deferred).length,
      immediate: entries.filter((e) => !e.deferred).length,
    })
  }

  export async function ids() {
    return all().then((x) => x.map((t) => t.id))
  }

  export async function tools(_providerID: string, _modelID: string) {
    const tools = await all()
    const result = await Promise.all(
      tools.map(async (t) => ({
        id: t.id,
        ...(await t.init()),
      })),
    )
    return result
  }

  export async function enabled(
    _providerID: string,
    _modelID: string,
    agent: Agent.Info,
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {}
    result["patch"] = false

    if (agent.permission.edit === "deny") {
      result["edit"] = false
      result["patch"] = false
      result["write"] = false
    }
    if (agent.permission.bash["*"] === "deny" && Object.keys(agent.permission.bash).length === 1) {
      result["bash"] = false
    }
    if (agent.permission.webfetch === "deny") {
      result["webfetch"] = false
    }

    return result
  }
}
