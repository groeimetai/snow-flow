import { Log } from "../util/log"
import path from "path"
import { z } from "zod"
import { App } from "../app/app"
import { Filesystem } from "../util/filesystem"
import { ModelsDev } from "../provider/models"
import { mergeDeep } from "remeda"
import { Global } from "../global"
import fs from "fs/promises"
import { lazy } from "../util/lazy"

export namespace Config {
  const log = Log.create({ service: "config" })

  export const state = App.state("config", async (app) => {
    let result = await global()
    for (const file of ["opencode.jsonc", "opencode.json"]) {
      const [resolved] = await Filesystem.findUp(
        file,
        app.path.cwd,
        app.path.root,
      )
      if (!resolved) continue
      try {
        result = mergeDeep(
          result,
          await import(resolved).then((mod) => Info.parse(mod.default)),
        )
        log.info("found", { path: resolved })
        break
      } catch (e) {
        if (e instanceof z.ZodError) {
          for (const issue of e.issues) {
            log.info(issue.message)
          }
          throw e
        }
        continue
      }
    }
    log.info("loaded", result)
    return result
  })

  export const McpLocal = z
    .object({
      type: z.literal("local"),
      command: z.string().array(),
      environment: z.record(z.string(), z.string()).optional(),
    })
    .openapi({
      ref: "Config.McpLocal",
    })

  export const McpRemote = z
    .object({
      type: z.literal("remote"),
      url: z.string(),
    })
    .openapi({
      ref: "Config.McpRemote",
    })

  export const Mcp = z.discriminatedUnion("type", [McpLocal, McpRemote])
  export type Mcp = z.infer<typeof Mcp>

  export const Keybinds = z
    .object({
      leader: z.string().optional(),
      help: z.string().optional(),
      editor_open: z.string().optional(),
      session_new: z.string().optional(),
      session_list: z.string().optional(),
      session_share: z.string().optional(),
      session_interrupt: z.string().optional(),
      session_compact: z.string().optional(),
      tool_details: z.string().optional(),
      model_list: z.string().optional(),
      theme_list: z.string().optional(),
      project_init: z.string().optional(),
      input_clear: z.string().optional(),
      input_paste: z.string().optional(),
      input_submit: z.string().optional(),
      input_newline: z.string().optional(),
      history_previous: z.string().optional(),
      history_next: z.string().optional(),
      messages_page_up: z.string().optional(),
      messages_page_down: z.string().optional(),
      messages_half_page_up: z.string().optional(),
      messages_half_page_down: z.string().optional(),
      messages_previous: z.string().optional(),
      messages_next: z.string().optional(),
      messages_first: z.string().optional(),
      messages_last: z.string().optional(),
      app_exit: z.string().optional(),
    })
    .openapi({
      ref: "Config.Keybinds",
    })
  export const Info = z
    .object({
      $schema: z.string().optional(),
      theme: z.string().optional(),
      keybinds: Keybinds.optional(),
      autoshare: z
        .boolean()
        .optional()
        .describe("Share newly created sessions automatically"),
      autoupdate: z
        .boolean()
        .optional()
        .describe("Automatically update to the latest version"),
      disabled_providers: z
        .array(z.string())
        .optional()
        .describe("Disable providers that are loaded automatically"),
      model: z
        .string()
        .describe(
          "Model to use in the format of provider/model, eg anthropic/claude-2",
        )
        .optional(),
      provider: z
        .record(
          ModelsDev.Provider.partial().extend({
            models: z.record(ModelsDev.Model.partial()),
            options: z.record(z.any()).optional(),
          }),
        )
        .optional(),
      mcp: z.record(z.string(), Mcp).optional(),
    })
    .openapi({
      ref: "Config.Info",
    })

  export type Info = z.output<typeof Info>

  export const global = lazy(async () => {
    let result = await Bun.file(path.join(Global.Path.config, "config.json"))
      .json()
      .then((mod) => Info.parse(mod))
      .catch(() => ({}) as Info)

    await import(path.join(Global.Path.config, "config"), {
      with: {
        type: "toml",
      },
    })
      .then(async (mod) => {
        const { provider, model, ...rest } = mod.default
        if (provider && model) result.model = `${provider}/${model}`
        result["$schema"] = "https://opencode.ai/config.json"
        result = mergeDeep(result, rest)
        await Bun.write(
          path.join(Global.Path.config, "config.json"),
          JSON.stringify(result, null, 2),
        )
        await fs.unlink(path.join(Global.Path.config, "config"))
      })
      .catch(() => {})
    return Info.parse(result)
  })

  export function get() {
    return state()
  }
}
