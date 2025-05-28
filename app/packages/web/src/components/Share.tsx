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
  tokens?: {
    input?: number
    output?: number
    reasoning?: number
  }
}

function getPartTitle(role: string, type: string): string | undefined {
  return role === "system"
    ? role
    : role === "user"
      ? undefined
      : type === "text"
        ? "AI"
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

function TextPart(props: { text: string, highlight?: boolean }) {
  const [expanded, setExpanded] = createSignal(false)
  const [overflowed, setOverflowed] = createSignal(false);
  let preEl: HTMLPreElement | undefined;

  const checkOverflow = () => {
    if (preEl) {
      setOverflowed(preEl.scrollHeight > preEl.clientHeight + 1);
    }
  };

  onMount(() => {
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
  });

  createEffect(() => {
    props.text;
    setTimeout(checkOverflow, 0);
  });

  onCleanup(() => {
    window.removeEventListener('resize', checkOverflow);
  });

  return (
    <div
      data-element-message-text
      data-expanded={expanded()}
      data-highlight={props.highlight}
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

  function renderTime(time: number) {
    return (
      <span title={
        DateTime.fromMillis(time).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)
      }>
        {DateTime.fromMillis(time).toLocaleString(DateTime.TIME_WITH_SECONDS)}
      </span>
    )
  }

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
              <span data-element-label>Input Tokens</span>
              {store.info?.tokens?.input ?
                <span>{store.info?.tokens?.input}</span>
                :
                <span data-placeholder>&mdash;</span>
              }
            </li>
            <li>
              <span data-element-label>Output Tokens</span>
              {store.info?.tokens?.output ?
                <span>{store.info?.tokens?.output}</span>
                :
                <span data-placeholder>&mdash;</span>
              }
            </li>
            <li>
              <span data-element-label>Reasoning Tokens</span>
              {store.info?.tokens?.reasoning ?
                <span>{store.info?.tokens?.reasoning}</span>
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
              {(msg) => (
                <For each={msg.parts}>
                  {(part) => (
                    <div
                      data-section="part"
                      data-message-role={msg.role}
                      data-part-type={part.type}
                    >
                      <div data-section="decoration">
                        <div>
                          <Switch fallback={
                            <IconWrenchScrewdriver width={16} height={16} />
                          }>
                            <Match when={msg.role === "assistant" && (part.type === "text" || part.type === "step-start")}>
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
                        {getPartTitle(msg.role, part.type)
                          ? <span data-element-label>
                            {getPartTitle(msg.role, part.type)}
                          </span>
                          : null
                        }
                        {part.type === "text"
                          ? <TextPart
                            text={part.text}
                            highlight={msg.role === "user"}
                          />
                          : <TextPart text={JSON.stringify(part, null, 2)} />
                        }
                        {renderTime(
                          msg.metadata?.time.completed
                          || msg.metadata?.time.created
                          || 0
                        )}
                      </div>
                    </div>
                  )}
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
