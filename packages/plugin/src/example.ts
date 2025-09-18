import { Plugin } from "./index"
import { tool } from "./tool"

export const ExamplePlugin: Plugin = async (ctx) => {
  return {
    permission: {},
    tool: {
      mytool: tool((zod) => ({
        description: "This is a custom tool tool",
        args: {
          foo: zod.string(),
        },
        async execute(args, ctx) {
          return `Hello ${args.foo}!`
        },
      })),
    },
    async "chat.params"(_input, output) {
      output.topP = 1
    },
  }
}
