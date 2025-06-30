import { App } from "../app/app"
import { BunProc } from "../bun"
import type { Definition } from "./definition"

export const gofmt: Definition = {
  name: "gofmt",
  command: ["gofmt", "-w", "$FILE"],
  extensions: [".go"],
  async enabled() {
    return Bun.which("gofmt") !== null
  },
}

export const mix: Definition = {
  name: "mix",
  command: ["mix", "format", "$FILE"],
  extensions: [".ex", ".exs", ".eex", ".heex", ".leex", ".neex", ".sface"],
  async enabled() {
    return Bun.which("mix") !== null
  },
}

export const prettier: Definition = {
  name: "prettier",
  command: [BunProc.which(), "run", "prettier", "--write", "$FILE"],
  environment: {
    BUN_BE_BUN: "1",
  },
  extensions: [
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".vue",
    ".svelte",
    ".json",
    ".jsonc",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".md",
    ".mdx",
    ".graphql",
    ".gql",
  ],
  async enabled() {
    // this is more complicated because we only want to use prettier if it's
    // being used with the current project
    try {
      const proc = Bun.spawn({
        cmd: [BunProc.which(), "run", "prettier", "--version"],
        cwd: App.info().path.cwd,
        env: {
          BUN_BE_BUN: "1",
        },
        stdout: "ignore",
        stderr: "ignore",
      })
      const exit = await proc.exited
      return exit === 0
    } catch {
      return false
    }
  },
}

export const zig: Definition = {
  name: "zig",
  command: ["zig", "fmt", "$FILE"],
  extensions: [".zig", ".zon"],
  async enabled() {
    return Bun.which("zig") !== null
  },
}

export const clang: Definition = {
  name: "clang-format",
  command: ["clang-format", "-i", "$FILE"],
  extensions: [
    ".c",
    ".cc",
    ".cpp",
    ".cxx",
    ".c++",
    ".h",
    ".hh",
    ".hpp",
    ".hxx",
    ".h++",
    ".ino",
    ".C",
    ".H",
  ],
  async enabled() {
    return Bun.which("clang-format") !== null
  },
}

export const ktlint: Definition = {
  name: "ktlint",
  command: ["ktlint", "-F", "$FILE"],
  extensions: [".kt", ".kts"],
  async enabled() {
    return Bun.which("ktlint") !== null
  },
}

export const ruff: Definition = {
  name: "ruff",
  command: ["ruff", "format", "$FILE"],
  extensions: [".py", ".pyi"],
  async enabled() {
    return Bun.which("ruff") !== null
  },
}
