import { z } from "zod";
import { Tool } from "./tool";
import { App } from "../app/app";

const DESCRIPTION = `Fast file pattern matching tool that finds files by name and pattern, returning matching paths sorted by modification time (newest first).

WHEN TO USE THIS TOOL:
- Use when you need to find files by name patterns or extensions
- Great for finding specific file types across a directory structure
- Useful for discovering files that match certain naming conventions

HOW TO USE:
- Provide a glob pattern to match against file paths
- Optionally specify a starting directory (defaults to current working directory)
- Results are sorted with most recently modified files first

GLOB PATTERN SYNTAX:
- '*' matches any sequence of non-separator characters
- '**' matches any sequence of characters, including separators
- '?' matches any single non-separator character
- '[...]' matches any character in the brackets
- '[!...]' matches any character not in the brackets

COMMON PATTERN EXAMPLES:
- '*.js' - Find all JavaScript files in the current directory
- '**/*.js' - Find all JavaScript files in any subdirectory
- 'src/**/*.{ts,tsx}' - Find all TypeScript files in the src directory
- '*.{html,css,js}' - Find all HTML, CSS, and JS files

LIMITATIONS:
- Results are limited to 100 files (newest first)
- Does not search file contents (use Grep tool for that)
- Hidden files (starting with '.') are skipped

TIPS:
- For the most useful results, combine with the Grep tool: first find files with Glob, then search their contents with Grep
- When doing iterative exploration that may require multiple rounds of searching, consider using the Agent tool instead
- Always check if results are truncated and refine your search pattern if needed`;

export const glob = Tool.define({
  name: "opencode.glob",
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The glob pattern to match files against"),
    path: z
      .string()
      .describe(
        "The directory to search in. Defaults to the current working directory.",
      )
      .optional(),
  }),
  async execute(params) {
    const app = await App.use();
    const search = params.path || app.root;
    const limit = 100;
    const glob = new Bun.Glob(params.pattern);
    const files = [];
    let truncated = false;
    for await (const file of glob.scan({ cwd: search })) {
      if (files.length >= limit) {
        truncated = true;
        break;
      }
      const stats = await Bun.file(file)
        .stat()
        .then((x) => x.mtime.getTime())
        .catch(() => 0);
      files.push({
        path: file,
        mtime: stats,
      });
    }
    files.sort((a, b) => b.mtime - a.mtime);

    const output = [];
    if (files.length === 0) output.push("No files found");
    if (files.length > 0) {
      output.push(...files.map((f) => f.path));
      if (truncated) {
        output.push("");
        output.push(
          "(Results are truncated. Consider using a more specific path or pattern.)",
        );
      }
    }

    return {
      metadata: {
        count: files.length,
        truncated,
      },
      output: output.join("\n"),
    };
  },
});

