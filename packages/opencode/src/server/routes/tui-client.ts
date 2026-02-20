import { Hono } from "hono"
import { lazy } from "../../util/lazy"

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#0a0a1a">
  <title>Snow-Flow TUI</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='m' x1='16' y1='9' x2='16' y2='23' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0%25' stop-color='%23FFFFFF'/%3E%3Cstop offset='100%25' stop-color='%2300D9FF'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M4 23 L10 9 L16 15 L22 9 L28 23 Z' fill='url(%23m)' stroke='%2300D9FF' stroke-width='1.2' stroke-linejoin='round'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; background: #0a0a1a; color: #e2e8f0; font-family: -apple-system, system-ui, sans-serif; }
    body { display: flex; flex-direction: column; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
    #status { height: 32px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; background: #111127; border-bottom: 1px solid #1e1e3a; font-size: 12px; flex-shrink: 0; }
    #status .left { display: flex; align-items: center; gap: 8px; }
    #status .dot { width: 8px; height: 8px; border-radius: 50%; background: #444; }
    #status .dot.connected { background: #22c55e; }
    #status .dot.connecting { background: #eab308; animation: pulse 1s infinite; }
    #status .dot.error { background: #ef4444; }
    #status .label { color: #94a3b8; }
    #terminal-container { flex: 1; min-height: 0; }
    #terminal-container .xterm { height: 100%; padding: 4px; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    @media (max-width: 600px) {
      #status { height: 28px; font-size: 11px; padding: 0 8px; }
    }
  </style>
</head>
<body>
  <div id="status">
    <div class="left">
      <div id="dot" class="dot connecting"></div>
      <span id="status-text" class="label">Connecting...</span>
    </div>
    <span class="label">Snow-Flow TUI</span>
  </div>
  <div id="terminal-container"></div>
  <script type="module">
    import { Terminal } from "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/+esm"
    import { FitAddon } from "https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/+esm"
    import { WebLinksAddon } from "https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0.11.0/+esm"

    const dot = document.getElementById("dot")
    const statusText = document.getElementById("status-text")

    function setStatus(state, text) {
      dot.className = "dot " + state
      statusText.textContent = text
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

    const term = new Terminal({
      fontSize: isMobile ? 13 : 15,
      fontFamily: "Menlo, 'Courier New', monospace",
      theme: {
        background: "#0a0a1a",
        foreground: "#e2e8f0",
        cursor: "#4f8ff7",
        cursorAccent: "#0a0a1a",
        selectionBackground: "rgba(79, 143, 247, 0.3)",
        black: "#1a1a2e",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e2e8f0",
      },
      cursorBlink: true,
      convertEol: true,
      allowProposedApi: true,
      scrollback: 5000,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(document.getElementById("terminal-container"))
    fit.fit()

    let ws
    let reconnectTimer

    function connect() {
      setStatus("connecting", "Connecting...")
      const proto = location.protocol === "https:" ? "wss:" : "ws:"
      ws = new WebSocket(proto + "//" + location.host + "/tui-ws/ws?cols=" + term.cols + "&rows=" + term.rows)

      ws.onopen = () => setStatus("connected", "Connected")

      ws.onmessage = (e) => term.write(typeof e.data === "string" ? e.data : new Uint8Array(e.data))

      ws.onclose = (e) => {
        setStatus("error", "Disconnected — reconnecting...")
        clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(connect, 2000)
      }

      ws.onerror = () => {
        setStatus("error", "Connection error")
      }
    }

    term.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    function doFit() {
      fit.fit()
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }))
      }
    }

    window.addEventListener("resize", doFit)
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", doFit)
    }

    connect()
    term.focus()
  </script>
</body>
</html>`

export const TuiClientRoutes = lazy(() =>
  new Hono().get("/", (c) => {
    return c.html(HTML)
  }),
)
