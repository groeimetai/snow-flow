import { createMemo } from "solid-js"
import { useSync } from "@tui/context/sync"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { usePromptRef } from "@tui/context/prompt"

export function DialogSkill() {
  const sync = useSync()
  const dialog = useDialog()
  const promptRef = usePromptRef()

  const options = createMemo(() =>
    sync.data.command
      .filter((cmd) => cmd.source === "skill")
      .map((cmd) => ({
        value: cmd.name,
        title: cmd.name,
        description: cmd.description,
      })),
  )

  return (
    <DialogSelect
      title="Select skill"
      options={options()}
      onSelect={(option) => {
        promptRef.current?.set({ input: "/" + option.value + " ", parts: [] })
        dialog.clear()
      }}
    />
  )
}
