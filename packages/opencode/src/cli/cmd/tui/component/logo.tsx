import { TextAttributes } from "@opentui/core"
import { For } from "solid-js"
import { useTheme } from "@tui/context/theme"

// Big SNOWFLOW logo using box-drawing characters
// SNOW (left, dimmed) + FLOW (right, bright cyan)
const LOGO_SNOW = [
  "███████╗███╗   ██╗ ██████╗ ██╗    ██╗",
  "██╔════╝████╗  ██║██╔═══██╗██║    ██║",
  "███████╗██╔██╗ ██║██║   ██║██║ █╗ ██║",
  "╚════██║██║╚██╗██║██║   ██║██║███╗██║",
  "███████║██║ ╚████║╚██████╔╝╚███╔███╔╝",
  "╚══════╝╚═╝  ╚═══╝ ╚═════╝  ╚══╝╚══╝ ",
]

const LOGO_FLOW = [
  "███████╗██╗      ██████╗ ██╗    ██╗",
  "██╔════╝██║     ██╔═══██╗██║    ██║",
  "█████╗  ██║     ██║   ██║██║ █╗ ██║",
  "██╔══╝  ██║     ██║   ██║██║███╗██║",
  "██║     ███████╗╚██████╔╝╚███╔███╔╝",
  "╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝ ",
]

export function Logo() {
  const { theme } = useTheme()

  return (
    <box>
      <For each={LOGO_SNOW}>
        {(line, index) => (
          <box flexDirection="row">
            <text fg={theme.textMuted} selectable={false}>
              {line}
            </text>
            <text fg={theme.primary} attributes={TextAttributes.BOLD} selectable={false}>
              {LOGO_FLOW[index()]}
            </text>
          </box>
        )}
      </For>
    </box>
  )
}
