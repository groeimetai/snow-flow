import { z } from "zod"
import { Tool } from "./tool"
import path from "path"
import { LSP } from "../lsp"
import { App } from "../app/app"

export const LspHoverTool = Tool.define({
  id: "opencode.lsp_hover",
  description: `
  Looks up hover information for a given position in a source file using the Language Server Protocol (LSP). 
  This includes type information, documentation, or symbol details at the specified line and character. 
  Useful for providing code insights, explanations, or context-aware assistance based on the user's current cursor location.
  `,
  parameters: z.object({
    file: z.string().describe("The path to the file to get diagnostics."),
    line: z.number().describe("The line number to get diagnostics."),
    character: z.number().describe("The character number to get diagnostics."),
  }),
  execute: async (args) => {
    console.log(args)
    const app = await App.use()
    const file = path.isAbsolute(args.file)
      ? args.file
      : path.join(app.root, args.file)
    await LSP.file(file)
    const result = await LSP.hover({
      ...args,
      file,
    })
    console.log(result)
    return {
      metadata: {
        result,
      },
      output: JSON.stringify(result, null, 2),
    }
  },
})
