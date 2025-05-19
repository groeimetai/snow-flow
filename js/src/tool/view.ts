import { z } from "zod";
import { tool } from "./tool";
import * as fs from "fs";
import * as path from "path";

const MAX_READ_SIZE = 250 * 1024;
const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;

const DESCRIPTION = `File viewing tool that reads and displays the contents of files with line numbers, allowing you to examine code, logs, or text data.

WHEN TO USE THIS TOOL:
- Use when you need to read the contents of a specific file
- Helpful for examining source code, configuration files, or log files
- Perfect for looking at text-based file formats

HOW TO USE:
- Provide the path to the file you want to view
- Optionally specify an offset to start reading from a specific line
- Optionally specify a limit to control how many lines are read

FEATURES:
- Displays file contents with line numbers for easy reference
- Can read from any position in a file using the offset parameter
- Handles large files by limiting the number of lines read
- Automatically truncates very long lines for better display
- Suggests similar file names when the requested file isn't found

LIMITATIONS:
- Maximum file size is 250KB
- Default reading limit is 2000 lines
- Lines longer than 2000 characters are truncated
- Cannot display binary files or images
- Images can be identified but not displayed

TIPS:
- Use with Glob tool to first find files you want to view
- For code exploration, first use Grep to find relevant files, then View to examine them
- When viewing large files, use the offset parameter to read specific sections`;

export const ViewTool = tool({
  name: "view",
  description: DESCRIPTION,
  parameters: z.object({
    file_path: z.string().describe("The path to the file to read"),
    offset: z
      .number()
      .describe("The line number to start reading from (0-based)")
      .optional(),
    limit: z
      .number()
      .describe("The number of lines to read (defaults to 2000)")
      .optional(),
  }),
  async execute(params) {
    let filePath = params.file_path;
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath);
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      const dir = path.dirname(filePath);
      const base = path.basename(filePath);

      const dirEntries = fs.readdirSync(dir);
      const suggestions = dirEntries
        .filter(
          (entry) =>
            entry.toLowerCase().includes(base.toLowerCase()) ||
            base.toLowerCase().includes(entry.toLowerCase()),
        )
        .map((entry) => path.join(dir, entry))
        .slice(0, 3);

      if (suggestions.length > 0) {
        throw new Error(
          `File not found: ${filePath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`,
        );
      }

      throw new Error(`File not found: ${filePath}`);
    }
    const stats = await file.stat();
    if (stats.isDirectory())
      throw new Error(`Path is a directory, not a file: ${filePath}`);

    if (stats.size > MAX_READ_SIZE) {
      throw new Error(
        `File is too large (${stats.size} bytes). Maximum size is ${MAX_READ_SIZE} bytes`,
      );
    }
    const limit = params.limit ?? DEFAULT_READ_LIMIT;
    const offset = params.offset || 0;
    const isImage = isImageFile(filePath);
    if (isImage) {
      throw new Error(
        `This is an image file of type: ${isImage}\nUse a different tool to process images`,
      );
    }
    const lines = await file.text().then((text) => text.split("\n"));
    const content = lines.slice(offset, offset + limit).map((line, index) => {
      line =
        line.length > MAX_LINE_LENGTH
          ? line.substring(0, MAX_LINE_LENGTH) + "..."
          : line;
      return `${index + offset + 1}|${line}`;
    });

    let output = "<file>\n";
    output += content.join("\n");

    if (lines.length > offset + content.length) {
      output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${
        offset + content.length
      })`;
    }
    output += "\n</file>";

    return output;
  },
});

function addLineNumbers(content: string, startLine: number): string {
  if (!content) {
    return "";
  }

  const lines = content.split("\n");

  return lines
    .map((line, i) => {
      const lineNum = i + startLine;
      const numStr = lineNum.toString();

      if (numStr.length >= 6) {
        return `${numStr}|${line}`;
      } else {
        const paddedNum = numStr.padStart(6, " ");
        return `${paddedNum}|${line}`;
      }
    })
    .join("\n");
}

function readTextFile(
  filePath: string,
  offset: number,
  limit: number,
): { content: string; lineCount: number } {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const allLines = fileContent.split("\n");
  let lineCount = allLines.length;

  // Get the lines we want based on offset and limit
  const selectedLines = allLines
    .slice(offset, offset + limit)
    .map((line) =>
      line.length > MAX_LINE_LENGTH
        ? line.substring(0, MAX_LINE_LENGTH) + "..."
        : line,
    );

  return {
    content: selectedLines.join("\n"),
    lineCount,
  };
}

function isImageFile(filePath: string): string | false {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "JPEG";
    case ".png":
      return "PNG";
    case ".gif":
      return "GIF";
    case ".bmp":
      return "BMP";
    case ".svg":
      return "SVG";
    case ".webp":
      return "WebP";
    default:
      return false;
  }
}

