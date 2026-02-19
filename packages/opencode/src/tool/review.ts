import z from "zod"
import path from "path"
import { Tool } from "./tool"
import { Question } from "../question"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Identifier } from "../id/id"
import { Provider } from "../provider/provider"
import { Instance } from "../project/instance"
import EXIT_DESCRIPTION from "./review-exit.txt"
import ENTER_DESCRIPTION from "./review-enter.txt"

async function getLastModel(sessionID: string) {
  for await (const item of MessageV2.stream(sessionID)) {
    if (item.info.role === "user" && item.info.model) return item.info.model
  }
  return Provider.defaultModel()
}

export const ReviewExitTool = Tool.define("review_exit", {
  description: EXIT_DESCRIPTION,
  parameters: z.object({}),
  async execute(_params, ctx) {
    const session = await Session.get(ctx.sessionID)
    const reviewFile = path.relative(Instance.worktree, Session.review(session))
    const answers = await Question.ask({
      sessionID: ctx.sessionID,
      questions: [
        {
          question: `Review at ${reviewFile} is complete. Would you like to switch to the build agent and start acting on the feedback?`,
          header: "Build Agent",
          custom: false,
          options: [
            { label: "Yes", description: "Switch to build agent and act on review feedback" },
            { label: "No", description: "Stay with review agent to continue analysis" },
          ],
        },
      ],
      tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
    })

    const answer = answers[0]?.[0]
    if (answer === "No") throw new Question.RejectedError()

    const model = await getLastModel(ctx.sessionID)

    const userMsg: MessageV2.User = {
      id: Identifier.ascending("message"),
      sessionID: ctx.sessionID,
      role: "user",
      time: {
        created: Date.now(),
      },
      agent: "build",
      model,
    }
    await Session.updateMessage(userMsg)
    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID: userMsg.id,
      sessionID: ctx.sessionID,
      type: "text",
      text: `The review at ${reviewFile} has been approved, you can now edit files. Act on the review feedback`,
      synthetic: true,
    } satisfies MessageV2.TextPart)

    return {
      title: "Switching to build agent",
      output: "User approved switching to build agent. Wait for further instructions.",
      metadata: {},
    }
  },
})

export const ReviewEnterTool = Tool.define("review_enter", {
  description: ENTER_DESCRIPTION,
  parameters: z.object({
    activityId: z.string().optional().describe("Activity ID from the activity_update response"),
    artifacts: z.string().optional().describe("JSON array of artifact details to review"),
    updateSetName: z.string().optional().describe("Name of the update set being reviewed"),
  }),
  async execute(params, ctx) {
    const session = await Session.get(ctx.sessionID)
    const reviewFile = path.relative(Instance.worktree, Session.review(session))

    const answers = await Question.ask({
      sessionID: ctx.sessionID,
      questions: [
        {
          question: `Activity is ready for code reuse review. Would you like to switch to the review agent and save findings to ${reviewFile}?`,
          header: "Review Mode",
          custom: false,
          options: [
            { label: "Yes", description: "Switch to review agent for code reuse analysis" },
            { label: "No", description: "Stay with build agent and skip review" },
          ],
        },
      ],
      tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
    })

    const answer = answers[0]?.[0]
    if (answer === "No") throw new Question.RejectedError()

    const model = await getLastModel(ctx.sessionID)

    const userMsg: MessageV2.User = {
      id: Identifier.ascending("message"),
      sessionID: ctx.sessionID,
      role: "user",
      time: {
        created: Date.now(),
      },
      agent: "review",
      model,
    }
    await Session.updateMessage(userMsg)

    const context = [
      "User has requested to enter review mode. Switch to review mode and begin code reuse analysis.",
      `The review file will be at ${reviewFile}.`,
      params.activityId ? `Activity ID: ${params.activityId}` : "",
      params.updateSetName ? `Update Set: ${params.updateSetName}` : "",
      params.artifacts ? `Artifacts to review:\n${params.artifacts}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID: userMsg.id,
      sessionID: ctx.sessionID,
      type: "text",
      text: context,
      synthetic: true,
    } satisfies MessageV2.TextPart)

    return {
      title: "Switching to review agent",
      output: `User confirmed to switch to review mode. A new message has been created to switch you to review mode. The review file will be at ${reviewFile}. Begin code reuse analysis.`,
      metadata: {},
    }
  },
})
