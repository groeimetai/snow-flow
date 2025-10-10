import "./index.css"
import { NewUserSection } from "./new-user-section"
import { UsageSection } from "./usage-section"
import { ModelSection } from "./model-section"
import { ProviderSection } from "./provider-section"
import { IconLogo } from "~/component/icon"

export default function () {
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
        <ProviderSection />
        <UsageSection />
      </div>
    </div>
  )
}
