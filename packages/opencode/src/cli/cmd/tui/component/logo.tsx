import { TextAttributes } from "@opentui/core"
import { createMemo, For, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/context/theme"

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
  const dimensions = useTerminalDimensions()
  const stacked = createMemo(() => dimensions().width < 76)

  return (
    <Show
      when={stacked()}
      fallback={
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
      }
    >
      <box>
        <For each={LOGO_SNOW}>
          {(line) => (
            <box>
              <text fg={theme.textMuted} selectable={false}>
                {line}
              </text>
            </box>
          )}
        </For>
        <For each={LOGO_FLOW}>
          {(line) => (
            <box>
              <text fg={theme.primary} attributes={TextAttributes.BOLD} selectable={false}>
                {line}
              </text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
