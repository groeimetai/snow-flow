import "./index.css"
import { NewUserSection } from "./new-user-section"
import { UsageSection } from "./usage-section"
import { ModelSection } from "./model-section"
import { ProviderSection } from "./provider-section"
import { IconLogo } from "~/component/icon"
import { createAsync, useParams } from "@solidjs/router"
import { querySessionInfo } from "../common"
import { Show } from "solid-js"

export default function () {
  const params = useParams()
  const userInfo = createAsync(() => querySessionInfo(params.id))

  return (
    <div data-page="workspace-[id]">
      <section data-component="title-section">
        <IconLogo />
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
        <ModelSection />
        <Show when={userInfo()?.isAdmin}>
          <ProviderSection />
        </Show>
        <UsageSection />
      </div>
    </div>
  )
}
