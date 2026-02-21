import { StatusBar, Style } from "@capacitor/status-bar"
import { setupConnectScreen } from "./connect"
import { createTerminal, type TerminalConnection } from "./terminal"

const connectScreen = document.getElementById("connect-screen")!
const terminalScreen = document.getElementById("terminal-screen")!
const terminalContainer = document.getElementById("terminal")!
const disconnectBtn = document.getElementById("disconnect-btn")!
const indicator = document.getElementById("connection-indicator")!

let connection: TerminalConnection | null = null

// Configure status bar for dark background
StatusBar.setStyle({ style: Style.Dark }).catch(() => {
  // Not available on web
})
StatusBar.setBackgroundColor({ color: "#1a1a2e" }).catch(() => {
  // Not available on web
})

function showConnect() {
  terminalScreen.classList.add("hidden")
  connectScreen.classList.remove("hidden")
  indicator.className = ""

  if (connection) {
    connection.disconnect()
    connection = null
  }

  // Re-enable connect button
  const connectBtn = document.getElementById("connect-btn") as HTMLButtonElement
  connectBtn.disabled = false
  const status = document.getElementById("connect-status") as HTMLParagraphElement
  status.textContent = ""
  status.className = "status"
}

function showTerminal(wsUrl: string) {
  connectScreen.classList.add("hidden")
  terminalScreen.classList.remove("hidden")
  indicator.className = "connected"

  connection = createTerminal(terminalContainer, wsUrl, {
    onDisconnect() {
      showConnect()
    },
    onReconnecting() {
      indicator.className = "reconnecting"
    },
    onReconnected() {
      indicator.className = "connected"
    },
  })
}

disconnectBtn.addEventListener("click", showConnect)

setupConnectScreen((wsUrl) => {
  showTerminal(wsUrl)
})
