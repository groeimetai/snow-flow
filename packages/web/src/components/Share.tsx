import { type JSX } from "solid-js"
import {
  For,
  Show,
  Match,
  Switch,
  onMount,
  onCleanup,
  splitProps,
  createMemo,
  createEffect,
  createSignal,
} from "solid-js"
import { DateTime } from "luxon"
import {
  IconOpenAI,
  IconGemini,
  IconAnthropic,
} from "./icons/custom"
import {
  IconCpuChip,
  IconSparkles,
  IconUserCircle,
  IconChevronDown,
  IconChevronRight,
  IconPencilSquare,
  IconWrenchScrewdriver,
} from "./icons"
import DiffView from "./DiffView"
import styles from "./share.module.css"
import { type UIMessage } from "ai"
import { createStore, reconcile } from "solid-js/store"

type Status = "disconnected" | "connecting" | "connected" | "error" | "reconnecting"


type SessionMessage = UIMessage<{
  time: {
    created: number
    completed?: number
  }
  assistant?: {
    modelID: string;
    providerID: string;
    cost: number;
    tokens: {
      input: number;
      output: number;
      reasoning: number;
    };
  };
  sessionID: string
  tool: Record<string, {
    properties: Record<string, any>
    time: {
      start: number
      end: number
    }
  }>
}>

type SessionInfo = {
  title: string
  cost?: number
}

function getFileType(path: string) {
  return path.split('.').pop()
}

// Converts `{a:{b:{c:1}}` to `[['a.b.c', 1]]`
function flattenToolArgs(obj: any, prefix: string = ""): Array<[string, any]> {
  const entries: Array<[string, any]> = [];

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      entries.push(...flattenToolArgs(value, path));
    }
    else {
      entries.push([path, value]);
    }
  }

  return entries;
}

function getStatusText(status: [Status, string?]): string {
  switch (status[0]) {
    case "connected": return "Connected"
    case "connecting": return "Connecting..."
    case "disconnected": return "Disconnected"
    case "reconnecting": return "Reconnecting..."
    case "error": return status[1] || "Error"
    default: return "Unknown"
  }
}

function ProviderIcon(props: { provider: string, size?: number }) {
  const size = props.size || 16
  return (
    <Switch fallback={
      <IconSparkles width={size} height={size} />
    }>
      <Match when={props.provider === "openai"}>
        <IconOpenAI width={size} height={size} />
      </Match>
      <Match when={props.provider === "anthropic"}>
        <IconAnthropic width={size} height={size} />
      </Match>
      <Match when={props.provider === "gemini"}>
        <IconGemini width={size} height={size} />
      </Match>
    </Switch>
  )
}

interface ResultsButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  results: boolean
}
function ResultsButton(props: ResultsButtonProps) {
  const [local, rest] = splitProps(props, ["results"])
  return (
    <button
      type="button"
      data-element-button-text
      data-element-button-more
      {...rest}
    >
      <span>
        {local.results ? "Hide results" : "Show results"}
      </span>
      <span data-button-icon>
        <Show
          when={local.results}
          fallback={
            <IconChevronRight width={10} height={10} />
          }
        >
          <IconChevronDown width={10} height={10} />
        </Show>
      </span>
    </button>
  )
}

interface TextPartProps extends JSX.HTMLAttributes<HTMLDivElement> {
  text: string
  expand?: boolean
  highlight?: boolean
}
function TextPart(props: TextPartProps) {
  const [local, rest] = splitProps(props, ["text", "expand", "highlight"])
  const [expanded, setExpanded] = createSignal(false)
  const [overflowed, setOverflowed] = createSignal(false)
  let preEl: HTMLPreElement | undefined

  function checkOverflow() {
    if (preEl && !local.expand) {
      setOverflowed(preEl.scrollHeight > preEl.clientHeight + 1)
    }
  }

  onMount(() => {
    checkOverflow()
    window.addEventListener("resize", checkOverflow)
  })

  createEffect(() => {
    local.text
    setTimeout(checkOverflow, 0)
  })

  onCleanup(() => {
    window.removeEventListener("resize", checkOverflow)
  })

  return (
    <div
      data-element-message-text
      data-highlight={local.highlight}
      data-expanded={expanded() || local.expand === true}
      {...rest}
    >
      <pre ref={el => (preEl = el)}>{local.text}</pre>
      {overflowed() &&
        <button
          type="button"
          data-element-button-text
          onClick={() => setExpanded(e => !e)}
        >
          {expanded() ? "Show less" : "Show more"}
        </button>
      }
    </div>
  )
}

function PartFooter(props: { time: number }) {
  return (
    <span
      data-part-footer
      title={
        DateTime.fromMillis(props.time).toLocaleString(
          DateTime.DATETIME_FULL_WITH_SECONDS
        )
      }
    >
      {DateTime.fromMillis(props.time).toLocaleString(DateTime.TIME_WITH_SECONDS)}
    </span>
  )
}

export default function Share(props: { api: string }) {
  let params = new URLSearchParams(document.location.search)
  const id = params.get("id")

  const [store, setStore] = createStore<{
    info?: SessionInfo
    messages: Record<string, SessionMessage>
  }>({
    messages: {},
  })
  const messages = createMemo(() => Object.values(store.messages).toSorted((a, b) => a.id?.localeCompare(b.id)))
  const [connectionStatus, setConnectionStatus] = createSignal<[Status, string?]>(["disconnected", "Disconnected"])

  onMount(() => {
    const apiUrl = props.api

    if (!id) {
      setConnectionStatus(["error", "id not found"])
      return
    }

    if (!apiUrl) {
      console.error("API URL not found in environment variables")
      setConnectionStatus(["error", "API URL not found"])
      return
    }

    let reconnectTimer: number | undefined
    let socket: WebSocket | null = null

    // Function to create and set up WebSocket with auto-reconnect
    const setupWebSocket = () => {
      // Close any existing connection
      if (socket) {
        socket.close()
      }

      setConnectionStatus(["connecting"])

      // Always use secure WebSocket protocol (wss)
      const wsBaseUrl = apiUrl.replace(/^https?:\/\//, "wss://")
      const wsUrl = `${wsBaseUrl}/share_poll?id=${id}`
      console.log("Connecting to WebSocket URL:", wsUrl)

      // Create WebSocket connection
      socket = new WebSocket(wsUrl)

      // Handle connection opening
      socket.onopen = () => {
        setConnectionStatus(["connected"])
        console.log("WebSocket connection established")
      }

      // Handle incoming messages
      socket.onmessage = (event) => {
        console.log("WebSocket message received")
        try {
          const data = JSON.parse(event.data)
          const [root, type, ...splits] = data.key.split("/")
          if (root !== "session") return
          if (type === "info") {
            setStore("info", reconcile(data.content))
            return
          }
          if (type === "message") {
            const [, messageID] = splits
            setStore("messages", messageID, reconcile(data.content))
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      }

      // Handle errors
      socket.onerror = (error) => {
        console.error("WebSocket error:", error)
        setConnectionStatus(["error", "Connection failed"])
      }

      // Handle connection close and reconnection
      socket.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`)
        setConnectionStatus(["reconnecting"])

        // Try to reconnect after 2 seconds
        clearTimeout(reconnectTimer)
        reconnectTimer = window.setTimeout(
          setupWebSocket,
          2000,
        ) as unknown as number
      }
    }

    // Initial connection
    setupWebSocket()

    // Clean up on component unmount
    onCleanup(() => {
      console.log("Cleaning up WebSocket connection")
      if (socket) {
        socket.close()
      }
      clearTimeout(reconnectTimer)
    })
  })

  const models = createMemo(() => {
    const result: string[][] = []
    for (const msg of messages()) {
      if (msg.role === "assistant" && msg.metadata?.assistant) {
        result.push([msg.metadata.assistant.providerID, msg.metadata.assistant.modelID])
      }
    }
    return result
  })

  const metrics = createMemo(() => {
    const result = {
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
      }
    }
    for (const msg of messages()) {
      const assistant = msg.metadata?.assistant
      if (!assistant) continue
      result.cost += assistant.cost
      result.tokens.input += assistant.tokens.input
      result.tokens.output += assistant.tokens.output
      result.tokens.reasoning += assistant.tokens.reasoning
    }
    return result
  })

  return (
    <main class={`${styles.root} not-content`}>
      <div class={styles.header}>
        <div data-section="title">
          <h1>{store.info?.title}</h1>
          <p>
            <span data-status={connectionStatus()[0]}>&#9679;</span>
            <span data-element-label>{getStatusText(connectionStatus())}</span>
          </p>
        </div>
        <div data-section="row">
          <ul data-section="stats">
            <li>
              <span data-element-label>Cost</span>
              {metrics().cost !== undefined ?
                <span>${metrics().cost.toFixed(2)}</span>
                :
                <span data-placeholder>&mdash;</span>
              }
            </li>
            <li>
              <span data-element-label>Input Tokens</span>
              {metrics().tokens.input ?
                <span>{metrics().tokens.input}</span>
                :
                <span data-placeholder>&mdash;</span>
              }
            </li>
            <li>
              <span data-element-label>Output Tokens</span>
              {metrics().tokens.output ?
                <span>{metrics().tokens.output}</span>
                :
                <span data-placeholder>&mdash;</span>
              }
            </li>
            <li>
              <span data-element-label>Reasoning Tokens</span>
              {metrics().tokens.reasoning ?
                <span>{metrics().tokens.reasoning}</span>
                :
                <span data-placeholder>&mdash;</span>
              }
            </li>
          </ul>
          <ul data-section="stats" data-section-models>
            {models().length > 0 ?
              <For each={Array.from(models())}>
                {([provider, model]) => (
                  <li>
                    <div data-stat-model-icon title={provider}>
                      <ProviderIcon provider={provider} />
                    </div>
                    <span data-stat-model>{model}</span>
                  </li>
                )}
              </For>
              :
              <li>
                <span data-element-label>Models</span>
                <span data-placeholder>&mdash;</span>
              </li>
            }
          </ul>
          <div data-section="date">
            {messages().length > 0 && messages()[0].metadata?.time.created ?
              <span title={
                DateTime.fromMillis(
                  messages()[0].metadata?.time.created || 0
                ).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)
              }>
                {DateTime.fromMillis(
                  messages()[0].metadata?.time.created || 0
                ).toLocaleString(DateTime.DATE_MED)}
              </span>
              :
              <span data-element-label data-placeholder>Started at &mdash;</span>
            }
          </div>
        </div>
      </div>

      <div>
        <Show
          when={messages().length > 0}
          fallback={<p>Waiting for messages...</p>}
        >
          <div class={styles.parts}>
            <For each={messages()}>
              {(msg, msgIndex) => (
                <For each={msg.parts}>
                  {(part, partIndex) => {
                    if (part.type === "step-start" && (partIndex() > 0 || !msg.metadata?.assistant)) return null

                    const [results, showResults] = createSignal(false)
                    const isLastPart = createMemo(() =>
                      (messages().length === msgIndex() + 1)
                      && (msg.parts.length === partIndex() + 1)
                    )
                    const time = msg.metadata?.time.completed
                      || msg.metadata?.time.created
                      || 0
                    return (
                      <Switch>
                        { /* User text */}
                        <Match when={
                          msg.role === "user" && part.type === "text" && part
                        }>
                          {part =>
                            <div
                              data-section="part"
                              data-part-type="user-text"
                            >
                              <div data-section="decoration">
                                <div>
                                  <IconUserCircle width={18} height={18} />
                                </div>
                                <div></div>
                              </div>
                              <div data-section="content">
                                <TextPart
                                  highlight
                                  text={part().text}
                                  expand={isLastPart()}
                                />
                                <PartFooter time={time} />
                              </div>
                            </div>
                          }
                        </Match>
                        { /* AI text */}
                        <Match when={
                          msg.role === "assistant"
                          && part.type === "text"
                          && part
                        }>
                          {part =>
                            <div
                              data-section="part"
                              data-part-type="ai-text"
                            >
                              <div data-section="decoration">
                                <div><IconSparkles width={18} height={18} /></div>
                                <div></div>
                              </div>
                              <div data-section="content">
                                <TextPart
                                  text={part().text}
                                  expand={isLastPart()}
                                />
                                <PartFooter time={time} />
                              </div>
                            </div>
                          }
                        </Match>
                        { /* AI model */}
                        <Match when={
                          msg.role === "assistant"
                          && part.type === "step-start"
                          && msg.metadata?.assistant
                        }>
                          {assistant =>
                            <div
                              data-section="part"
                              data-part-type="ai-model"
                            >
                              <div data-section="decoration">
                                <div>
                                  <ProviderIcon
                                    size={18}
                                    provider={assistant().providerID}
                                  />
                                </div>
                                <div></div>
                              </div>
                              <div data-section="content">
                                <div data-part-tool-body>
                                  <span
                                    data-size="md"
                                    data-part-title
                                    data-element-label
                                  >
                                    {assistant().providerID}
                                  </span>
                                  <span data-part-model>
                                    {assistant().modelID}
                                  </span>
                                </div>
                              </div>
                            </div>
                          }
                        </Match>
                        { /* System text */}
                        <Match when={
                          msg.role === "system"
                          && part.type === "text"
                          && part
                        }>
                          {part =>
                            <div
                              data-section="part"
                              data-part-type="system-text"
                            >
                              <div data-section="decoration">
                                <div>
                                  <IconCpuChip width={18} height={18} />
                                </div>
                                <div></div>
                              </div>
                              <div data-section="content">
                                <div data-part-tool-body>
                                  <span data-element-label data-part-title>
                                    System
                                  </span>
                                  <TextPart
                                    data-size="sm"
                                    text={part().text}
                                    data-color="dimmed"
                                  />
                                </div>
                                <PartFooter time={time} />
                              </div>
                            </div>
                          }
                        </Match>
                        { /* Edit tool */}
                        <Match when={
                          msg.role === "assistant"
                          && part.type === "tool-invocation"
                          && part.toolInvocation.toolName === "edit"
                          && part
                        }>
                          {part => {
                            const args = part().toolInvocation.args
                            const filePath = args.filePath
                            return (
                              <div
                                data-section="part"
                                data-part-type="tool-edit"
                              >
                                <div data-section="decoration">
                                  <div>
                                    <IconPencilSquare width={18} height={18} />
                                  </div>
                                  <div></div>
                                </div>
                                <div data-section="content">
                                  <div data-part-tool-body>
                                    <span data-part-title data-size="md">
                                      Edit {filePath}
                                    </span>
                                    <div data-part-tool-edit>
                                      <DiffView
                                        class={styles["code-block"]}
                                        oldCode={args.oldString}
                                        newCode={args.newString}
                                        lang={getFileType(filePath)}
                                      />
                                    </div>
                                  </div>
                                  <PartFooter time={time} />
                                </div>
                              </div>
                            )
                          }}
                        </Match>
                        { /* Tool call */}
                        <Match when={
                          msg.role === "assistant"
                          && part.type === "tool-invocation"
                          && part
                        }>
                          {part =>
                            <div
                              data-section="part"
                              data-part-type="tool-fallback"
                            >
                              <div data-section="decoration">
                                <div>
                                  <IconWrenchScrewdriver width={18} height={18} />
                                </div>
                                <div></div>
                              </div>
                              <div data-section="content">
                                <div data-part-tool-body>
                                  <span data-part-title data-size="md">
                                    {part().toolInvocation.toolName}
                                  </span>
                                  <div data-part-tool-args>
                                    <For each={
                                      flattenToolArgs(part().toolInvocation.args)
                                    }>
                                      {([name, value]) =>
                                        <>
                                          <div></div>
                                          <div>{name}</div>
                                          <div>{value}</div>
                                        </>
                                      }
                                    </For>
                                  </div>
                                  <Switch>
                                    <Match when={
                                      part().toolInvocation.state === "result"
                                      && part().toolInvocation.result
                                    }>
                                      <div data-part-tool-result>
                                        <ResultsButton
                                          results={results()}
                                          onClick={() => showResults(e => !e)}
                                        />
                                        <Show when={results()}>
                                          <TextPart
                                            expand
                                            data-size="sm"
                                            data-color="dimmed"
                                            text={part().toolInvocation.result}
                                          />
                                        </Show>
                                      </div>
                                    </Match>
                                    <Match when={
                                      part().toolInvocation.state === "call"
                                    }>
                                      <TextPart
                                        data-size="sm"
                                        data-color="dimmed"
                                        text="Calling..."
                                      />
                                    </Match>
                                  </Switch>
                                </div>
                                <PartFooter time={time} />
                              </div>
                            </div>
                          }
                        </Match>
                        { /* Fallback */}
                        <Match when={true}>
                          <div
                            data-section="part"
                            data-part-type="fallback"
                          >
                            <div data-section="decoration">
                              <div>
                                <Switch fallback={
                                  <IconWrenchScrewdriver width={16} height={16} />
                                }>
                                  <Match when={msg.role === "assistant" && part.type !== "tool-invocation"}>
                                    <IconSparkles width={18} height={18} />
                                  </Match>
                                  <Match when={msg.role === "system"}>
                                    <IconCpuChip width={18} height={18} />
                                  </Match>
                                  <Match when={msg.role === "user"}>
                                    <IconUserCircle width={18} height={18} />
                                  </Match>
                                </Switch>
                              </div>
                              <div></div>
                            </div>
                            <div data-section="content">
                              <div data-part-tool-body>
                                <span data-element-label data-part-title>
                                  {part.type}
                                </span>
                                <TextPart text={JSON.stringify(part, null, 2)} />
                              </div>
                              <PartFooter time={time} />
                            </div>
                          </div>
                        </Match>
                      </Switch>
                    )
                  }}
                </For>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div style={{ margin: "2rem 0" }}>
        <div
          style={{
            border: "1px solid #ccc",
            padding: "1rem",
            "overflow-y": "auto",
          }}
        >
          <Show
            when={messages().length > 0}
            fallback={<p>Waiting for messages...</p>}
          >
            <ul style={{ "list-style-type": "none", padding: 0 }}>
              <For each={messages()}>
                {(msg) => (
                  <li
                    style={{
                      padding: "0.75rem",
                      margin: "0.75rem 0",
                      "box-shadow": "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div>
                      <strong>Key:</strong> {msg.id}
                    </div>
                    <pre>{JSON.stringify(msg, null, 2)}</pre>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </main >
  )
}
