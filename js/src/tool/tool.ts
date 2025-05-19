import { type Tool, tool as AITool } from "ai";
import { Log } from "../util/log";

const log = Log.create({ service: "tool" });

export function tool<Params, Result>(
  tool: Tool<Params, Result> & {
    name: string;
  },
) {
  return {
    [tool.name]: AITool({
      ...tool,
      execute: async (params, opts) => {
        log.info("invoking", {
          id: opts.toolCallId,
          name: tool.name,
          ...params,
        });
        try {
          return tool.execute!(params, opts);
        } catch (e: any) {
          return "An error occurred: " + e.toString();
        }
      },
    }),
  };
}
