import { z } from "zod"
import { Tool } from "./tool"
import TurndownService from "turndown"
import DESCRIPTION from "./webfetch.txt"

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_TIMEOUT = 30 * 1000 // 30 seconds
const MAX_TIMEOUT = 120 * 1000 // 2 minutes

export const WebFetchTool = Tool.define({
  id: "opencode.webfetch",
  description: DESCRIPTION,
  parameters: z.object({
    url: z.string().describe("The URL to fetch content from"),
    format: z
      .enum(["text", "markdown", "html"])
      .describe(
        "The format to return the content in (text, markdown, or html)",
      ),
    timeout: z
      .number()
      .min(0)
      .max(MAX_TIMEOUT / 1000)
      .describe("Optional timeout in seconds (max 120)")
      .optional(),
  }),
  async execute(params) {
    // Validate URL
    if (
      !params.url.startsWith("http://") &&
      !params.url.startsWith("https://")
    ) {
      throw new Error("URL must start with http:// or https://")
    }

    const timeout = Math.min(
      (params.timeout ?? DEFAULT_TIMEOUT / 1000) * 1000,
      MAX_TIMEOUT,
    )

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(params.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "opencode/1.0",
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Request failed with status code: ${response.status}`)
    }

    // Check content length
    const contentLength = response.headers.get("content-length")
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large (exceeds 5MB limit)")
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large (exceeds 5MB limit)")
    }

    const content = new TextDecoder().decode(arrayBuffer)
    const contentType = response.headers.get("content-type") || ""

    switch (params.format) {
      case "text":
        if (contentType.includes("text/html")) {
          const text = extractTextFromHTML(content)
          return { output: text, metadata: {} }
        }
        return { output: content, metadata: {} }

      case "markdown":
        if (contentType.includes("text/html")) {
          const markdown = convertHTMLToMarkdown(content)
          return { output: markdown, metadata: {} }
        }
        return { output: "```\n" + content + "\n```", metadata: {} }

      case "html":
        return { output: content, metadata: {} }

      default:
        return { output: content, metadata: {} }
    }
  },
})

function extractTextFromHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const text = doc.body.textContent || doc.body.innerText || ""
  return text.replace(/\s+/g, " ").trim()
}

function convertHTMLToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  })
  turndownService.remove(["script", "style", "meta", "link"])
  return turndownService.turndown(html)
}
