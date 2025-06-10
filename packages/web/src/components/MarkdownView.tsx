import { type JSX, splitProps, createResource } from "solid-js"
import { marked } from "marked"
import styles from "./markdownview.module.css"

interface MarkdownViewProps extends JSX.HTMLAttributes<HTMLDivElement> {
  markdown: string
}

function MarkdownView(props: MarkdownViewProps) {
  const [local, rest] = splitProps(props, ["markdown"])
  const [html] = createResource(() => local.markdown, async (markdown) => {
    return marked.parse(markdown)
  })

  return (
    <div innerHTML={html()} class={styles["markdown-body"]} {...rest} />
  )
}

export default MarkdownView

