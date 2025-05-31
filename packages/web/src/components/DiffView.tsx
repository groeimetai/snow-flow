import { type Component, createMemo, createSignal, onMount } from "solid-js"
import { diffLines, type ChangeObject } from "diff"
import CodeBlock from "./CodeBlock"
import styles from "./diffview.module.css"

type DiffRow = {
  left: string
  right: string
  type: "added" | "removed" | "unchanged"
}

interface DiffViewProps {
  changes: ChangeObject<string>[]
  lang?: string
  class?: string
}

const DiffView: Component<DiffViewProps> = (props) => {
  const rows = createMemo(() => {
    const diffRows: DiffRow[] = []

    for (const item of props.changes) {
      const lines = item.value.split(/\r?\n/)
      if (lines.at(-1) === "") lines.pop()

      for (const line of lines) {
        diffRows.push({
          left: item.removed ? line : item.added ? "" : line,
          right: item.added ? line : item.removed ? "" : line,
          type: item.added ? "added" : item.removed ? "removed" : "unchanged",
        })
      }
    }

    return diffRows
  })

  return (
    <div class={`${styles.diff} ${props.class ?? ""}`}>
      <div class={styles.column}>
        {rows().map((r) => (
          <CodeBlock
            code={r.left}
            lang={props.lang}
            data-section="cell"
            data-diff-type={r.type === "removed" ? "removed" : ""}
          />
        ))}
      </div>

      <div class={styles.column}>
        {rows().map((r) => (
          <CodeBlock
            code={r.right}
            lang={props.lang}
            data-section="cell"
            data-diff-type={r.type === "added" ? "added" : ""}
          />
        ))}
      </div>
    </div>
  )
}

export default DiffView
