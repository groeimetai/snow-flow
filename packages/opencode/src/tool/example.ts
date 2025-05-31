import { z } from "zod"
import { Tool } from "./tool"

export const ExampleTool = Tool.define({
  id: "opencode.example",
  description: "Example tool",
  parameters: z.object({
    foo: z.string().describe("The foo parameter"),
    bar: z.number().describe("The bar parameter"),
  }),
  async execute(params) {
    return {
      metadata: {
        lol: "hey",
      },
      output: "Hello, world!",
    }
  },
})
