import { tool, type Tool as AITool } from "ai"
import { Log } from "../util/log"

const log = Log.create({ service: "tool" })

export namespace Tool {
  export interface Metadata<
    Properties extends Record<string, any> = Record<string, any>,
  > {
    properties: Properties
    time: {
      start: number
      end: number
    }
  }
  export function define<
    Params,
    Output extends { metadata?: any; output: any },
    Name extends string,
  >(
    input: AITool<Params, Output> & {
      name: Name
    },
  ) {
    return tool({
      ...input,
      execute: async (params, opts) => {
        log.info("invoking", {
          id: opts.toolCallId,
          name: input.name,
          ...params,
        })
        try {
          const start = Date.now()
          const result = await input.execute!(params, opts)
          const metadata: Metadata<Output["metadata"]> = {
            ...result.metadata,
            time: {
              start,
              end: Date.now(),
            },
          }
          return {
            metadata,
            output: result.output,
          }
        } catch (e: any) {
          log.error("error", {
            msg: e.toString(),
          })
          return {
            metadata: {
              error: true,
            },
            output: "An error occurred: " + e.toString(),
          }
        }
      },
    })
  }
}
