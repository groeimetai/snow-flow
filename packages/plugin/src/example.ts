import { Plugin } from "./index"

export const ExamplePlugin: Plugin = async ({ app, client, $ }) => {
  return {
    permission: {},
    tool: {
      execute: {
        async before(input, output) {
          console.log("before", input, output)
        },
      },
    },
  }
}
