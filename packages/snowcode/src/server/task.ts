import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { streamSSE } from "hono/streaming"
import z from "zod/v4"
import { BackgroundAgent } from "../agent/background"
import { TaskQueue } from "../agent/task-queue"
import { Bus } from "../bus"

/**
 * Task Route - Server endpoints for background task management
 */

export const TaskRoute = new Hono()
  // List all tasks
  .get(
    "/",
    describeRoute({
      description: "List background tasks",
      operationId: "task.list",
      responses: {
        200: {
          description: "List of background tasks",
          content: {
            "application/json": {
              schema: resolver(z.array(TaskQueue.BackgroundTask)),
            },
          },
        },
      },
    }),
    validator(
      "query",
      z.object({
        active: z.coerce.boolean().optional().default(false),
        limit: z.coerce.number().optional().default(20),
      }),
    ),
    async (c) => {
      const { active, limit } = c.req.valid("query")
      const tasks = active
        ? await BackgroundAgent.listActive()
        : await BackgroundAgent.list()
      return c.json(tasks.slice(0, limit))
    },
  )
  // Get a specific task
  .get(
    "/:taskId",
    describeRoute({
      description: "Get a background task by ID",
      operationId: "task.get",
      responses: {
        200: {
          description: "Task details",
          content: {
            "application/json": {
              schema: resolver(TaskQueue.BackgroundTask),
            },
          },
        },
        404: {
          description: "Task not found",
        },
      },
    }),
    async (c) => {
      const taskId = c.req.param("taskId")
      const task = await BackgroundAgent.getStatus(taskId)
      if (!task) {
        return c.json({ error: "Task not found" }, 404)
      }
      return c.json(task)
    },
  )
  // Create a new background task
  .post(
    "/",
    describeRoute({
      description: "Create a new background task",
      operationId: "task.create",
      responses: {
        201: {
          description: "Task created",
          content: {
            "application/json": {
              schema: resolver(TaskQueue.BackgroundTask),
            },
          },
        },
        400: {
          description: "Invalid request",
        },
      },
    }),
    validator(
      "json",
      z.object({
        agentName: z.string(),
        prompt: z.string(),
        description: z.string(),
        parentSessionID: z.string().optional(),
        priority: TaskQueue.TaskPriority.optional(),
        tokenBudget: z.number().optional(),
        modelID: z.string().optional(),
        providerID: z.string().optional(),
      }),
    ),
    async (c) => {
      const input = c.req.valid("json")
      try {
        const task = await BackgroundAgent.spawn(input)
        return c.json(task, 201)
      } catch (error) {
        return c.json(
          { error: error instanceof Error ? error.message : String(error) },
          400,
        )
      }
    },
  )
  // Cancel a task
  .delete(
    "/:taskId",
    describeRoute({
      description: "Cancel a background task",
      operationId: "task.cancel",
      responses: {
        200: {
          description: "Task cancelled",
        },
        404: {
          description: "Task not found or already completed",
        },
      },
    }),
    async (c) => {
      const taskId = c.req.param("taskId")
      const success = await BackgroundAgent.cancel(taskId)
      if (!success) {
        return c.json({ error: "Task not found or already completed" }, 404)
      }
      return c.json({ success: true, taskId })
    },
  )
  // Get running count
  .get(
    "/status/count",
    describeRoute({
      description: "Get count of running tasks",
      operationId: "task.runningCount",
      responses: {
        200: {
          description: "Running task count",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  running: z.number(),
                  queued: z.number(),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const active = await BackgroundAgent.listActive()
      const running = active.filter((t) => t.status === "running").length
      const queued = active.filter((t) => t.status === "queued").length
      return c.json({ running, queued })
    },
  )
  // SSE stream for task events
  .get(
    "/events",
    describeRoute({
      description: "Stream task events via SSE",
      operationId: "task.events",
      responses: {
        200: {
          description: "SSE stream of task events",
        },
      },
    }),
    async (c) => {
      return streamSSE(c, async (stream) => {
        const subscriptions: (() => void)[] = []

        // Subscribe to all task events
        subscriptions.push(
          Bus.subscribe(TaskQueue.Event.TaskCreated, (evt) => {
            stream.writeSSE({
              event: "task.created",
              data: JSON.stringify(evt.properties),
            })
          }),
        )

        subscriptions.push(
          Bus.subscribe(TaskQueue.Event.TaskStarted, (evt) => {
            stream.writeSSE({
              event: "task.started",
              data: JSON.stringify(evt.properties),
            })
          }),
        )

        subscriptions.push(
          Bus.subscribe(TaskQueue.Event.TaskProgress, (evt) => {
            stream.writeSSE({
              event: "task.progress",
              data: JSON.stringify(evt.properties),
            })
          }),
        )

        subscriptions.push(
          Bus.subscribe(TaskQueue.Event.TaskCompleted, (evt) => {
            stream.writeSSE({
              event: "task.completed",
              data: JSON.stringify(evt.properties),
            })
          }),
        )

        subscriptions.push(
          Bus.subscribe(TaskQueue.Event.TaskFailed, (evt) => {
            stream.writeSSE({
              event: "task.failed",
              data: JSON.stringify(evt.properties),
            })
          }),
        )

        subscriptions.push(
          Bus.subscribe(TaskQueue.Event.TaskCancelled, (evt) => {
            stream.writeSSE({
              event: "task.cancelled",
              data: JSON.stringify(evt.properties),
            })
          }),
        )

        // Keep connection alive
        const keepAlive = setInterval(() => {
          stream.writeSSE({
            event: "ping",
            data: JSON.stringify({ time: Date.now() }),
          })
        }, 30000)

        // Cleanup on close
        stream.onAbort(() => {
          clearInterval(keepAlive)
          subscriptions.forEach((unsub) => unsub())
        })

        // Wait forever (SSE stream)
        await new Promise(() => {})
      })
    },
  )
  // Clear old completed tasks
  .post(
    "/cleanup",
    describeRoute({
      description: "Clear old completed tasks",
      operationId: "task.cleanup",
      responses: {
        200: {
          description: "Cleanup result",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  cleared: z.number(),
                }),
              ),
            },
          },
        },
      },
    }),
    validator(
      "json",
      z.object({
        daysOld: z.number().optional().default(7),
      }),
    ),
    async (c) => {
      const { daysOld } = c.req.valid("json")
      const cleared = await BackgroundAgent.cleanup(daysOld)
      return c.json({ cleared })
    },
  )
