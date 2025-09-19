import { json, query, action, useParams, createAsync, useSubmission } from "@solidjs/router"
import { withActor } from "~/context/auth.withActor"
import styles from "./billing-section.module.css"
import { Database, eq } from "@opencode/console-core/drizzle/index.js"
import { WorkspaceTable } from "@opencode/console-core/schema/workspace.sql.js"
import { Show } from "solid-js"

const updateShare = action(async (form: FormData) => {
  "use server"
  const workspaceID = form.get("workspaceID")?.toString()
  if (!workspaceID) return { error: "Workspace ID is required" }
  const dataShare = form.get("dataShare")?.toString() === "true" ? true : null
  return json(
    await withActor(() => {
      return Database.use((tx) =>
        tx
          .update(WorkspaceTable)
          .set({
            dataShare,
          })
          .where(eq(WorkspaceTable.id, workspaceID)),
      )
    }, workspaceID),
    { revalidate: getWorkspaceInfo.key },
  )
}, "workspace.disableShare")

const getWorkspaceInfo = query(async (workspaceID: string) => {
  "use server"
  return withActor(() => {
    return Database.use((tx) =>
      tx
        .select({
          dataShare: WorkspaceTable.dataShare,
        })
        .from(WorkspaceTable)
        .where(eq(WorkspaceTable.id, workspaceID))
        .then((r) => r[0]),
    )
  }, workspaceID)
}, "workspace.get")

export function PrivacySection() {
  const params = useParams()
  const workspaceInfo = createAsync(() => getWorkspaceInfo(params.id))
  const updateShareSubmission = useSubmission(updateShare)

  return (
    <section class={styles.root}>
      <div data-slot="section-title">
        <h2>Privacy controls</h2>
        <p>
          Some providers offer data-sharing programs. If you opt in, you voluntarily <b>share your usage data</b> with
          them, which they may use to improve their services, including <b>model training</b>.
        </p>
        <br />
        <p>
          By opting in, you gain access to <b>discounted pricing</b> from the provider. You can opt in or out at any
          time.
        </p>
        <br />
        <p>
          <a target="_blank" href="/docs/zen">
            Learn more
          </a>
        </p>
      </div>
      <Show when={workspaceInfo()?.dataShare}>
        <div data-slot="payment">
          <div data-slot="credit-card">
            <div data-slot="card-details">
              <span data-slot="number">You are currently opted in to the data-sharing program.</span>
            </div>
          </div>
        </div>
      </Show>
      <div data-slot="section-content">
        <div data-slot="payment">
          <div data-slot="button-row">
            <form action={updateShare} method="post" data-slot="create-form">
              <input type="hidden" name="workspaceID" value={params.id} />
              <input type="hidden" name="dataShare" value={workspaceInfo()?.dataShare ? "false" : "true"} />
              <button data-color="ghost" type="submit" disabled={updateShareSubmission.pending}>
                {workspaceInfo()?.dataShare
                  ? updateShareSubmission.pending
                    ? "Opting out..."
                    : "Opt out"
                  : updateShareSubmission.pending
                    ? "Opting in..."
                    : "Opt in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
