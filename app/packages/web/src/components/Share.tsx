import { createSignal, onCleanup, onMount, Show, For, createMemo } from "solid-js"
import styles from "./share.module.css"
import { type UIMessage } from "ai"
import { createStore, reconcile } from "solid-js/store"

type Status = "disconnected" | "connecting" | "connected" | "error" | "reconnecting"


type SessionMessage = UIMessage<{
  time: {
    created: number;
    completed?: number;
  };
  sessionID: string;
  tool: Record<string, {
    properties: Record<string, any>;
    time: {
      start: number;
      end: number;
    };
  }>;
}>

type SessionInfo = {
  tokens?: {
    input?: number
    output?: number
    reasoning?: number
  }
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

export default function Share(props: { api: string }) {
  let params = new URLSearchParams(document.location.search)
  const sessionId = params.get("id")

  const [store, setStore] = createStore<{
    info?: SessionInfo
    messages: Record<string, SessionMessage>
  }>({
    messages: {},
  })
  const messages = createMemo(() => Object.values(store.messages).toSorted((a, b) => a.id.localeCompare(b.id)))
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

  return (
    <main class={`${styles.root} not-content`}>
      <div class={styles.header}>
        <div data-section="title">
          <h1>Untitled conversation</h1>
          <p>
            <span data-status={connectionStatus()[0]}>&#9679;</span>
            <span>{getStatusText(connectionStatus())}</span>
          </p>
        </div>
        <div data-section="row">
          <ul class={styles.stats}>
            <li>
              <span>Input Tokens</span>
              {store.info?.tokens?.input ?
                <span>{store.info?.tokens?.input}</span>
                :
                <span data-placeholder>&mdash;</span>
              }
            </li>
            <li>
              <span>Output Tokens</span>
              {store.info?.tokens?.output ?
                <span>{store.info?.tokens?.output}</span>
                :
                <span data-placeholder>&mdash;</span>
              }
            </li>
            <li>
              <span>Reasoning Tokens</span>
              {store.info?.tokens?.reasoning ?
                <span>{store.info?.tokens?.reasoning}</span>
                :
                <span data-placeholder>&mdash;</span>
              }
            </li>
          </ul>
          <div class={styles.context}>
            <button>View Context &gt;</button>
          </div>
        </div>
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
