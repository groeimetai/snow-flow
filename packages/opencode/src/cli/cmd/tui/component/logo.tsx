import { TextAttributes } from "@opentui/core"
import { createMemo, For, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/context/theme"

const LOGO_SERAC = [
  "███████╗███████╗██████╗  █████╗  ██████╗",
  "██╔════╝██╔════╝██╔══██╗██╔══██╗██╔════╝",
  "███████╗█████╗  ██████╔╝███████║██║     ",
  "╚════██║██╔══╝  ██╔══██╗██╔══██║██║     ",
  "███████║███████╗██║  ██║██║  ██║╚██████╗",
  "╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝",
]

export function Logo() {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  // Block logo is 40 chars wide. Below that we drop to a plain
  // wordmark so the layout doesn't wrap mid-glyph on narrow terminals.
  const compact = createMemo(() => dimensions().width < 40)

  return (
    <Show
      when={compact()}
      fallback={
        <box>
          <For each={LOGO_SERAC}>
            {(line) => (
              <box>
                <text fg={theme.primary} attributes={TextAttributes.BOLD} selectable={false}>
                  {line}
                </text>
              </box>
            )}
          </For>
        </box>
      }
    >
      <box>
        <text fg={theme.primary} attributes={TextAttributes.BOLD} selectable={false}>
          serac
        </text>
      </box>
    </Show>
  )
}
