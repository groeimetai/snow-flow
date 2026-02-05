import { createMemo, createSignal } from "solid-js"
import { reconcile } from "solid-js/store"
import { useSync } from "@tui/context/sync"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { useTheme } from "../context/theme"
import { Keybind } from "@/util/keybind"
import { TextAttributes } from "@opentui/core"
import { useSDK } from "@tui/context/sdk"

const WEB_TOOLS = [
  { id: "webfetch", title: "Web Fetch", description: "Fetch and read content from URLs" },
  { id: "websearch", title: "Web Search", description: "Search the web via Exa API" },
  { id: "codesearch", title: "Code Search", description: "Search code repositories via Exa API" },
]

function Status(props: { enabled: boolean; loading: boolean }) {
  const { theme } = useTheme()
  if (props.loading) {
    return <span style={{ fg: theme.textMuted }}>⋯ Loading</span>
  }
  if (props.enabled) {
    return <span style={{ fg: theme.success, attributes: TextAttributes.BOLD }}>✓ Enabled</span>
  }
  return <span style={{ fg: theme.textMuted }}>○ Disabled</span>
}

export function DialogWebTools() {
  const sync = useSync()
  const sdk = useSDK()
  const [loading, setLoading] = createSignal<string | null>(null)

  const options = createMemo(() => {
    const config = sync.data.config
    const loadingTool = loading()

    return WEB_TOOLS.map((tool) => ({
      value: tool.id,
      title: tool.title,
      description: tool.description,
      footer: <Status enabled={config.tools?.[tool.id] === true} loading={loadingTool === tool.id} />,
    }))
  })

  const keybinds = createMemo(() => [
    {
      keybind: Keybind.parse("space")[0],
      title: "toggle",
      onTrigger: async (option: DialogSelectOption<string>) => {
        if (loading() !== null) return

        setLoading(option.value)
        try {
          const current = sync.data.config.tools?.[option.value] === true
          await sdk.client.config.update({
            config: { tools: { [option.value]: !current } },
          })
          const result = await sdk.client.config.get()
          if (result.data) {
            sync.set("config", reconcile(result.data))
          }
        } catch (error) {
          console.error("Failed to toggle web tool:", error)
        } finally {
          setLoading(null)
        }
      },
    },
  ])

  return (
    <DialogSelect
      title="Web Tools"
      options={options()}
      keybind={keybinds()}
      onSelect={() => {}}
    />
  )
}
