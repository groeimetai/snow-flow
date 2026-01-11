import { Provider } from "@/provider/provider"
import { fn } from "@/util/fn"
import z from "zod"
import { Session } from "."
import { generateText, type ModelMessage } from "ai"
import { MessageV2 } from "./message-v2"
import { ProviderTransform } from "@/provider/transform"
import { SystemPrompt } from "./system"
import { Log } from "@/util/log"
import os from "os"
import { Instance } from "@/project/instance"
import { Global } from "@/global"

export namespace SessionReport {
  const log = Log.create({ service: "session.report" })

  export const ReportResult = z.object({
    systemInfo: z.object({
      os: z.string(),
      arch: z.string(),
      nodeVersion: z.string(),
      snowFlowVersion: z.string(),
      workingDirectory: z.string(),
    }),
    aiAnalysis: z.object({
      hasProblem: z.boolean(),
      summary: z.string(),
      problemDescription: z.string(),
      stepsToReproduce: z.array(z.string()),
      expectedBehavior: z.string(),
      actualBehavior: z.string(),
      additionalContext: z.string(),
    }).nullable(),
    error: z.string().optional(),
  })
  export type ReportResult = z.infer<typeof ReportResult>

  export const generate = fn(
    z.object({
      sessionID: z.string(),
      providerID: z.string().optional(),
    }),
    async (input): Promise<ReportResult> => {
      // Collect system info
      const systemInfo = {
        os: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        snowFlowVersion: Global.version || "unknown",
        workingDirectory: Instance.directory,
      }

      // Get session messages for AI analysis
      const messages = await Session.messages(input.sessionID)
      if (!messages || messages.length === 0) {
        return {
          systemInfo,
          aiAnalysis: null,
          error: "No messages in session to analyze",
        }
      }

      // Find a provider to use for AI analysis
      let providerID = input.providerID
      if (!providerID) {
        // Try to find the provider from the last assistant message
        const assistantMsg = messages.findLast((m) => m.info.role === "assistant")
        if (assistantMsg) {
          providerID = (assistantMsg.info as MessageV2.Assistant).providerID
        }
      }

      if (!providerID) {
        return {
          systemInfo,
          aiAnalysis: null,
          error: "No provider available for AI analysis",
        }
      }

      const small = await Provider.getSmallModel(providerID)
      if (!small) {
        return {
          systemInfo,
          aiAnalysis: null,
          error: "No small model available for AI analysis",
        }
      }

      try {
        // Format conversation for analysis
        const conversationText = messages
          .map((m) => {
            const role = m.info.role === "user" ? "User" : "Assistant"
            const textParts = m.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as MessageV2.TextPart).text)
              .join("\n")
            return `${role}: ${textParts}`
          })
          .join("\n\n")

        // Call AI with report prompt
        const result = await generateText({
          maxOutputTokens: small.info.reasoning ? 2000 : 500,
          providerOptions: ProviderTransform.providerOptions(small.npm, small.providerID, {}),
          messages: [
            ...SystemPrompt.report(small.providerID).map(
              (x): ModelMessage => ({
                role: "system",
                content: x,
              }),
            ),
            {
              role: "user" as const,
              content: `<conversation>\n${conversationText}\n</conversation>`,
            },
          ],
          model: small.language,
        })

        log.info("report generated", { result: result.text })

        // Parse the JSON response - handle markdown code blocks and extra text
        try {
          let jsonText = result.text.trim()

          // Try to extract JSON from markdown code block
          const jsonBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
          if (jsonBlockMatch) {
            jsonText = jsonBlockMatch[1].trim()
          }

          // Try to find JSON object in the response
          const jsonStart = jsonText.indexOf("{")
          const jsonEnd = jsonText.lastIndexOf("}")
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            jsonText = jsonText.slice(jsonStart, jsonEnd + 1)
          }

          const aiAnalysis = JSON.parse(jsonText)
          return {
            systemInfo,
            aiAnalysis,
          }
        } catch (parseError) {
          log.error("Failed to parse AI response", { error: parseError, text: result.text })
          // Return a fallback "no problem" response instead of error
          return {
            systemInfo,
            aiAnalysis: {
              hasProblem: false,
              summary: "",
              problemDescription: "",
              stepsToReproduce: [],
              expectedBehavior: "",
              actualBehavior: "",
              additionalContext: "AI analysis could not parse the response",
            },
          }
        }
      } catch (error) {
        log.error("Failed to generate report", { error })
        return {
          systemInfo,
          aiAnalysis: null,
          error: `AI analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    },
  )
}
