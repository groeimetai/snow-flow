import { describe, expect, test } from "bun:test"
import { App } from "../../src/app/app"
import { GlobTool } from "../../src/tool/glob"
import { ls } from "../../src/tool/ls"

describe("tool.glob", () => {
  test("truncate", async () => {
    await App.provide({ directory: process.cwd() }, async () => {
      let result = await GlobTool.execute(
        {
          pattern: "./node_modules/**/*",
        },
        {
          toolCallId: "test",
          messages: [],
        },
      )
      expect(result.metadata.truncated).toBe(true)
    })
  })
  test("basic", async () => {
    await App.provide({ directory: process.cwd() }, async () => {
      let result = await GlobTool.execute(
        {
          pattern: "*.json",
        },
        {
          toolCallId: "test",
          messages: [],
        },
      )
      expect(result.metadata).toMatchObject({
        truncated: false,
        count: 2,
      })
    })
  })
})

describe("tool.ls", () => {
  test("basic", async () => {
    const result = await App.provide({ directory: process.cwd() }, async () => {
      return await ls.execute(
        {
          path: "./example",
        },
        {
          toolCallId: "test",
          messages: [],
        },
      )
    })
    expect(result.output).toMatchSnapshot()
  })
})
