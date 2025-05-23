import { createSignal, onCleanup, onMount, Show, For } from "solid-js"
import { useParams } from "@solidjs/router"

type Message = {
  key: string
  content: string
}

export default function App() {
  const params = useParams<{ id: string }>()
  const [messages, setMessages] = createSignal<Message[]>([])
  const [connectionStatus, setConnectionStatus] = createSignal("Disconnected")

  onMount(() => {
    // Get the API URL from environment
    const apiUrl = import.meta.env.VITE_API_URL
    const shareId = params.id

    console.log("Mounting Share component with ID:", shareId)
    console.log("API URL:", apiUrl)

    if (!shareId) {
      console.error("Share ID not found in environment variables")
      setConnectionStatus("Error: Share ID not found")
      return
    }

    if (!apiUrl) {
      console.error("API URL not found in environment variables")
      setConnectionStatus("Error: API URL not found")
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

      setConnectionStatus("Connecting...")

      // Always use secure WebSocket protocol (wss)
      const wsBaseUrl = apiUrl.replace(/^https?:\/\//, "wss://")
      const wsUrl = `${wsBaseUrl}/share_poll?shareID=${shareId}`
      console.log("Connecting to WebSocket URL:", wsUrl)

      // Create WebSocket connection
      socket = new WebSocket(wsUrl)

      // Handle connection opening
      socket.onopen = () => {
        setConnectionStatus("Connected")
        console.log("WebSocket connection established")
      }

      // Handle incoming messages
      socket.onmessage = (event) => {
        console.log("WebSocket message received")
        try {
          const data = JSON.parse(event.data) as Message
          setMessages((prev) => {
            // Check if message with this key already exists
            const existingIndex = prev.findIndex(msg => msg.key === data.key)
            
            if (existingIndex >= 0) {
              // Update existing message
              const updated = [...prev]
              updated[existingIndex] = data
              return updated
            } else {
              // Add new message
              return [...prev, data]
            }
          })
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      }

      // Handle errors
      socket.onerror = (error) => {
        console.error("WebSocket error:", error)
        setConnectionStatus("Error: Connection failed")
      }

      // Handle connection close and reconnection
      socket.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`)
        setConnectionStatus("Disconnected, reconnecting...")

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
    <main>
      <h1>Share: {params.id}</h1>

      <div style={{ margin: "2rem 0" }}>
        <h2>WebSocket Connection</h2>
        <p>
          Status: <strong>{connectionStatus()}</strong>
        </p>

        <h3>Live Updates</h3>
        <div
          style={{
            border: "1px solid #ccc",
            padding: "1rem",
            borderRadius: "0.5rem",
            maxHeight: "500px",
            overflowY: "auto",
          }}
        >
          <Show
            when={messages().length > 0}
            fallback={<p>Waiting for messages...</p>}
          >
            <ul style={{ listStyleType: "none", padding: 0 }}>
              <For each={messages()}>
                {(msg) => (
                  <li
                    style={{
                      padding: "0.5rem",
                      margin: "0.5rem 0",
                      backgroundColor: "#f5f5f5",
                      borderRadius: "0.25rem",
                    }}
                  >
                    <div>
                      <strong>Key:</strong> {msg.key}
                    </div>
                    <div>
                      <strong>Content:</strong> {msg.content}
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </main>
  )
}
