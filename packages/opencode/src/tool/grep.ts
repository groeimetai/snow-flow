import { z } from "zod"
import { Tool } from "./tool"
import { App } from "../app/app"
import { spawn } from "child_process"
import { promises as fs } from "fs"
import path from "path"

const DESCRIPTION = `Fast content search tool that finds files containing specific text or patterns, returning matching file paths sorted by modification time (newest first).

WHEN TO USE THIS TOOL:
- Use when you need to find files containing specific text or patterns
- Great for searching code bases for function names, variable declarations, or error messages
- Useful for finding all files that use a particular API or pattern

HOW TO USE:
- Provide a regex pattern to search for within file contents
- Set literal_text=true if you want to search for the exact text with special characters (recommended for non-regex users)
- Optionally specify a starting directory (defaults to current working directory)
- Optionally provide an include pattern to filter which files to search
- Results are sorted with most recently modified files first

REGEX PATTERN SYNTAX (when literal_text=false):
- Supports standard regular expression syntax
- 'function' searches for the literal text "function"
- 'log\\..*Error' finds text starting with "log." and ending with "Error"
- 'import\\s+.*\\s+from' finds import statements in JavaScript/TypeScript

COMMON INCLUDE PATTERN EXAMPLES:
- '*.js' - Only search JavaScript files
- '*.{ts,tsx}' - Only search TypeScript files
- '*.go' - Only search Go files

LIMITATIONS:
- Results are limited to 100 files (newest first)
- Performance depends on the number of files being searched
- Very large binary files may be skipped
- Hidden files (starting with '.') are skipped

TIPS:
- For faster, more targeted searches, first use Glob to find relevant files, then use Grep
- When doing iterative exploration that may require multiple rounds of searching, consider using the Agent tool instead
- Always check if results are truncated and refine your search pattern if needed
- Use literal_text=true when searching for exact text containing special characters like dots, parentheses, etc.`

interface GrepMatch {
  path: string
  modTime: number
  lineNum: number
  lineText: string
}

function escapeRegexPattern(pattern: string): string {
  const specialChars = [
    "\\",
    ".",
    "+",
    "*",
    "?",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    "^",
    "$",
    "|",
  ]
  let escaped = pattern

  for (const char of specialChars) {
    escaped = escaped.replaceAll(char, "\\" + char)
  }

  return escaped
}

function globToRegex(glob: string): string {
  let regexPattern = glob.replaceAll(".", "\\.")
  regexPattern = regexPattern.replaceAll("*", ".*")
  regexPattern = regexPattern.replaceAll("?", ".")

  // Handle {a,b,c} patterns
  regexPattern = regexPattern.replace(/\{([^}]+)\}/g, (_, inner) => {
    return "(" + inner.replace(/,/g, "|") + ")"
  })

  return regexPattern
}

async function searchWithRipgrep(
  pattern: string,
  searchPath: string,
  include?: string,
): Promise<GrepMatch[]> {
  return new Promise((resolve, reject) => {
    const args = ["-n", pattern]
    if (include) {
      args.push("--glob", include)
    }
    args.push(searchPath)

    const rg = spawn("rg", args)
    let output = ""
    let errorOutput = ""

    rg.stdout.on("data", (data) => {
      output += data.toString()
    })

    rg.stderr.on("data", (data) => {
      errorOutput += data.toString()
    })

    rg.on("close", async (code) => {
      if (code === 1) {
        // No matches found
        resolve([])
        return
      }

      if (code !== 0) {
        reject(new Error(`ripgrep failed: ${errorOutput}`))
        return
      }

      const lines = output.trim().split("\n")
      const matches: GrepMatch[] = []

      for (const line of lines) {
        if (!line) continue

        // Parse ripgrep output format: file:line:content
        const parts = line.split(":", 3)
        if (parts.length < 3) continue

        const filePath = parts[0]
        const lineNum = parseInt(parts[1], 10)
        const lineText = parts[2]

        try {
          const stats = await fs.stat(filePath)
          matches.push({
            path: filePath,
            modTime: stats.mtime.getTime(),
            lineNum,
            lineText,
          })
        } catch {
          // Skip files we can't access
          continue
        }
      }

      resolve(matches)
    })

    rg.on("error", (err) => {
      reject(err)
    })
  })
}

async function searchFilesWithRegex(
  pattern: string,
  rootPath: string,
  include?: string,
): Promise<GrepMatch[]> {
  const matches: GrepMatch[] = []
  const regex = new RegExp(pattern)

  let includePattern: RegExp | undefined
  if (include) {
    const regexPattern = globToRegex(include)
    includePattern = new RegExp(regexPattern)
  }

  async function walkDir(dir: string) {
    if (matches.length >= 200) return

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (matches.length >= 200) break

        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          // Skip hidden directories
          if (entry.name.startsWith(".")) continue
          await walkDir(fullPath)
        } else if (entry.isFile()) {
          // Skip hidden files
          if (entry.name.startsWith(".")) continue

          if (includePattern && !includePattern.test(fullPath)) {
            continue
          }

          try {
            const content = await fs.readFile(fullPath, "utf-8")
            const lines = content.split("\n")

            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                const stats = await fs.stat(fullPath)
                matches.push({
                  path: fullPath,
                  modTime: stats.mtime.getTime(),
                  lineNum: i + 1,
                  lineText: lines[i],
                })
                break // Only first match per file
              }
            }
          } catch {
            // Skip files we can't read
            continue
          }
        }
      }
    } catch {
      // Skip directories we can't read
      return
    }
  }

  await walkDir(rootPath)
  return matches
}

async function searchFiles(
  pattern: string,
  rootPath: string,
  include?: string,
  limit: number = 100,
): Promise<{ matches: GrepMatch[]; truncated: boolean }> {
  let matches: GrepMatch[]

  try {
    matches = await searchWithRipgrep(pattern, rootPath, include)
  } catch {
    matches = await searchFilesWithRegex(pattern, rootPath, include)
  }

  // Sort by modification time (newest first)
  matches.sort((a, b) => b.modTime - a.modTime)

  const truncated = matches.length > limit
  if (truncated) {
    matches = matches.slice(0, limit)
  }

  return { matches, truncated }
}

export const GrepTool = Tool.define({
  id: "opencode.grep",
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z
      .string()
      .describe("The regex pattern to search for in file contents"),
    path: z
      .string()
      .describe(
        "The directory to search in. Defaults to the current working directory.",
      )
      .optional(),
    include: z
      .string()
      .describe(
        'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")',
      )
      .optional(),
    literalText: z
      .boolean()
      .describe(
        "If true, the pattern will be treated as literal text with special regex characters escaped. Default is false.",
      )
      .optional(),
  }),
  async execute(params) {
    if (!params.pattern) {
      throw new Error("pattern is required")
    }

    const app = App.info()
    const searchPath = params.path || app.path.cwd

    // If literalText is true, escape the pattern
    const searchPattern = params.literalText
      ? escapeRegexPattern(params.pattern)
      : params.pattern

    const { matches, truncated } = await searchFiles(
      searchPattern,
      searchPath,
      params.include,
      100,
    )

    if (matches.length === 0) {
      return {
        metadata: { matches: 0, truncated },
        output: "No files found",
      }
    }

    const lines = [`Found ${matches.length} matches`]

    let currentFile = ""
    for (const match of matches) {
      if (currentFile !== match.path) {
        if (currentFile !== "") {
          lines.push("")
        }
        currentFile = match.path
        lines.push(`${match.path}:`)
      }
      if (match.lineNum > 0) {
        lines.push(`  Line ${match.lineNum}: ${match.lineText}`)
      } else {
        lines.push(`  ${match.path}`)
      }
    }

    if (truncated) {
      lines.push("")
      lines.push(
        "(Results are truncated. Consider using a more specific path or pattern.)",
      )
    }

    return {
      metadata: {
        matches: matches.length,
        truncated,
      },
      output: lines.join("\n"),
    }
  },
})
