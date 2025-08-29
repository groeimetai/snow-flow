import { IconLogo } from "../component/icon"
import "./workspace/workspace.css"
import { RouteSectionProps } from "@solidjs/router"

export default function WorkspaceLayout(props: RouteSectionProps) {
  return (
    <main data-page="workspace">
      <header data-component="workspace-header">
        <div data-slot="header-brand">
          <a href="/" data-component="site-title">
            <IconLogo />
          </a>
        </div>
        <div data-slot="header-actions">
          <span>name@example.com</span>
          <a href="/logout">Logout</a>
        </div>
      </header>
      {props.children}
    </main>
  )
}
