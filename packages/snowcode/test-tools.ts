#!/usr/bin/env bun
import z from "zod/v4"
import { ToolRegistry } from "./src/tool/registry"

async function testTools() {
  console.log("Testing tool registration...")

  const tools = await ToolRegistry.tools("anthropic", "haiku-4.5")

  for (const tool of tools) {
    console.log(`\nTesting tool: ${tool.id}`)

    if (!tool.parameters) {
      console.log(`  ⚠️  Tool ${tool.id} has no parameters`)
      continue
    }

    try {
      const jsonSchema = z.toJSONSchema(tool.parameters)
      console.log(`  ✅ Tool ${tool.id} JSON schema generated successfully`)
    } catch (error) {
      console.log(`  ❌ Tool ${tool.id} failed: ${error instanceof Error ? error.message : String(error)}`)
      console.log(`  Parameters type: ${typeof tool.parameters}`)
      console.log(`  Parameters:`, tool.parameters)
    }
  }
}

testTools().catch(console.error)
