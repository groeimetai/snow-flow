import { describe, expect, test } from "bun:test"
import { App } from "../../src/app/app"
import { GlobTool } from "../../src/tool/glob"
import { ListTool } from "../../src/tool/ls"

describe("tool.glob", () => {
  test("truncate", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      let result = await GlobTool.execute(
        {
          pattern: "./node_modules/**/*",
          path: null,
        },
        {
          sessionID: "test",
          messageID: "",
          abort: AbortSignal.any([]),
        },
      )
      expect(result.metadata.truncated).toBe(true)
    })
  })
  test("basic", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      let result = await GlobTool.execute(
        {
          pattern: "*.json",
          path: null,
        },
        {
          sessionID: "test",
          messageID: "",
          abort: AbortSignal.any([]),
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
    const result = await App.provide({ cwd: process.cwd() }, async () => {
      return await ListTool.execute(
        { path: "./example", ignore: [".git"] },
        {
          sessionID: "test",
          messageID: "",
          abort: AbortSignal.any([]),
        },
      )
    })
    expect(result.output).toMatchSnapshot()
  })
})
