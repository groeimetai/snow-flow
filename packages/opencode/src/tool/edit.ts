import { z } from "zod"
import * as path from "path"
import { Tool } from "./tool"
import { FileTimes } from "./util/file-times"
import { LSP } from "../lsp"

const DESCRIPTION = `Edits files by replacing text, creating new files, or deleting content. For moving or renaming files, use the Bash tool with the 'mv' command instead. For larger file edits, use the FileWrite tool to overwrite files.

Before using this tool:

1. Use the FileRead tool to understand the file's contents and context

2. Verify the directory path is correct (only applicable when creating new files):
   - Use the LS tool to verify the parent directory exists and is the correct location

To make a file edit, provide the following:
1. file_path: The relative path to the file to modify (must be relative, not absolute)
2. old_string: The text to replace (must be unique within the file, and must match the file contents exactly, including all whitespace and indentation)
3. new_string: The edited text to replace the old_string

Special cases:
- To create a new file: provide file_path and new_string, leave old_string empty
- To delete content: provide file_path and old_string, leave new_string empty

The tool will replace ONE occurrence of old_string with new_string in the specified file.

CRITICAL REQUIREMENTS FOR USING THIS TOOL:

1. UNIQUENESS: The old_string MUST uniquely identify the specific instance you want to change. This means:
   - Include AT LEAST 3-5 lines of context BEFORE the change point
   - Include AT LEAST 3-5 lines of context AFTER the change point
   - Include all whitespace, indentation, and surrounding code exactly as it appears in the file

2. SINGLE INSTANCE: This tool can only change ONE instance at a time. If you need to change multiple instances:
   - Make separate calls to this tool for each instance
   - Each call must uniquely identify its specific instance using extensive context

3. VERIFICATION: Before using this tool:
   - Check how many instances of the target text exist in the file
   - If multiple instances exist, gather enough context to uniquely identify each one
   - Plan separate tool calls for each instance

WARNING: If you do not follow these requirements:
   - The tool will fail if old_string matches multiple locations
   - The tool will fail if old_string doesn't match exactly (including whitespace)
   - You may change the wrong instance if you don't include enough context

When making edits:
   - Ensure the edit results in idiomatic, correct code
   - Do not leave the code in a broken state
   - Always use relative file paths 

Remember: when making multiple file edits in a row to the same file, you should prefer to send all edits in a single message with multiple calls to this tool, rather than multiple messages with a single call each.`

export const EditTool = Tool.define({
  id: "opencode.edit",
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The absolute path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z.string().describe("The text to replace it with"),
  }),
  async execute(params) {
    if (!params.filePath) {
      throw new Error("filePath is required")
    }

    let filePath = params.filePath
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath)
    }

    await (async () => {
      if (params.oldString === "") {
        await Bun.write(filePath, params.newString)
        return
      }

      const read = FileTimes.get(filePath)
      if (!read)
        throw new Error(
          `You must read the file ${filePath} before editing it. Use the View tool first`,
        )
      const file = Bun.file(filePath)
      if (!(await file.exists())) throw new Error(`File ${filePath} not found`)
      const stats = await file.stat()
      if (stats.isDirectory())
        throw new Error(`Path is a directory, not a file: ${filePath}`)
      if (stats.mtime.getTime() > read.getTime())
        throw new Error(
          `File ${filePath} has been modified since it was last read.\nLast modification: ${read.toISOString()}\nLast read: ${stats.mtime.toISOString()}\n\nPlease read the file again before modifying it.`,
        )

      const content = await file.text()
      const index = content.indexOf(params.oldString)
      if (index === -1)
        throw new Error(
          `oldString not found in file. Make sure it matches exactly, including whitespace and line breaks`,
        )
      const lastIndex = content.lastIndexOf(params.oldString)
      if (index !== lastIndex)
        throw new Error(
          `oldString appears multiple times in the file. Please provide more context to ensure a unique match`,
        )

      const newContent =
        content.substring(0, index) +
        params.newString +
        content.substring(index + params.oldString.length)

      await file.write(newContent)
    })()

    FileTimes.write(filePath)
    FileTimes.read(filePath)

    let output = ""
    await LSP.file(filePath)
    const diagnostics = await LSP.diagnostics()
    for (const [file, issues] of Object.entries(diagnostics)) {
      if (issues.length === 0) continue
      if (file === filePath) {
        output += `\nThis file has errors, please fix\n<file_diagnostics>\n${issues.map(LSP.Diagnostic.pretty).join("\n")}\n</file_diagnostics>\n`
        continue
      }
      output += `\n<project_diagnostics>\n${file}\n${issues.map(LSP.Diagnostic.pretty).join("\n")}\n</project_diagnostics>\n`
    }

    return {
      metadata: {
        diagnostics,
      },
      output,
    }
  },
})
