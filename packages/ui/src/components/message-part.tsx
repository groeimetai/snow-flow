import { Component, createMemo, For, Match, Show, Switch } from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  AssistantMessage,
  Message as MessageType,
  Part as PartType,
  TextPart,
  ToolPart,
  UserMessage,
} from "@opencode-ai/sdk"
import { BasicTool } from "./basic-tool"
import { GenericTool } from "./basic-tool"
import { Card } from "./card"
import { Icon } from "./icon"
import { Checkbox } from "./checkbox"
import { Diff } from "./diff"
import { DiffChanges } from "./diff-changes"
import { Markdown } from "./markdown"

export interface MessageProps {
  message: MessageType
  parts: PartType[]
}

export interface MessagePartProps {
  part: PartType
  message: MessageType
  hideDetails?: boolean
}

export type PartComponent = Component<MessagePartProps>

export const PART_MAPPING: Record<string, PartComponent | undefined> = {}

function getFilename(path: string) {
  if (!path) return ""
  const trimmed = path.replace(/[\/]+$/, "")
  const parts = trimmed.split("/")
  return parts[parts.length - 1] ?? ""
}

function getDirectory(path: string) {
  const parts = path.split("/")
  const dir = parts.slice(0, parts.length - 1).join("/")
  return dir ? dir + "/" : ""
}

export function registerPartComponent(type: string, component: PartComponent) {
  PART_MAPPING[type] = component
}

export function Message(props: MessageProps) {
  return (
    <Switch>
      <Match when={props.message.role === "user" && props.message}>
        {(userMessage) => (
          <UserMessageDisplay message={userMessage() as UserMessage} parts={props.parts} />
        )}
      </Match>
      <Match when={props.message.role === "assistant" && props.message}>
        {(assistantMessage) => (
          <AssistantMessageDisplay
            message={assistantMessage() as AssistantMessage}
            parts={props.parts}
          />
        )}
      </Match>
    </Switch>
  )
}

export function AssistantMessageDisplay(props: { message: AssistantMessage; parts: PartType[] }) {
  const filteredParts = createMemo(() => {
    return props.parts?.filter((x) => {
      if (x.type === "reasoning") return false
      return x.type !== "tool" || (x as ToolPart).tool !== "todoread"
    })
  })
  return <For each={filteredParts()}>{(part) => <Part part={part} message={props.message} />}</For>
}

export function UserMessageDisplay(props: { message: UserMessage; parts: PartType[] }) {
  const text = createMemo(() =>
    props.parts
      ?.filter((p) => p.type === "text" && !(p as TextPart).synthetic)
      ?.map((p) => (p as TextPart).text)
      ?.join(""),
  )
  return <div data-component="user-message">{text()}</div>
}

export function Part(props: MessagePartProps) {
  const component = createMemo(() => PART_MAPPING[props.part.type])
  return (
    <Show when={component()}>
      <Dynamic
        component={component()}
        part={props.part}
        message={props.message}
        hideDetails={props.hideDetails}
      />
    </Show>
  )
}

export interface ToolProps {
  input: Record<string, any>
  metadata: Record<string, any>
  tool: string
  output?: string
  hideDetails?: boolean
}

export type ToolComponent = Component<ToolProps>

const state: Record<
  string,
  {
    name: string
    render?: ToolComponent
  }
> = {}

export function registerTool(input: { name: string; render?: ToolComponent }) {
  state[input.name] = input
  return input
}

export function getTool(name: string) {
  return state[name]?.render
}

export const ToolRegistry = {
  register: registerTool,
  render: getTool,
}

PART_MAPPING["tool"] = function ToolPartDisplay(props) {
  const part = props.part as ToolPart
  const component = createMemo(() => {
    const render = ToolRegistry.render(part.tool) ?? GenericTool
    const metadata = part.state.status === "pending" ? {} : (part.state.metadata ?? {})
    const input = part.state.status === "completed" ? part.state.input : {}

    return (
      <Switch>
        <Match when={part.state.status === "error" && part.state.error}>
          {(error) => {
            const cleaned = error().replace("Error: ", "")
            const [title, ...rest] = cleaned.split(": ")
            return (
              <Card variant="error">
                <div data-component="tool-error">
                  <Icon name="circle-ban-sign" size="small" data-slot="icon" />
                  <Switch>
                    <Match when={title}>
                      <div data-slot="content">
                        <div data-slot="title">{title}</div>
                        <span>{rest.join(": ")}</span>
                      </div>
                    </Match>
                    <Match when={true}>{cleaned}</Match>
                  </Switch>
                </div>
              </Card>
            )
          }}
        </Match>
        <Match when={true}>
          <Dynamic
            component={render}
            input={input}
            tool={part.tool}
            metadata={metadata}
            output={part.state.status === "completed" ? part.state.output : undefined}
            hideDetails={props.hideDetails}
          />
        </Match>
      </Switch>
    )
  })

  return <Show when={component()}>{component()}</Show>
}

PART_MAPPING["text"] = function TextPartDisplay(props) {
  const part = props.part as TextPart
  return (
    <Show when={part.text.trim()}>
      <div data-component="text-part">
        <Markdown text={part.text.trim()} />
      </div>
    </Show>
  )
}

PART_MAPPING["reasoning"] = function ReasoningPartDisplay(props) {
  const part = props.part as any
  return (
    <Show when={part.text.trim()}>
      <div data-component="reasoning-part">
        <Markdown text={part.text.trim()} />
      </div>
    </Show>
  )
}

ToolRegistry.register({
  name: "read",
  render(props) {
    return (
      <BasicTool
        icon="glasses"
        trigger={{
          title: "Read",
          subtitle: props.input.filePath ? getFilename(props.input.filePath) : "",
        }}
      />
    )
  },
})

ToolRegistry.register({
  name: "list",
  render(props) {
    return (
      <BasicTool
        icon="bullet-list"
        trigger={{ title: "List", subtitle: getDirectory(props.input.path || "/") }}
      >
        <Show when={false && props.output}>
          <div data-component="tool-output">{props.output}</div>
        </Show>
      </BasicTool>
    )
  },
})

ToolRegistry.register({
  name: "glob",
  render(props) {
    return (
      <BasicTool
        icon="magnifying-glass-menu"
        trigger={{
          title: "Glob",
          subtitle: getDirectory(props.input.path || "/"),
          args: props.input.pattern ? ["pattern=" + props.input.pattern] : [],
        }}
      >
        <Show when={false && props.output}>
          <div data-component="tool-output">{props.output}</div>
        </Show>
      </BasicTool>
    )
  },
})

ToolRegistry.register({
  name: "grep",
  render(props) {
    const args = []
    if (props.input.pattern) args.push("pattern=" + props.input.pattern)
    if (props.input.include) args.push("include=" + props.input.include)
    return (
      <BasicTool
        icon="magnifying-glass-menu"
        trigger={{
          title: "Grep",
          subtitle: getDirectory(props.input.path || "/"),
          args,
        }}
      >
        <Show when={false && props.output}>
          <div data-component="tool-output">{props.output}</div>
        </Show>
      </BasicTool>
    )
  },
})

ToolRegistry.register({
  name: "webfetch",
  render(props) {
    return (
      <BasicTool
        icon="window-cursor"
        trigger={{
          title: "Webfetch",
          subtitle: props.input.url || "",
          args: props.input.format ? ["format=" + props.input.format] : [],
          action: (
            <div data-component="tool-action">
              <Icon name="square-arrow-top-right" size="small" />
            </div>
          ),
        }}
      >
        <Show when={false && props.output}>
          <div data-component="tool-output">{props.output}</div>
        </Show>
      </BasicTool>
    )
  },
})

ToolRegistry.register({
  name: "task",
  render(props) {
    return (
      <BasicTool
        icon="task"
        trigger={{
          title: `${props.input.subagent_type || props.tool} Agent`,
          titleClass: "capitalize",
          subtitle: props.input.description,
        }}
      >
        <Show when={false && props.output}>
          <div data-component="tool-output">{props.output}</div>
        </Show>
      </BasicTool>
    )
  },
})

ToolRegistry.register({
  name: "bash",
  render(props) {
    return (
      <BasicTool
        icon="console"
        trigger={{
          title: "Shell",
          subtitle: "Ran " + props.input.command,
        }}
      >
        <Show when={false && props.output}>
          <div data-component="tool-output">{props.output}</div>
        </Show>
      </BasicTool>
    )
  },
})

ToolRegistry.register({
  name: "edit",
  render(props) {
    return (
      <BasicTool
        icon="code-lines"
        trigger={
          <div data-component="edit-trigger">
            <div data-slot="title-area">
              <div data-slot="title">Edit</div>
              <div data-slot="path">
                <Show when={props.input.filePath?.includes("/")}>
                  <span data-slot="directory">{getDirectory(props.input.filePath!)}</span>
                </Show>
                <span data-slot="filename">{getFilename(props.input.filePath ?? "")}</span>
              </div>
            </div>
            <div data-slot="actions">
              <Show when={props.metadata.filediff}>
                <DiffChanges diff={props.metadata.filediff} />
              </Show>
            </div>
          </div>
        }
      >
        <Show when={props.metadata.filediff}>
          <div data-component="edit-content">
            <Diff
              before={{
                name: getFilename(props.metadata.filediff.path),
                contents: props.metadata.filediff.before,
              }}
              after={{
                name: getFilename(props.metadata.filediff.path),
                contents: props.metadata.filediff.after,
              }}
            />
          </div>
        </Show>
      </BasicTool>
    )
  },
})

ToolRegistry.register({
  name: "write",
  render(props) {
    return (
      <BasicTool
        icon="code-lines"
        trigger={
          <div data-component="write-trigger">
            <div data-slot="title-area">
              <div data-slot="title">Write</div>
              <div data-slot="path">
                <Show when={props.input.filePath?.includes("/")}>
                  <span data-slot="directory">{getDirectory(props.input.filePath!)}</span>
                </Show>
                <span data-slot="filename">{getFilename(props.input.filePath ?? "")}</span>
              </div>
            </div>
            <div data-slot="actions">{/* <DiffChanges diff={diff} /> */}</div>
          </div>
        }
      >
        <Show when={false && props.output}>
          <div data-component="tool-output">{props.output}</div>
        </Show>
      </BasicTool>
    )
  },
})

ToolRegistry.register({
  name: "todowrite",
  render(props) {
    return (
      <BasicTool
        icon="checklist"
        trigger={{
          title: "To-dos",
          subtitle: `${props.input.todos?.filter((t: any) => t.status === "completed").length}/${props.input.todos?.length}`,
        }}
      >
        <Show when={props.input.todos?.length}>
          <div data-component="todos">
            <For each={props.input.todos}>
              {(todo: any) => (
                <Checkbox readOnly checked={todo.status === "completed"}>
                  <div data-slot="todo-content" data-completed={todo.status === "completed"}>
                    {todo.content}
                  </div>
                </Checkbox>
              )}
            </For>
          </div>
        </Show>
      </BasicTool>
    )
  },
})
