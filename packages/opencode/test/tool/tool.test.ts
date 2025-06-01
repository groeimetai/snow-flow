import { describe, expect, test } from "bun:test"
import { App } from "../../src/app/app"
import { GlobTool } from "../../src/tool/glob"
import { ListTool } from "../../src/tool/ls"

describe("tool.glob", () => {
  test("truncate", async () => {
    await App.provide({ cwd: process.cwd(), version: "test" }, async () => {
      let result = await GlobTool.execute({
        pattern: "./node_modules/**/*",
      })
      expect(result.metadata.truncated).toBe(true)
    })
  })
  test("basic", async () => {
    await App.provide({ cwd: process.cwd(), version: "test" }, async () => {
      let result = await GlobTool.execute({
        pattern: "*.json",
      })
      expect(result.metadata).toMatchObject({
        truncated: false,
        count: 2,
      })
    })
  })
})

describe("tool.ls", () => {
  test("basic", async () => {
    const result = await App.provide(
      { cwd: process.cwd(), version: "test" },
      async () => {
        return await ListTool.execute({
          path: "./example",
        })
      },
    )
    expect(result.output).toMatchSnapshot()
  })
})
