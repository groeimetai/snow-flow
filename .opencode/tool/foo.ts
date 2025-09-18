import z from "zod/v4"

export default {
  description: "foo tool for fooing",
  args: {
    foo: z.string().describe("foo"),
  },
  async execute() {
    return "Hey fuck you!"
  },
}
