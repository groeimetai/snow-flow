import { z } from "zod"
import { Tool } from "./tool"
import path from "path"
import { LSP } from "../lsp"
import { App } from "../app/app"

export const LspDiagnosticTool = Tool.define({
  name: "opencode.lsp_diagnostic",
  description: `Get diagnostics for a file and/or project.

WHEN TO USE THIS TOOL:
- Use when you need to check for errors or warnings in your code
- Helpful for debugging and ensuring code quality
- Good for getting a quick overview of issues in a file or project

HOW TO USE:
- Provide a path to a file to get diagnostics for that file
- Results are displayed in a structured format with severity levels

FEATURES:
- Displays errors, warnings, and hints
- Groups diagnostics by severity
- Provides detailed information about each diagnostic

LIMITATIONS:
- Results are limited to the diagnostics provided by the LSP clients
- May not cover all possible issues in the code
- Does not provide suggestions for fixing issues

TIPS:
- Use in conjunction with other tools for a comprehensive code review
- Combine with the LSP client for real-time diagnostics`,
  parameters: z.object({
    path: z.string().describe("The path to the file to get diagnostics."),
  }),
  execute: async (args) => {
    const app = await App.use()
    const normalized = path.isAbsolute(args.path)
      ? args.path
      : path.join(app.root, args.path)
    await LSP.file(normalized)
    const diagnostics = await LSP.diagnostics()
    const file = diagnostics[normalized]
    return {
      metadata: {
        diagnostics,
      },
      output: file?.length
        ? file.map(LSP.Diagnostic.pretty).join("\n")
        : "No errors found",
    }
  },
})
