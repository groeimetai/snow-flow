import { createSignal, onCleanup, onMount, Show, For, createMemo } from "solid-js"
import { useParams } from "@solidjs/router"

type MessagePart = {
  type: string
  text?: string
  [key: string]: any
}

type MessageContent = {
  role?: string
  parts?: MessagePart[]
  metadata?: {
    time?: {
      created?: number
    }
  }
  [key: string]: any
}

type Message = {
  key: string
  content: string
}

type SessionInfo = {
  tokens?: {
    input?: number
    output?: number
    reasoning?: number
  }
}

export default function App() {
  const params = useParams<{ id: string }>()
  const [messages, setMessages] = createSignal<Message[]>([])
  const [connectionStatus, setConnectionStatus] = createSignal("Disconnected")
  const [sessionInfo, setSessionInfo] = createSignal<SessionInfo | null>(null)

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
          
          // Check if this is a session info message
          if (data.key.startsWith("session/info/")) {
            try {
              const infoContent = JSON.parse(data.content) as SessionInfo;
              setSessionInfo(infoContent);
              console.log("Session info updated:", infoContent);
            } catch (e) {
              console.error("Error parsing session info:", e);
            }
          } else {
            // For all other messages
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
          }
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
        
        <Show when={sessionInfo()}>
          <div 
            style={{
              backgroundColor: "#f8f9fa",
              padding: "1rem",
              borderRadius: "0.5rem",
              marginBottom: "1rem",
              border: "1px solid #dee2e6"
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem 0" }}>Session Information</h4>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div>
                <strong>Input Tokens:</strong> {sessionInfo()?.tokens?.input || 0}
              </div>
              <div>
                <strong>Output Tokens:</strong> {sessionInfo()?.tokens?.output || 0}
              </div>
              <div>
                <strong>Reasoning Tokens:</strong> {sessionInfo()?.tokens?.reasoning || 0}
              </div>
            </div>
          </div>
        </Show>
        
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
                      padding: "0.75rem",
                      margin: "0.75rem 0",
                      backgroundColor: "#f5f5f5",
                      borderRadius: "0.5rem",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div>
                      <strong>Key:</strong> {msg.key}
                    </div>
                    
                    {(() => {
                      try {
                        const parsed = JSON.parse(msg.content) as MessageContent;
                        const createdTime = parsed.metadata?.time?.created 
                          ? new Date(parsed.metadata.time.created).toLocaleString() 
                          : 'Unknown time';
                        
                        return (
                          <>
                            <div style={{ marginTop: "0.5rem" }}>
                              <strong>Full Content:</strong>
                              <pre
                                style={{
                                  backgroundColor: "#f0f0f0",
                                  padding: "0.5rem",
                                  borderRadius: "0.25rem",
                                  overflow: "auto",
                                  maxHeight: "150px",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  fontSize: "0.85rem",
                                }}
                              >
                                {JSON.stringify(parsed, null, 2)}
                              </pre>
                            </div>
                            
                            {parsed.parts && parsed.parts.length > 0 && (
                              <div style={{ marginTop: "0.75rem" }}>
                                <div style={{ 
                                  display: "flex", 
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "0.25rem 0.5rem",
                                  backgroundColor: "#e9ecef",
                                  borderRadius: "0.25rem",
                                  marginBottom: "0.5rem"
                                }}>
                                  <strong>Role: {parsed.role || 'Unknown'}</strong>
                                  <span style={{ fontSize: "0.8rem", color: "#6c757d" }}>
                                    {createdTime}
                                  </span>
                                </div>
                                
                                <div style={{ 
                                  backgroundColor: "#fff", 
                                  padding: "0.75rem",
                                  borderRadius: "0.25rem",
                                  border: "1px solid #dee2e6"
                                }}>
                                  <For each={parsed.parts}>
                                    {(part, index) => (
                                      <div style={{ marginBottom: index() < parsed.parts!.length - 1 ? "0.75rem" : "0" }}>
                                        {part.type === "text" ? (
                                          <pre style={{ 
                                            whiteSpace: "pre-wrap", 
                                            wordBreak: "break-word",
                                            fontFamily: "inherit",
                                            margin: 0,
                                            padding: 0,
                                            backgroundColor: "transparent",
                                            border: "none",
                                            fontSize: "inherit",
                                            overflow: "visible"
                                          }}>
                                            {part.text}
                                          </pre>
                                        ) : (
                                          <div>
                                            <div style={{ 
                                              fontSize: "0.85rem", 
                                              fontWeight: "bold",
                                              marginBottom: "0.25rem",
                                              color: "#495057"
                                            }}>
                                              Part type: {part.type}
                                            </div>
                                            <pre
                                              style={{
                                                backgroundColor: "#f8f9fa",
                                                padding: "0.5rem",
                                                borderRadius: "0.25rem",
                                                overflow: "auto",
                                                maxHeight: "200px",
                                                whiteSpace: "pre-wrap",
                                                wordBreak: "break-word",
                                                fontSize: "0.85rem",
                                                margin: 0
                                              }}
                                            >
                                              {JSON.stringify(part, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </For>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      } catch (e) {
                        return (
                          <div>
                            <strong>Content:</strong>
                            <pre
                              style={{
                                backgroundColor: "#f0f0f0",
                                padding: "0.5rem",
                                borderRadius: "0.25rem",
                                overflow: "auto",
                                maxHeight: "200px",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {msg.content}
                            </pre>
                          </div>
                        );
                      }
                    })()}
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
