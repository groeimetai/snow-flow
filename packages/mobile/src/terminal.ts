import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import { Keyboard } from "@capacitor/keyboard"
import { Network } from "@capacitor/network"

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]

export interface TerminalConnection {
  disconnect(): void
}

export function createTerminal(
  container: HTMLElement,
  wsUrl: string,
  callbacks: {
    onDisconnect(): void
    onReconnecting(): void
    onReconnected(): void
  },
): TerminalConnection {
  const term = new Terminal({
    fontSize: 16,
    fontFamily: "Menlo, 'Courier New', monospace",
    theme: {
      background: "#1a1a2e",
      foreground: "#e2e8f0",
      cursor: "#4f8ff7",
      cursorAccent: "#1a1a2e",
      selectionBackground: "rgba(79, 143, 247, 0.3)",
      black: "#1a1a2e",
      red: "#ef4444",
      green: "#22c55e",
      yellow: "#eab308",
      blue: "#4f8ff7",
      magenta: "#a855f7",
      cyan: "#06b6d4",
      white: "#e2e8f0",
      brightBlack: "#64748b",
      brightRed: "#f87171",
      brightGreen: "#4ade80",
      brightYellow: "#facc15",
      brightBlue: "#6ba1f8",
      brightMagenta: "#c084fc",
      brightCyan: "#22d3ee",
      brightWhite: "#f8fafc",
    },
    cursorBlink: true,
    cursorStyle: "block",
    scrollback: 5000,
    allowProposedApi: true,
    convertEol: true,
    macOptionIsMeta: true,
  })

  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())

  term.open(container)
  fitAddon.fit()

  let ws: WebSocket | null = null
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  function sendResize() {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }))
    }
  }

  function connect() {
    if (disposed) return

    const url = `${wsUrl}?cols=${term.cols}&rows=${term.rows}`
    ws = new WebSocket(url)
    ws.binaryType = "arraybuffer"

    ws.onopen = () => {
      reconnectAttempt = 0
      if (reconnectAttempt > 0) {
        callbacks.onReconnected()
      }
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data))
      } else if (typeof event.data === "string" && event.data.length > 0) {
        term.write(event.data)
      }
    }

    ws.onclose = (event) => {
      if (disposed) return

      // Code 1000 = normal close (user disconnected), don't reconnect
      if (event.code === 1000) {
        callbacks.onDisconnect()
        return
      }

      // Unexpected close - attempt reconnect
      callbacks.onReconnecting()
      const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)]
      reconnectAttempt++
      reconnectTimer = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      // onclose will fire after onerror, handling reconnect there
    }
  }

  // Stream terminal input to WebSocket
  term.onData((data) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })

  // Handle terminal resize
  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit()
    sendResize()
  })
  resizeObserver.observe(container)

  // Handle virtual keyboard show/hide
  Keyboard.addListener("keyboardWillShow", (info) => {
    document.body.classList.add("keyboard-open")
    container.style.height = `calc(100% - ${info.keyboardHeight}px)`
    setTimeout(() => {
      fitAddon.fit()
      sendResize()
    }, 50)
  })

  Keyboard.addListener("keyboardWillHide", () => {
    document.body.classList.remove("keyboard-open")
    container.style.height = ""
    setTimeout(() => {
      fitAddon.fit()
      sendResize()
    }, 50)
  })

  // Handle network changes
  Network.addListener("networkStatusChange", (status) => {
    if (status.connected && ws?.readyState !== WebSocket.OPEN && !disposed) {
      // Network came back, try to reconnect immediately
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectAttempt = 0
      connect()
    }
  })

  // Orientation change
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      fitAddon.fit()
      sendResize()
    }, 100)
  })

  // Start connection
  connect()

  return {
    disconnect() {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      resizeObserver.disconnect()
      Keyboard.removeAllListeners()
      Network.removeAllListeners()
      if (ws) {
        ws.close(1000, "User disconnected")
        ws = null
      }
      term.dispose()
    },
  }
}
