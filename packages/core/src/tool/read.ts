import z from "zod/v4"
import * as fs from "fs"
import * as path from "path"
import { Tool } from "./tool"
import { LSP } from "../lsp"
import { FileTime } from "../file/time"
import DESCRIPTION from "./read.txt"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import { Provider } from "../provider/provider"
import { Identifier } from "../id/id"

const DEFAULT_READ_LIMIT = 2000
const MAX_LINE_LENGTH = 2000

// Dynamic thresholds based on model context window
// Assumes ~4 tokens per line of code on average
const TOKENS_PER_LINE = 4
const LARGE_FILE_CONTEXT_RATIO = 0.25 // Warn if file would use >25% of context
const VERY_LARGE_FILE_CONTEXT_RATIO = 0.50 // Block if file would use >50% of context

// Fallback values for when model info is unavailable (based on 200k context)
const FALLBACK_LARGE_FILE_THRESHOLD = 12500 // 25% of 200k / 4
const FALLBACK_VERY_LARGE_FILE_THRESHOLD = 25000 // 50% of 200k / 4

function calculateFileThresholds(contextLimit: number | undefined): { large: number; veryLarge: number } {
  if (!contextLimit || contextLimit === 0) {
    return {
      large: FALLBACK_LARGE_FILE_THRESHOLD,
      veryLarge: FALLBACK_VERY_LARGE_FILE_THRESHOLD,
    }
  }
  return {
    large: Math.floor(contextLimit * LARGE_FILE_CONTEXT_RATIO / TOKENS_PER_LINE),
    veryLarge: Math.floor(contextLimit * VERY_LARGE_FILE_CONTEXT_RATIO / TOKENS_PER_LINE),
  }
}

export const ReadTool = Tool.define("read", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to read"),
    offset: z.coerce.number().describe("The line number to start reading from (0-based)").optional(),
    limit: z.coerce.number().describe("The number of lines to read (defaults to 2000)").optional(),
  }),
  async execute(params, ctx) {
    let filepath = params.filePath
    if (!path.isAbsolute(filepath)) {
      filepath = path.join(process.cwd(), filepath)
    }
    const title = path.relative(Instance.worktree, filepath)

    if (!ctx.extra?.["bypassCwdCheck"] && !Filesystem.contains(Instance.directory, filepath)) {
      throw new Error(`File ${filepath} is not in the current working directory`)
    }

    const file = Bun.file(filepath)
    if (!(await file.exists())) {
      const dir = path.dirname(filepath)
      const base = path.basename(filepath)

      const dirEntries = fs.readdirSync(dir)
      const suggestions = dirEntries
        .filter(
          (entry) =>
            entry.toLowerCase().includes(base.toLowerCase()) || base.toLowerCase().includes(entry.toLowerCase()),
        )
        .map((entry) => path.join(dir, entry))
        .slice(0, 3)

      if (suggestions.length > 0) {
        throw new Error(`File not found: ${filepath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`)
      }

      throw new Error(`File not found: ${filepath}`)
    }

    const isImage = isImageFile(filepath)
    const supportsImages = await (async () => {
      if (!ctx.extra?.["providerID"] || !ctx.extra?.["modelID"]) return false
      const providerID = ctx.extra["providerID"] as string
      const modelID = ctx.extra["modelID"] as string
      const model = await Provider.getModel(providerID, modelID).catch(() => undefined)
      if (!model) return false
      return model.info.modalities?.input?.includes("image") ?? false
    })()
    if (isImage) {
      if (!supportsImages) {
        throw new Error(`Failed to read image: ${filepath}, model may not be able to read images`)
      }
      const mime = file.type
      const msg = "Image read successfully"
      return {
        title,
        output: msg,
        metadata: {
          preview: msg,
        },
        attachments: [
          {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "file",
            mime,
            url: `data:${mime};base64,${Buffer.from(await file.bytes()).toString("base64")}`,
          },
        ],
      }
    }

    const isBinary = await isBinaryFile(filepath, file)
    if (isBinary) throw new Error(`Cannot read binary file: ${filepath}`)

    // Get model context limit for dynamic thresholds
    const contextLimit = await (async () => {
      if (!ctx.extra?.["providerID"] || !ctx.extra?.["modelID"]) return undefined
      const providerID = ctx.extra["providerID"] as string
      const modelID = ctx.extra["modelID"] as string
      const model = await Provider.getModel(providerID, modelID).catch(() => undefined)
      return model?.info.limit.context
    })()
    const thresholds = calculateFileThresholds(contextLimit)

    const limit = params.limit ?? DEFAULT_READ_LIMIT
    const offset = params.offset || 0
    const lines = await file.text().then((text) => text.split("\n"))
    const totalLines = lines.length

    // Check if file is very large and user is trying to read too much
    if (totalLines > thresholds.veryLarge && !params.offset && !params.limit) {
      const fileSizeKB = Math.round((await file.size) / 1024)
      const contextInfo = contextLimit ? ` (model context: ${contextLimit.toLocaleString()} tokens)` : ""
      throw new Error(
        `File is too large to read entirely (${totalLines.toLocaleString()} lines, ${fileSizeKB}KB)${contextInfo}.\n\n` +
        `To work with this file, use one of these approaches:\n` +
        `1. Use Grep tool to search for specific content: grep "pattern" ${filepath}\n` +
        `2. Read in chunks with offset/limit: read ${filepath} --offset 0 --limit 500\n` +
        `3. Read just the beginning to understand structure: read ${filepath} --limit 200\n\n` +
        `This prevents context overflow and keeps the conversation responsive.`
      )
    }
    const raw = lines.slice(offset, offset + limit).map((line) => {
      return line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + "..." : line
    })
    const content = raw.map((line, index) => {
      return `${(index + offset + 1).toString().padStart(5, "0")}| ${line}`
    })
    const preview = raw.slice(0, 20).join("\n")

    let output = ""

    // Add warning for large files (dynamic based on model context)
    if (totalLines > thresholds.large) {
      const contextInfo = contextLimit ? ` (~${Math.round(totalLines * TOKENS_PER_LINE / 1000)}k of ${Math.round(contextLimit / 1000)}k tokens)` : ""
      output += `<system-reminder>\n`
      output += `⚠️ LARGE FILE WARNING: This file has ${totalLines.toLocaleString()} lines${contextInfo}. `
      output += `Reading large files consumes significant context. Consider:\n`
      output += `- Using Grep to search for specific patterns instead of reading everything\n`
      output += `- Reading only the sections you need with offset/limit parameters\n`
      output += `- Summarizing what you learned before reading more\n`
      output += `</system-reminder>\n\n`
    }

    output += "<file>\n"
    output += content.join("\n")

    if (totalLines > offset + content.length) {
      output += `\n\n(File has ${totalLines.toLocaleString()} total lines. Showing lines ${offset + 1}-${offset + content.length}. `
      output += `Use 'offset' parameter to read beyond line ${offset + content.length})`
    }
    output += "\n</file>"

    // just warms the lsp client
    LSP.touchFile(filepath, false)
    FileTime.read(ctx.sessionID, filepath)

    return {
      title,
      output,
      metadata: {
        preview,
      },
    }
  },
})

function isImageFile(filePath: string): string | false {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "JPEG"
    case ".png":
      return "PNG"
    case ".gif":
      return "GIF"
    case ".bmp":
      return "BMP"
    case ".webp":
      return "WebP"
    default:
      return false
  }
}

async function isBinaryFile(filepath: string, file: Bun.BunFile): Promise<boolean> {
  const ext = path.extname(filepath).toLowerCase()
  // binary check for common non-text extensions
  switch (ext) {
    case ".zip":
    case ".tar":
    case ".gz":
    case ".exe":
    case ".dll":
    case ".so":
    case ".class":
    case ".jar":
    case ".war":
    case ".7z":
    case ".doc":
    case ".docx":
    case ".xls":
    case ".xlsx":
    case ".ppt":
    case ".pptx":
    case ".odt":
    case ".ods":
    case ".odp":
    case ".bin":
    case ".dat":
    case ".obj":
    case ".o":
    case ".a":
    case ".lib":
    case ".wasm":
    case ".pyc":
    case ".pyo":
      return true
    default:
      break
  }

  const stat = await file.stat()
  const fileSize = stat.size
  if (fileSize === 0) return false

  const bufferSize = Math.min(4096, fileSize)
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength === 0) return false
  const bytes = new Uint8Array(buffer.slice(0, bufferSize))

  let nonPrintableCount = 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return true
    if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
      nonPrintableCount++
    }
  }
  // If >30% non-printable characters, consider it binary
  return nonPrintableCount / bytes.length > 0.3
}
