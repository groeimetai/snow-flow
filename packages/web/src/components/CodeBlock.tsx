import {
  type JSX,
  onCleanup,
  splitProps,
  createEffect,
  createResource,
} from "solid-js"
import { codeToHtml } from "shiki"
import { transformerNotationDiff } from '@shikijs/transformers'

interface CodeBlockProps extends JSX.HTMLAttributes<HTMLDivElement> {
  code: string
  lang?: string
}
function CodeBlock(props: CodeBlockProps) {
  const [local, rest] = splitProps(props, ["code", "lang"])
  let containerRef!: HTMLDivElement

  const [html] = createResource(async () => {
    return (await codeToHtml(local.code, {
      lang: local.lang || "text",
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      transformers: [
        transformerNotationDiff(),
      ],
    })) as string
  })

  onCleanup(() => {
    if (containerRef) containerRef.innerHTML = ""
  })

  createEffect(() => {
    if (html() && containerRef) {
      containerRef.innerHTML = html() as string
    }
  })

  return (
    <div ref={containerRef} {...rest}></div>
  )
}

export default CodeBlock
