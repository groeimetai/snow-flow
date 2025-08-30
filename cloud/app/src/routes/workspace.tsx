import { useAuthSession } from "~/context/auth.session"
import { IconLogo } from "../component/icon"
import "./workspace.css"
import { action, redirect, RouteSectionProps } from "@solidjs/router"

const logout = action(async () => {
  "use server"
  const auth = await useAuthSession()
  const current = auth.data.current
  if (current)
    await auth.update((val) => {
      delete val.account[current]
      return val
    })

  return redirect("/")
})

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
          <form action={logout} method="post">
            <button type="submit" formaction={logout}>Logout</button>
          </form>
        </div>
      </header>
      <div data-slot="content">{props.children}</div>
    </main>
  )
}
