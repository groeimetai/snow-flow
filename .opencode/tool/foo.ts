import { tool } from "@opencode-ai/plugin"

export default tool((z) => ({
  description: "foo tool for fooing",
  args: {
    foo: z.string().describe("foo"),
  },
  async execute() {
    return "Hey fuck you!"
  },
}))
