import z from "zod/v4"
import { Tool } from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import { Todo } from "../session/todo"
import { ToolSearch } from "./tool-search"

export const TodoWriteTool = Tool.define("todowrite", {
  description: DESCRIPTION_WRITE,
  parameters: z.object({
    todos: z.array(Todo.Info).describe("The updated todo list"),
  }),
  async execute(params, opts) {
    await Todo.update({
      sessionID: opts.sessionID,
      todos: params.todos,
    })

    // Get session-enabled tools for reminder
    const enabledTools = await ToolSearch.getEnabledTools(opts.sessionID)
    const toolReminder = enabledTools.size > 0
      ? `\n\n💡 REMINDER: You have ${enabledTools.size} previously discovered tools still available. Use them directly instead of WebFetch for integration URLs (github.com, raw.githubusercontent.com, atlassian.net, dev.azure.com, gitlab.com).`
      : ""

    return {
      title: `${params.todos.filter((x) => x.status !== "completed").length} todos`,
      output: JSON.stringify(params.todos, null, 2) + toolReminder,
      metadata: {
        todos: params.todos,
        enabledTools: [...enabledTools],
      },
    }
  },
})

export const TodoReadTool = Tool.define("todoread", {
  description: "Use this tool to read your todo list",
  parameters: z.object({}),
  async execute(_params, opts) {
    const todos = await Todo.get(opts.sessionID)
    return {
      title: `${todos.filter((x) => x.status !== "completed").length} todos`,
      metadata: {
        todos,
      },
      output: JSON.stringify(todos, null, 2),
    }
  },
})
