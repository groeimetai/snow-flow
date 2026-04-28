#!/usr/bin/env bun
/**
 * Generate tools.json — a single, self-describing manifest of every
 * public ServiceNow MCP tool defined in this package.
 *
 * Walks `src/servicenow/servicenow-mcp-unified/tools/`, dynamic-imports
 * each .ts tool file, reads the exported `toolDefinition`, and writes
 * `packages/opencode/tools.json` grouped by subcategory.
 *
 * Consumed by:
 *   - docs.serac.build (renders the Complete Tool Reference table
 *     client-side from this JSON, so docs auto-update with no
 *     hand-editing whenever this file regenerates)
 *
 * The matching workflow (.github/workflows/generate-tools-json.yml)
 * runs this on every push to main when tools/** changes and commits
 * the result back. Run locally with:
 *
 *   bun packages/opencode/script/generate-tools-json.ts
 */

import { readdir, writeFile } from "fs/promises"
import { join, basename, dirname } from "path"
import { fileURLToPath } from "url"

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOLS_DIR = join(HERE, "..", "src", "servicenow", "servicenow-mcp-unified", "tools")
const OUT_PATH = join(HERE, "..", "tools.json")

interface ToolEntry {
  name: string
  description: string
  subcategory: string
  permission?: string
  deprecated?: boolean
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue
      out.push(...(await walk(path)))
    } else if (entry.isFile() && path.endsWith(".ts") && entry.name !== "index.ts") {
      out.push(path)
    }
  }
  return out
}

const titleCase = (s: string) =>
  s
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

async function main() {
  const files = await walk(TOOLS_DIR)
  console.log(`Walking ${files.length} candidate files…`)

  const byName = new Map<string, ToolEntry & { file: string }>()
  let skipped = 0
  let failed = 0

  for (const file of files) {
    try {
      const mod = (await import(file)) as { toolDefinition?: any }
      const def = mod.toolDefinition
      if (!def || typeof def.name !== "string" || !def.name.startsWith("snow_")) {
        skipped++
        continue
      }
      const desc = String(def.description ?? "").trim()
      const subcategory =
        (typeof def.subcategory === "string" && def.subcategory) ||
        basename(dirname(file)) ||
        "misc"
      const isDeprecated = /\bdeprecated\b/i.test(desc.slice(0, 60))

      const existing = byName.get(def.name)
      if (existing && existing.description.length >= desc.length) continue

      byName.set(def.name, {
        file,
        name: def.name,
        description: desc,
        subcategory,
        permission: typeof def.permission === "string" ? def.permission : undefined,
        deprecated: isDeprecated || undefined,
      })
    } catch (err) {
      failed++
      console.error(`  failed: ${basename(file)} — ${(err as Error).message.split("\n")[0]}`)
    }
  }

  const grouped = new Map<string, ToolEntry[]>()
  for (const t of byName.values()) {
    const group = t.subcategory
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group)!.push({
      name: t.name,
      description: t.description,
      subcategory: t.subcategory,
      permission: t.permission,
      deprecated: t.deprecated,
    })
  }

  const groups = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, tools]) => ({
      name,
      displayName: titleCase(name),
      tools: tools
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => ({ name: t.name, description: t.description, ...(t.deprecated && { deprecated: true }) })),
    }))

  const output = {
    generatedAt: new Date().toISOString(),
    count: byName.size,
    groups,
  }

  await writeFile(OUT_PATH, JSON.stringify(output, null, 2) + "\n")

  console.log(
    `\nWrote ${OUT_PATH}\n  ${byName.size} tools across ${groups.length} subcategories\n  ${skipped} skipped (no toolDefinition / non-snow_ name)\n  ${failed} failed to import`,
  )

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
