import { tool, type Tool as AITool } from "ai";
import { Log } from "../util/log";

const log = Log.create({ service: "tool" });

export namespace Tool {
  export interface Metadata {
    properties: Record<string, any>;
    time: {
      start: number;
      end: number;
    };
  }
  export function define<Params, Output>(
    input: AITool<Params, { metadata?: any; output: Output }> & {
      name: string;
    },
  ) {
    return {
      [input.name]: tool({
        ...input,
        execute: async (params, opts) => {
          log.info("invoking", {
            id: opts.toolCallId,
            name: input.name,
            ...params,
          });
          try {
            const start = Date.now();
            const result = await input.execute!(params, opts);
            const metadata: Metadata = {
              properties: result.metadata,
              time: {
                start,
                end: Date.now(),
              },
            };
            return {
              metadata,
              output: result.output,
            };
          } catch (e: any) {
            return "An error occurred: " + e.toString();
          }
        },
      }),
    };
  }
}
