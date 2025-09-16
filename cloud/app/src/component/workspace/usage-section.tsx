import { Billing } from "@opencode/cloud-core/billing.js"
import { query, useParams, createAsync } from "@solidjs/router"
import { createMemo, For, Show } from "solid-js"
import { formatDateUTC, formatDateForTable } from "./common"
import { withActor } from "~/context/auth.withActor"

const getUsageInfo = query(async (workspaceID: string) => {
  "use server"
  return withActor(async () => {
    return await Billing.usages()
  }, workspaceID)
}, "usage.list")

export function UsageSection() {
  const params = useParams()
  const usage = createAsync(() => getUsageInfo(params.id))

  return (
    <section data-component="usage-section">
      <div data-slot="section-title">
        <h2>Usage History</h2>
        <p>Recent API usage and costs.</p>
      </div>
      <div data-slot="usage-table">
        <Show
          when={usage() && usage()!.length > 0}
          fallback={
            <div data-component="empty-state">
              <p>Make your first API call to get started.</p>
            </div>
          }
        >
          <table data-slot="usage-table-element">
            <thead>
              <tr>
                <th>Date</th>
                <th>Model</th>
                <th>Input</th>
                <th>Output</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              <For each={usage()!}>
                {(usage) => {
                  const date = createMemo(() => new Date(usage.timeCreated))
                  return (
                    <tr>
                      <td data-slot="usage-date" title={formatDateUTC(date())}>
                        {formatDateForTable(date())}
                      </td>
                      <td data-slot="usage-model">{usage.model}</td>
                      <td data-slot="usage-tokens">{usage.inputTokens}</td>
                      <td data-slot="usage-tokens">{usage.outputTokens}</td>
                      <td data-slot="usage-cost">${((usage.cost ?? 0) / 100000000).toFixed(4)}</td>
                    </tr>
                  )
                }}
              </For>
            </tbody>
          </table>
        </Show>
      </div>
    </section>
  )
}
