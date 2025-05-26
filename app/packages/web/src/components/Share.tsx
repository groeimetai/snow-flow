import { createSignal, onCleanup, onMount, Show, For } from "solid-js"
import { type UIMessage } from "ai"

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

export default function Share(props: { api: string }) {
  let params = new URLSearchParams(document.location.search)
  const shareId = params.get("id")

  const [connectionStatus, setConnectionStatus] = createSignal("Disconnected")
  const [sessionInfo, setSessionInfo] = createSignal<SessionInfo | null>(null)
  const [systemMessage, setSystemMessage] = createSignal<Message | null>(null)
  const [messages, setMessages] = createSignal<Message[]>([])
  const [expandedSystemMessage, setExpandedSystemMessage] = createSignal(false)

  onMount(() => {
    const apiUrl = props.api

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
            const infoContent = JSON.parse(data.content) as SessionInfo
            setSessionInfo(infoContent)
            console.log("Session info updated:", infoContent)
            return
          }

          // Check if it's a system message
          const msgContent = JSON.parse(data.content) as UIMessage
          if (msgContent.role === "system") {
            setSystemMessage(data)
            console.log("System message updated:", data)
            return
          }

          // Non-system messages
          setMessages((prev) => {
            // Check if message with this key already exists
            const existingIndex = prev.findIndex((msg) => msg.key === data.key)
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
      <h1>Share: {shareId}</h1>

      <div style={{ margin: "2rem 0" }}>
        <h2>WebSocket Connection</h2>
        <p>
          Status: <strong>{connectionStatus()}</strong>
        </p>

        <h3>Live Updates</h3>

        <Show when={sessionInfo()}>
          <div
            style={{
              padding: "1rem",
              marginBottom: "1rem",
              border: "1px solid #dee2e6",
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem 0" }}>Session Information</h4>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div>
                <strong>Input Tokens:</strong>{" "}
                {sessionInfo()?.tokens?.input || 0}
              </div>
              <div>
                <strong>Output Tokens:</strong>{" "}
                {sessionInfo()?.tokens?.output || 0}
              </div>
              <div>
                <strong>Reasoning Tokens:</strong>{" "}
                {sessionInfo()?.tokens?.reasoning || 0}
              </div>
            </div>
          </div>
        </Show>

        {/* Display system message as context in the Session Information block */}
        <Show when={systemMessage()}>
          <div
            style={{
              padding: "1rem",
              marginBottom: "1rem",
              border: "1px solid #dee2e6",
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem 0" }}>Context</h4>
            {(() => {
              try {
                const parsed = JSON.parse(
                  systemMessage()?.content || "",
                ) as UIMessage
                if (
                  parsed.parts &&
                  parsed.parts.length > 0 &&
                  parsed.parts[0].type === "text"
                ) {
                  const text = parsed.parts[0].text || ""
                  const lines = text.split("\n")
                  const visibleLines = expandedSystemMessage()
                    ? lines
                    : lines.slice(0, 5)
                  const hasMoreLines = lines.length > 5

                  return (
                    <>
                      <div
                        style={{
                          padding: "0.75rem",
                          border: "1px solid #dee2e6",
                        }}
                      >
                        {/* Create a modified version of the text part for the system message */}
                        {(() => {
                          // Create a modified part with truncated text
                          const modifiedPart = {
                            ...parsed.parts[0],
                            text: visibleLines.join("\n"),
                          }

                          return (
                            <>
                              <pre>{modifiedPart.text}</pre>
                              {hasMoreLines && !expandedSystemMessage() && (
                                <div
                                  style={{
                                    color: "#6c757d",
                                    fontStyle: "italic",
                                    marginTop: "0.5rem",
                                  }}
                                >
                                  {lines.length - 5} more lines...
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                      {hasMoreLines && (
                        <button
                          onClick={() =>
                            setExpandedSystemMessage(!expandedSystemMessage())
                          }
                          style={{
                            marginTop: "0.5rem",
                            padding: "0.25rem 0.75rem",
                            border: "1px solid #ced4da",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                          }}
                        >
                          {expandedSystemMessage() ? "Show Less" : "Show More"}
                        </button>
                      )}
                    </>
                  )
                }
              } catch (e) {
                return <div>Error parsing system message</div>
              }

              return null
            })()}
          </div>
        </Show>

        <div
          style={{
            border: "1px solid #ccc",
            padding: "1rem",
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
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div>
                      <strong>Key:</strong> {msg.key}
                    </div>

                    {(() => {
                      try {
                        const parsed = JSON.parse(msg.content) as UIMessage
                        const createdTime = parsed.metadata?.time?.created
                          ? new Date(
                            parsed.metadata.time.created,
                          ).toLocaleString()
                          : "Unknown time"

                        return (
                          <>
                            <div style={{ marginTop: "0.5rem" }}>
                              <strong>Full Content:</strong>
                              <pre
                                style={{
                                  padding: "0.5rem",
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
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "0.25rem 0.5rem",
                                    marginBottom: "0.5rem",
                                  }}
                                >
                                  <strong>
                                    Role: {parsed.role || "Unknown"}
                                  </strong>
                                  <span
                                    style={{
                                      fontSize: "0.8rem",
                                      color: "#6c757d",
                                    }}
                                  >
                                    {createdTime}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    padding: "0.75rem",
                                    border: "1px solid #dee2e6",
                                  }}
                                >
                                  <For
                                    each={parsed.parts.filter(
                                      (part) => part.type !== "step-start",
                                    )}
                                  >
                                    {(part) => {
                                      if (part.type === "text") {
                                        //{
                                        //  "type": "text",
                                        //  "text": "Hello! How can I help you today?"
                                        //}
                                        return (
                                          <pre>
                                            [{part.type}] {part.text}{" "}
                                          </pre>
                                        )
                                      }
                                      if (part.type === "reasoning") {
                                        //{
                                        //  "type": "reasoning",
                                        //  "text": "The user asked for a weather forecast. I should call the 'getWeather' tool with the location 'San Francisco'.",
                                        //  "providerMetadata": { "step_id": "reason_step_1" }
                                        //}
                                        return (
                                          <pre>
                                            [{part.type}] {part.text}
                                          </pre>
                                        )
                                      }
                                      if (part.type === "tool-invocation") {
                                        return (
                                          <div>
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                marginBottom: "0.3rem",
                                              }}
                                            >
                                              <span>
                                                <pre
                                                  style={{
                                                    margin: 0,
                                                    display: "inline",
                                                  }}
                                                >
                                                  [{part.type}]
                                                </pre>{" "}
                                                Tool:{" "}
                                                <strong>
                                                  {part.toolInvocation.toolName}
                                                </strong>
                                              </span>
                                              {parsed.metadata?.tool?.[
                                                part.toolInvocation.toolCallId
                                              ]?.time?.start &&
                                                parsed.metadata?.tool?.[
                                                  part.toolInvocation.toolCallId
                                                ]?.time?.end && (
                                                  <span
                                                    style={{
                                                      color: "#6c757d",
                                                      fontSize: "0.8rem",
                                                    }}
                                                  >
                                                    {(
                                                      (new Date(
                                                        parsed.metadata?.tool?.[
                                                          part.toolInvocation.toolCallId
                                                        ].time.end,
                                                      ) -
                                                        new Date(
                                                          parsed.metadata?.tool?.[
                                                            part.toolInvocation.toolCallId
                                                          ].time.start,
                                                        )) /
                                                      1000
                                                    ).toFixed(2)}
                                                    s
                                                  </span>
                                                )}
                                            </div>
                                            {(() => {
                                              if (
                                                part.toolInvocation.state ===
                                                "partial-call"
                                              ) {
                                                //{
                                                //  "type": "tool-invocation",
                                                //  "toolInvocation": {
                                                //    "state": "partial-call",
                                                //    "toolCallId": "tool_abc123",
                                                //    "toolName": "searchWeb",
                                                //    "argsTextDelta": "{\"query\":\"latest AI news"
                                                //  }
                                                //}
                                                return (
                                                  <>
                                                    <pre>
                                                      {
                                                        part.toolInvocation
                                                          .argsTextDelta
                                                      }
                                                    </pre>
                                                    <span>...</span>
                                                  </>
                                                )
                                              }
                                              if (
                                                part.toolInvocation.state ===
                                                "call"
                                              ) {
                                                //{
                                                //  "type": "tool-invocation",
                                                //  "toolInvocation": {
                                                //    "state": "call",
                                                //    "toolCallId": "tool_abc123",
                                                //    "toolName": "searchWeb",
                                                //    "args": { "query": "latest AI news", "count": 3 }
                                                //  }
                                                //}
                                                return (
                                                  <pre>
                                                    {JSON.stringify(
                                                      part.toolInvocation.args,
                                                      null,
                                                      2,
                                                    )}
                                                  </pre>
                                                )
                                              }
                                              if (
                                                part.toolInvocation.state ===
                                                "result"
                                              ) {
                                                //{
                                                //  "type": "tool-invocation",
                                                //  "toolInvocation": {
                                                //    "state": "result",
                                                //    "toolCallId": "tool_abc123",
                                                //    "toolName": "searchWeb",
                                                //    "args": { "query": "latest AI news", "count": 3 },
                                                //    "result": [
                                                //      { "title": "AI SDK v5 Announced", "url": "..." },
                                                //      { "title": "New LLM Achieves SOTA", "url": "..." }
                                                //    ]
                                                //  }
                                                //}
                                                return (
                                                  <>
                                                    <pre>
                                                      {JSON.stringify(
                                                        part.toolInvocation
                                                          .args,
                                                        null,
                                                        2,
                                                      )}
                                                    </pre>
                                                    <pre>
                                                      {JSON.stringify(
                                                        part.toolInvocation
                                                          .result,
                                                        null,
                                                        2,
                                                      )}
                                                    </pre>
                                                  </>
                                                )
                                              }
                                              if (
                                                part.toolInvocation.state ===
                                                "error"
                                              ) {
                                                //{
                                                //  "type": "tool-invocation",
                                                //  "toolInvocation": {
                                                //    "state": "error",
                                                //    "toolCallId": "tool_abc123",
                                                //    "toolName": "searchWeb",
                                                //    "args": { "query": "latest AI news", "count": 3 },
                                                //    "errorMessage": "API limit exceeded for searchWeb tool."
                                                //  }
                                                //}
                                                return (
                                                  <>
                                                    <pre>
                                                      {JSON.stringify(
                                                        part.toolInvocation
                                                          .args,
                                                        null,
                                                        2,
                                                      )}
                                                    </pre>
                                                    <pre>
                                                      {
                                                        part.toolInvocation
                                                          .errorMessage
                                                      }
                                                    </pre>
                                                  </>
                                                )
                                              }
                                            })()}
                                          </div>
                                        )
                                      }
                                      if (part.type === "source") {
                                        //{
                                        //  "type": "source",
                                        //  "source": {
                                        //    "sourceType": "url",
                                        //    "id": "doc_xyz789",
                                        //    "url": "https://example.com/research-paper.pdf",
                                        //    "title": "Groundbreaking AI Research Paper"
                                        //  }
                                        //}
                                        return (
                                          <div>
                                            <div>
                                              <span>
                                                <pre>[{part.type}]</pre>
                                              </span>
                                              <span>
                                                Source:{" "}
                                                {part.source.title ||
                                                  part.source.id}
                                              </span>
                                            </div>
                                            {part.source.url && (
                                              <div>
                                                <a
                                                  href={part.source.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  style={{ color: "#0c5460" }}
                                                >
                                                  {part.source.url}
                                                </a>
                                              </div>
                                            )}
                                            {part.source.sourceType && (
                                              <div>
                                                Type: {part.source.sourceType}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      }
                                      if (part.type === "file") {
                                        //{
                                        //  "type": "file",
                                        //  "mediaType": "image/jpeg",
                                        //  "filename": "cat_photo.jpg",
                                        //  "url": "https://example-files.com/cats/cat_photo.jpg"
                                        //}
                                        const isImage =
                                          part.mediaType?.startsWith("image/")

                                        return (
                                          <div>
                                            <div>
                                              <span>
                                                <pre>[{part.type}]</pre>
                                              </span>
                                              <span>File: {part.filename}</span>
                                              <span>{part.mediaType}</span>
                                            </div>

                                            {isImage && part.url ? (
                                              <div>
                                                <img
                                                  src={part.url}
                                                  alt={
                                                    part.filename ||
                                                    "Attached image"
                                                  }
                                                />
                                              </div>
                                            ) : (
                                              <div>
                                                {part.url ? (
                                                  <a
                                                    href={part.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                  >
                                                    Download: {part.filename}
                                                  </a>
                                                ) : (
                                                  <div>
                                                    File attachment (no URL
                                                    available)
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      }
                                      return null
                                    }}
                                  </For>
                                </div>
                              </div>
                            )}
                          </>
                        )
                      } catch (e) {
                        return (
                          <div>
                            <strong>Content:</strong>
                            <pre
                              style={{
                                padding: "0.5rem",
                                overflow: "auto",
                                maxHeight: "200px",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {msg.content}
                            </pre>
                          </div>
                        )
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
