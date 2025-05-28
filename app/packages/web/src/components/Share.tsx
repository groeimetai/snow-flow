import {
  For,
  Show,
  Match,
  Switch,
  onMount,
  onCleanup,
  createMemo,
  createEffect,
  createSignal,
} from "solid-js"
import { DateTime } from "luxon"
import { IconCpuChip, IconSparkles, IconUserCircle, IconWrenchScrewdriver } from "./icons"
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

function getPartTitle(role: string, type: string): string | undefined {
  return role === "system"
    ? role
    : role === "user"
      ? undefined
      : type === "text"
        ? undefined
        : type
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

function TextPart(
  props: { text: string, expand?: boolean, highlight?: boolean }
) {
  const [expanded, setExpanded] = createSignal(false)
  const [overflowed, setOverflowed] = createSignal(false)
  let preEl: HTMLPreElement | undefined

  function checkOverflow() {
    if (preEl && !props.expand) {
      setOverflowed(preEl.scrollHeight > preEl.clientHeight + 1)
    }
  }

  onMount(() => {
    checkOverflow()
    window.addEventListener("resize", checkOverflow)
  })

  createEffect(() => {
    props.text
    setTimeout(checkOverflow, 0)
  })

  onCleanup(() => {
    window.removeEventListener("resize", checkOverflow)
  })

  return (
    <div
      data-element-message-text
      data-highlight={props.highlight}
      data-expanded={expanded() || props.expand === true}
    >
      <pre ref={el => (preEl = el)}>{props.text}</pre>
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
    <span title={
      DateTime.fromMillis(props.time).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)
    }>
      {DateTime.fromMillis(props.time).toLocaleString(DateTime.TIME_WITH_SECONDS)}
    </span>
  )
}

export default function Share(props: { api: string }) {
  let params = new URLSearchParams(document.location.search)
  const sessionId = params.get("id")

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

    console.log("Mounting Share component with ID:", sessionId)
    console.log("API URL:", apiUrl)

    if (!sessionId) {
      console.error("Session ID not found in environment variables")
      setConnectionStatus(["error", "Session ID not found"])
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
      const wsUrl = `${wsBaseUrl}/share_poll?id=${sessionId}`
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
                    const isLastPart = createMemo(() =>
                      (messages().length === msgIndex() + 1)
                      && (msg.parts.length === partIndex() + 1)
                    )
                    const time = msg.metadata?.time.completed
                      || msg.metadata?.time.created
                      || 0
                    return (
                      <div
                        data-section="part"
                        data-part-type={part.type}
                        data-message-role={msg.role}
                      >
                        <Switch>
                          { /* User text */}
                          <Match when={
                            msg.role === "user" && part.type === "text" && part
                          }>
                            {part =>
                              <>
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
                              </>
                            }
                          </Match>
                          { /* AI text */}
                          <Match when={
                            msg.role === "assistant"
                            && part.type === "text"
                            && part
                          }>
                            {part =>
                              <>
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
                              </>
                            }
                          </Match>
                          { /* System text */}
                          <Match when={
                            msg.role === "system"
                            && part.type === "text"
                            && part
                          }>
                            {part =>
                              <>
                                <div data-section="decoration">
                                  <div>
                                    <IconCpuChip width={18} height={18} />
                                  </div>
                                  <div></div>
                                </div>
                                <div data-section="content">
                                  <span data-element-label>System</span>
                                  <TextPart
                                    text={part().text}
                                    expand={isLastPart()}
                                  />
                                  <PartFooter time={time} />
                                </div>
                              </>
                            }
                          </Match>
                          { /* Step start */}
                          <Match when={part.type === "step-start"}>{null}</Match>
                          { /* Fallback */}
                          <Match when={true}>
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
                              <span data-element-label>{part.type}</span>
                              <TextPart text={JSON.stringify(part, null, 2)} />
                              <PartFooter time={time} />
                            </div>
                          </Match>
                        </Switch>
                      </div>
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
