import { z } from "zod"
import * as path from "path"
import { Tool } from "./tool"
import { FileTimes } from "./util/file-times"
import { LSP } from "../lsp"
import { createTwoFilesPatch, diffLines } from "diff"
import { Permission } from "../permission"
import DESCRIPTION from "./edit.txt"

export const EditTool = Tool.define({
  id: "opencode.edit",
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The absolute path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z
      .string()
      .describe(
        "The text to replace it with (must be different from old_string)",
      ),
    replaceAll: z
      .boolean()
      .default(false)
      .describe("Replace all occurences of old_string (default false)"),
  }),
  async execute(params, ctx) {
    if (!params.filePath) {
      throw new Error("filePath is required")
    }

    const filepath = path.isAbsolute(params.filePath)
      ? params.filePath
      : path.join(process.cwd(), params.filePath)

    await Permission.ask({
      id: "opencode.edit",
      sessionID: ctx.sessionID,
      title: "Edit this file: " + filepath,
      metadata: {
        filePath: filepath,
        oldString: params.oldString,
        newString: params.newString,
      },
    })

    let contentOld = ""
    let contentNew = ""
    await (async () => {
      if (params.oldString === "") {
        contentNew = params.newString
        await Bun.write(filepath, params.newString)
        return
      }

      const read = FileTimes.get(ctx.sessionID, filepath)
      if (!read)
        throw new Error(
          `You must read the file ${filepath} before editing it. Use the View tool first`,
        )
      const file = Bun.file(filepath)
      if (!(await file.exists())) throw new Error(`File ${filepath} not found`)
      const stats = await file.stat()
      if (stats.isDirectory())
        throw new Error(`Path is a directory, not a file: ${filepath}`)
      if (stats.mtime.getTime() > read.getTime())
        throw new Error(
          `File ${filepath} has been modified since it was last read.\nLast modification: ${read.toISOString()}\nLast read: ${stats.mtime.toISOString()}\n\nPlease read the file again before modifying it.`,
        )

      contentOld = await file.text()
      const index = contentOld.indexOf(params.oldString)
      if (index === -1)
        throw new Error(
          `oldString not found in file. Make sure it matches exactly, including whitespace and line breaks`,
        )

      if (params.replaceAll) {
        contentNew = contentOld.replaceAll(params.oldString, params.newString)
      }

      if (!params.replaceAll) {
        const lastIndex = contentOld.lastIndexOf(params.oldString)
        if (index !== lastIndex)
          throw new Error(
            `oldString appears multiple times in the file. Please provide more context to ensure a unique match`,
          )

        contentNew =
          contentOld.substring(0, index) +
          params.newString +
          contentOld.substring(index + params.oldString.length)
      }

      await file.write(contentNew)
    })()

    const changes = diffLines(contentOld, contentNew)
    const diff = createTwoFilesPatch(filepath, filepath, contentOld, contentNew)

    FileTimes.read(ctx.sessionID, filepath)

    let output = ""
    await LSP.file(filepath)
    const diagnostics = await LSP.diagnostics()
    for (const [file, issues] of Object.entries(diagnostics)) {
      if (issues.length === 0) continue
      if (file === filepath) {
        output += `\nThis file has errors, please fix\n<file_diagnostics>\n${issues.map(LSP.Diagnostic.pretty).join("\n")}\n</file_diagnostics>\n`
        continue
      }
      output += `\n<project_diagnostics>\n${file}\n${issues.map(LSP.Diagnostic.pretty).join("\n")}\n</project_diagnostics>\n`
    }

    return {
      metadata: {
        diagnostics,
        changes,
        diff,
      },
      output,
    }
  },
})
