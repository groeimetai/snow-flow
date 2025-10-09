import "./index.css"
import { NewUserSection } from "./new-user-section"
import { UsageSection } from "./usage-section"
import { MemberSection } from "./members/member-section"
import { SettingsSection } from "./settings/settings-section"
import { ModelSection } from "./model-section"
import { ProviderSection } from "./provider-section"
import { Show } from "solid-js"
import { createAsync, useParams } from "@solidjs/router"
import { querySessionInfo } from "../common"

export default function () {
  const params = useParams()
  const userInfo = createAsync(() => querySessionInfo(params.id))

  return (
    <div data-page="workspace-[id]">
      <section data-component="title-section">
        <h1>Zen</h1>
        <p>
          Curated list of models provided by opencode.{" "}
          <a target="_blank" href="/docs/zen">
            Learn more
          </a>
          .
        </p>
      </section>

      <div data-slot="sections">
        <NewUserSection />
        <Show when={userInfo()?.isAdmin}>
          <ModelSection />
          <ProviderSection />
        </Show>
        <UsageSection />
      </div>
    </div>
  )
}
