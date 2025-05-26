import { z } from "zod";
import { Tool } from "./tool";
import { App } from "../app";
import * as path from "path";
import * as fs from "fs";

const DESCRIPTION = `Directory listing tool that shows files and subdirectories in a tree structure, helping you explore and understand the project organization.

WHEN TO USE THIS TOOL:
- Use when you need to explore the structure of a directory
- Helpful for understanding the organization of a project
- Good first step when getting familiar with a new codebase

HOW TO USE:
- Provide a path to list (defaults to current working directory)
- Optionally specify glob patterns to ignore
- Results are displayed in a tree structure

FEATURES:
- Displays a hierarchical view of files and directories
- Automatically skips hidden files/directories (starting with '.')
- Skips common system directories like __pycache__
- Can filter out files matching specific patterns

LIMITATIONS:
- Results are limited to 1000 files
- Very large directories will be truncated
- Does not show file sizes or permissions
- Cannot recursively list all directories in a large project

TIPS:
- Use Glob tool for finding files by name patterns instead of browsing
- Use Grep tool for searching file contents
- Combine with other tools for more effective exploration`;

const MAX_LS_FILES = 1000;

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

export const ls = Tool.define({
  name: "ls",
  description: DESCRIPTION,
  parameters: z.object({
    path: z
      .string()
      .describe(
        "The path to the directory to list (defaults to current working directory)",
      )
      .optional(),
    ignore: z
      .array(z.string())
      .describe("List of glob patterns to ignore")
      .optional(),
  }),
  async execute(params) {
    const app = await App.use();
    let searchPath = params.path || app.root;

    if (!path.isAbsolute(searchPath)) {
      searchPath = path.join(app.root, searchPath);
    }

    try {
      await fs.promises.stat(searchPath);
    } catch (err) {
      return {
        metadata: {},
        output: `Path does not exist: ${searchPath}`,
      };
    }

    const { files, truncated } = await listDirectory(
      searchPath,
      params.ignore || [],
      MAX_LS_FILES,
    );
    const tree = createFileTree(files);
    let output = printTree(tree, searchPath);

    if (truncated) {
      output = `There are more than ${MAX_LS_FILES} files in the directory. Use a more specific path or use the Glob tool to find specific files. The first ${MAX_LS_FILES} files and directories are included below:\n\n${output}`;
    }

    return {
      metadata: {
        numberOfFiles: files.length,
        truncated,
      },
      output,
    };
  },
});

async function listDirectory(
  initialPath: string,
  ignorePatterns: string[],
  limit: number,
): Promise<{ files: string[]; truncated: boolean }> {
  const results: string[] = [];
  let truncated = false;

  async function walk(dir: string): Promise<void> {
    if (results.length >= limit) {
      truncated = true;
      return;
    }

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (shouldSkip(fullPath, ignorePatterns)) {
          continue;
        }

        if (entry.isDirectory()) {
          if (fullPath !== initialPath) {
            results.push(fullPath + path.sep);
          }

          if (results.length < limit) {
            await walk(fullPath);
          } else {
            truncated = true;
            return;
          }
        } else if (entry.isFile()) {
          if (fullPath !== initialPath) {
            results.push(fullPath);
          }

          if (results.length >= limit) {
            truncated = true;
            return;
          }
        }
      }
    } catch (err) {
      // Skip directories we don't have permission to access
    }
  }

  await walk(initialPath);
  return { files: results, truncated };
}

function shouldSkip(filePath: string, ignorePatterns: string[]): boolean {
  const base = path.basename(filePath);

  if (base !== "." && base.startsWith(".")) {
    return true;
  }

  const commonIgnored = [
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "target",
    "vendor",
    "bin",
    "obj",
    ".git",
    ".idea",
    ".vscode",
    ".DS_Store",
    "*.pyc",
    "*.pyo",
    "*.pyd",
    "*.so",
    "*.dll",
    "*.exe",
  ];

  if (filePath.includes(path.join("__pycache__", ""))) {
    return true;
  }

  for (const ignored of commonIgnored) {
    if (ignored.endsWith("/")) {
      if (filePath.includes(path.join(ignored.slice(0, -1), ""))) {
        return true;
      }
    } else if (ignored.startsWith("*.")) {
      if (base.endsWith(ignored.slice(1))) {
        return true;
      }
    } else {
      if (base === ignored) {
        return true;
      }
    }
  }

  for (const pattern of ignorePatterns) {
    try {
      const glob = new Bun.Glob(pattern);
      if (glob.match(base)) {
        return true;
      }
    } catch (err) {
      // Skip invalid patterns
    }
  }

  return false;
}

function createFileTree(sortedPaths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  const pathMap: Record<string, TreeNode> = {};

  for (const filePath of sortedPaths) {
    const parts = filePath.split(path.sep).filter((part) => part !== "");
    let currentPath = "";
    let parentPath = "";

    if (parts.length === 0) {
      continue;
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (currentPath === "") {
        currentPath = part;
      } else {
        currentPath = path.join(currentPath, part);
      }

      if (pathMap[currentPath]) {
        parentPath = currentPath;
        continue;
      }

      const isLastPart = i === parts.length - 1;
      const isDir = !isLastPart || filePath.endsWith(path.sep);
      const nodeType = isDir ? "directory" : "file";

      const newNode: TreeNode = {
        name: part,
        path: currentPath,
        type: nodeType,
        children: [],
      };

      pathMap[currentPath] = newNode;

      if (i > 0 && parentPath !== "") {
        if (pathMap[parentPath]) {
          pathMap[parentPath].children?.push(newNode);
        }
      } else {
        root.push(newNode);
      }

      parentPath = currentPath;
    }
  }

  return root;
}

function printTree(tree: TreeNode[], rootPath: string): string {
  let result = `- ${rootPath}${path.sep}\n`;

  for (const node of tree) {
    printNode(node, 1, result);
  }

  return result;
}

function printNode(node: TreeNode, level: number, result: string): string {
  const indent = "  ".repeat(level);

  let nodeName = node.name;
  if (node.type === "directory") {
    nodeName += path.sep;
  }

  result += `${indent}- ${nodeName}\n`;

  if (node.type === "directory" && node.children && node.children.length > 0) {
    for (const child of node.children) {
      result = printNode(child, level + 1, result);
    }
  }

  return result;
}

