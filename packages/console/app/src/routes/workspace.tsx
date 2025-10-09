import { Show } from "solid-js"
import { getRequestEvent } from "solid-js/web"
import { query, action, redirect, createAsync, RouteSectionProps, useParams, A } from "@solidjs/router"
import "./workspace.css"
import { useAuthSession } from "~/context/auth.session"
import { IconLogo } from "../component/icon"
import { WorkspacePicker } from "./workspace-picker"
import { withActor } from "~/context/auth.withActor"
import { User } from "@opencode-ai/console-core/user.js"
import { Actor } from "@opencode-ai/console-core/actor.js"
import { querySessionInfo } from "./workspace/common"

const getUserEmail = query(async (workspaceID: string) => {
  "use server"
  return withActor(async () => {
    const actor = Actor.assert("user")
    const email = await User.getAccountEmail(actor.properties.userID)
    return email
  }, workspaceID)
}, "userEmail")

const logout = action(async () => {
  "use server"
  const auth = await useAuthSession()
  const event = getRequestEvent()
  const current = auth.data.current
  if (current)
    await auth.update((val) => {
      delete val.account?.[current]
      const first = Object.keys(val.account ?? {})[0]
      val.current = first
      event!.locals.actor = undefined
      return val
    })
  throw redirect("/zen")
})

export default function WorkspaceLayout(props: RouteSectionProps) {
  const params = useParams()
  const userEmail = createAsync(() => getUserEmail(params.id))
  const sessionInfo = createAsync(() => querySessionInfo(params.id))
  return (
    <main data-page="workspace">
      <header data-component="workspace-header">
        <div data-slot="header-brand">
          <A href="/" data-component="site-title">
            <IconLogo />
          </A>
        </div>
        <div data-slot="header-actions">
          <Show when={sessionInfo()?.isBeta}>
            <WorkspacePicker />
          </Show>
          <span data-slot="user">{userEmail()}</span>
          <form action={logout} method="post">
            <button type="submit" formaction={logout}>
              Logout
            </button>
          </form>
        </div>
      </header>
      <div>{props.children}</div>
    </main>
  )
}
