import type { JSX } from "solid-js"
import type { RGBA } from "@opentui/core"
import open from "open"
import { tryOpenBrowser } from "@tui/util/browser"

export interface LinkProps {
  href: string
  children?: JSX.Element | string
  fg?: RGBA
}

/**
 * Link component that renders clickable hyperlinks.
 * Clicking anywhere on the link text opens the URL in the default browser.
 * Falls back to tryOpenBrowser ($BROWSER env, platform-native) when `open` fails.
 */
export function Link(props: LinkProps) {
  const displayText = props.children ?? props.href

  return (
    <text
      fg={props.fg}
      onMouseUp={() => {
        open(props.href).catch(() => {
          tryOpenBrowser(props.href).catch(() => {})
        })
      }}
    >
      {displayText}
    </text>
  )
}
