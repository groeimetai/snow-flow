import { type Component, createSignal, onMount } from "solid-js"
import { diffLines, type Change } from "diff"
import CodeBlock from "./CodeBlock"
import styles from "./diffview.module.css"

type DiffRow = {
  left: string
  right: string
  type: "added" | "removed" | "unchanged"
}

interface DiffViewProps {
  oldCode: string
  newCode: string
  lang?: string
  class?: string
}

const DiffView: Component<DiffViewProps> = (props) => {
  const [rows, setRows] = createSignal<DiffRow[]>([])

  onMount(() => {
    const chunks = diffLines(props.oldCode, props.newCode)
    const diffRows: DiffRow[] = []

    chunks.forEach((chunk: Change) => {
      const lines = chunk.value.split(/\r?\n/)
      if (lines.at(-1) === "") lines.pop()

      lines.forEach((line) => {
        diffRows.push({
          left: chunk.removed ? line : chunk.added ? "" : line,
          right: chunk.added ? line : chunk.removed ? "" : line,
          type: chunk.added ? "added"
            : chunk.removed ? "removed"
              : "unchanged",
        })
      })
    })

    setRows(diffRows)
  })

  return (
    <div class={`${styles.diff} ${props.class ?? ""}`}>
      {rows().map((r) => (
        <div data-section="row">
          <CodeBlock
            code={r.left}
            lang={props.lang}
            data-section="cell"
            data-diff-type={r.type === "removed" ? "removed" : ""}
          />
          <CodeBlock
            code={r.right}
            lang={props.lang}
            data-section="cell"
            data-diff-type={r.type === "added" ? "added" : ""}
          />
        </div>
      ))}
    </div>
  )
}

export default DiffView
