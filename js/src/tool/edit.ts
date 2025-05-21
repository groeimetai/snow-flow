import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { Log } from "../util/log";
import { Tool } from "./tool";
import { FileTimes } from "./util/file-times";
import { LSP } from "../lsp";

const log = Log.create({ service: "tool.edit" });

// Simple diff generation
function generateDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
): {
  diff: string;
  additions: number;
  removals: number;
} {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  let diff = `--- ${filePath}\n+++ ${filePath}\n`;
  let additions = 0;
  let removals = 0;

  // Very simple diff implementation - in a real implementation, you'd use a proper diff algorithm
  if (oldContent === "") {
    // New file
    diff += "@@ -0,0 +1," + newLines.length + " @@\n";
    for (const line of newLines) {
      diff += "+" + line + "\n";
      additions++;
    }
  } else if (newContent === "") {
    // Deleted content
    diff += "@@ -1," + oldLines.length + " +0,0 @@\n";
    for (const line of oldLines) {
      diff += "-" + line + "\n";
      removals++;
    }
  } else {
    // Modified content
    diff += "@@ -1," + oldLines.length + " +1," + newLines.length + " @@\n";

    // This is a very simplified diff - a real implementation would use a proper diff algorithm
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
      if (i < oldLines.length && i < newLines.length) {
        if (oldLines[i] !== newLines[i]) {
          diff += "-" + oldLines[i] + "\n";
          diff += "+" + newLines[i] + "\n";
          removals++;
          additions++;
        } else {
          diff += " " + oldLines[i] + "\n";
        }
      } else if (i < oldLines.length) {
        diff += "-" + oldLines[i] + "\n";
        removals++;
      } else if (i < newLines.length) {
        diff += "+" + newLines[i] + "\n";
        additions++;
      }
    }
  }

  return { diff, additions, removals };
}

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

Remember: when making multiple file edits in a row to the same file, you should prefer to send all edits in a single message with multiple calls to this tool, rather than multiple messages with a single call each.`;

export const EditTool = Tool.define({
  name: "edit",
  description: DESCRIPTION,
  parameters: z.object({
    file_path: z.string().describe("The absolute path to the file to modify"),
    old_string: z.string().describe("The text to replace"),
    new_string: z.string().describe("The text to replace it with"),
  }),
  async execute(params) {
    if (!params.file_path) {
      throw new Error("file_path is required");
    }

    let filePath = params.file_path;
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath);
    }

    await (async () => {
      if (params.old_string === "") {
        await createNewFile(filePath, params.new_string);
        return;
      }

      const read = FileTimes.get(filePath);
      if (!read)
        throw new Error(
          `You must read the file ${filePath} before editing it. Use the View tool first`,
        );
      const file = Bun.file(filePath);
      if (!(await file.exists())) throw new Error(`File ${filePath} not found`);
      const stats = await file.stat();
      if (stats.isDirectory())
        throw new Error(`Path is a directory, not a file: ${filePath}`);
      if (stats.mtime.getTime() > read.getTime())
        throw new Error(
          `File ${filePath} has been modified since it was last read.\nLast modification: ${read.toISOString()}\nLast read: ${stats.mtime.toISOString()}\n\nPlease read the file again before modifying it.`,
        );

      const content = await file.text();
      const index = content.indexOf(params.old_string);
      if (index === -1)
        throw new Error(
          `old_string not found in file. Make sure it matches exactly, including whitespace and line breaks`,
        );
      const lastIndex = content.lastIndexOf(params.old_string);
      if (index !== lastIndex)
        throw new Error(
          `old_string appears multiple times in the file. Please provide more context to ensure a unique match`,
        );

      const newContent =
        content.substring(0, index) +
        params.new_string +
        content.substring(index + params.old_string.length);

      console.log(newContent);
      await file.write(newContent);
    })();

    FileTimes.write(filePath);
    FileTimes.read(filePath);

    let output = "";
    await LSP.run((client) => client.refreshDiagnostics({ path: filePath }));
    const diagnostics = await LSP.run(async (client) => client.diagnostics);
    for (const diagnostic of diagnostics) {
      for (const [file, params] of diagnostic.entries()) {
        if (params.length === 0) continue;
        if (file === filePath) {
          output += `\nThis file has errors, please fix\n<file_diagnostics>\n${JSON.stringify(params)}\n</file_diagnostics>\n`;
          continue;
        }
        output += `\n<project_diagnostics>\n${JSON.stringify(params)}\n</project_diagnostics>\n`;
      }
    }
    console.log(output);

    return {
      output,
    };
  },
});

async function createNewFile(
  filePath: string,
  content: string,
): Promise<string> {
  try {
    try {
      const fileStats = fs.statSync(filePath);
      if (fileStats.isDirectory()) {
        throw new Error(`Path is a directory, not a file: ${filePath}`);
      }
      throw new Error(`File already exists: ${filePath}`);
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }

    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    const { diff, additions, removals } = generateDiff("", content, filePath);

    fs.writeFileSync(filePath, content);

    FileTimes.write(filePath);
    FileTimes.read(filePath);

    return `File created: ${filePath}`;
  } catch (err: any) {
    throw new Error(`Failed to create file: ${err.message}`);
  }
}

function getFile(filePath: string) {}
