import { Billing } from "@opencode/cloud-core/billing.js"
import { Key } from "@opencode/cloud-core/key.js"
import { action, createAsync, revalidate, query, useAction, useSubmission, json } from "@solidjs/router"
import { createEffect, createSignal, For, onMount, Show } from "solid-js"
import { getActor } from "~/context/auth"
import { withActor } from "~/context/auth.withActor"
import "./index.css"
import { User } from "@opencode/cloud-core/user.js"
import { Actor } from "@opencode/cloud-core/actor.js"

/////////////////////////////////////
// Keys related queries and actions
/////////////////////////////////////

const listKeys = query(async () => {
  "use server"
  return withActor(() => Key.list())
}, "keys")

const createKey = action(async (name: string) => {
  "use server"
  return json(
    withActor(() => Key.create({ name })),
    { revalidate: "keys" },
  )
}, "createKey")

const removeKey = action(async (id: string) => {
  "use server"
  return json(
    withActor(() => Key.remove({ id })),
    { revalidate: "keys" },
  )
}, "removeKey")

/////////////////////////////////////
// Billing related queries and actions
/////////////////////////////////////

const getBillingInfo = query(async () => {
  "use server"
  return withActor(async () => {
    const actor = Actor.assert("user")
    const [user, billing, payments, usage] = await Promise.all([
      User.fromID(actor.properties.userID),
      Billing.get(),
      Billing.payments(),
      Billing.usages(),
    ])
    return { user, billing, payments, usage }
  })
}, "billingInfo")

const createCheckoutUrl = action(async (successUrl: string, cancelUrl: string) => {
  "use server"
  return withActor(() => Billing.generateCheckoutUrl({ successUrl, cancelUrl }))
}, "checkoutUrl")

const createPortalUrl = action(async (returnUrl: string) => {
  "use server"
  return withActor(() => Billing.generatePortalUrl({ returnUrl }))
}, "portalUrl")

const dummyUsageData = [
  {
    model: "claude-3-5-sonnet-20241022",
    inputTokens: 1250,
    outputTokens: 890,
    reasoningTokens: 150,
    cacheReadTokens: 0,
    cacheWriteTokens: 45,
    cost: 12340000,
    timeCreated: new Date("2025-01-28T10:30:00Z"),
  },
  {
    model: "claude-3-haiku-20240307",
    inputTokens: 2100,
    outputTokens: 450,
    reasoningTokens: null,
    cacheReadTokens: 120,
    cacheWriteTokens: 0,
    cost: 5670000,
    timeCreated: new Date("2025-01-27T15:22:00Z"),
  },
  {
    model: "claude-3-5-sonnet-20241022",
    inputTokens: 850,
    outputTokens: 1200,
    reasoningTokens: 220,
    cacheReadTokens: 30,
    cacheWriteTokens: 15,
    cost: 18990000,
    timeCreated: new Date("2025-01-27T09:15:00Z"),
  },
  {
    model: "claude-3-opus-20240229",
    inputTokens: 3200,
    outputTokens: 1800,
    reasoningTokens: 400,
    cacheReadTokens: 0,
    cacheWriteTokens: 100,
    cost: 45670000,
    timeCreated: new Date("2025-01-26T14:45:00Z"),
  },
  {
    model: "claude-3-haiku-20240307",
    inputTokens: 650,
    outputTokens: 280,
    reasoningTokens: null,
    cacheReadTokens: 200,
    cacheWriteTokens: 0,
    cost: 2340000,
    timeCreated: new Date("2025-01-25T16:18:00Z"),
  },
]

const dummyPaymentData = [
  {
    id: "pay_1Ab2Cd3Ef4Gh5678",
    amount: 2000000000,
    timeCreated: new Date("2025-01-28T14:32:00Z"),
  },
  {
    id: "pay_9Ij8Kl7Mn6Op5432",
    amount: 1000000000,
    timeCreated: new Date("2025-01-25T09:18:00Z"),
  },
  {
    id: "pay_5Qr4St3Uv2Wx1098",
    amount: 5000000000,
    timeCreated: new Date("2025-01-20T16:45:00Z"),
  },
  {
    id: "pay_7Yz6Ab5Cd4Ef3210",
    amount: 1500000000,
    timeCreated: new Date("2025-01-15T11:22:00Z"),
  },
  {
    id: "pay_3Gh2Ij1Kl0Mn9876",
    amount: 3000000000,
    timeCreated: new Date("2025-01-10T13:55:00Z"),
  },
]

export default function () {
  const actor = createAsync(() => getActor())
  onMount(() => {
    console.log("MOUNTED", actor())
  })

  /////////////////
  // Keys section
  /////////////////
  const keys = createAsync(() => listKeys())
  const createKeyAction = useAction(createKey)
  const removeKeyAction = useAction(removeKey)
  const createKeySubmission = useSubmission(createKey)
  const [showCreateForm, setShowCreateForm] = createSignal(false)
  const [keyName, setKeyName] = createSignal("")

  const formatDate = (date: Date) => {
    return date.toLocaleDateString()
  }

  const formatDateForTable = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
    return date.toLocaleDateString("en-GB", options).replace(",", ",")
  }

  const formatDateUTC = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
      timeZone: "UTC",
    }
    return date.toLocaleDateString("en-US", options)
  }

  const formatKey = (key: string) => {
    if (key.length <= 11) return key
    return `${key.slice(0, 7)}...${key.slice(-4)}`
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error("Failed to copy to clipboard:", error)
    }
  }

  const handleCreateKey = async () => {
    if (!keyName().trim()) return

    try {
      await createKeyAction(keyName().trim())
      setKeyName("")
      setShowCreateForm(false)
    } catch (error) {
      console.error("Failed to create API key:", error)
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return
    }

    try {
      await removeKeyAction(keyId)
    } catch (error) {
      console.error("Failed to delete API key:", error)
    }
  }

  /////////////////
  // Billing section
  /////////////////
  const billingInfo = createAsync(() => getBillingInfo())
  const [isLoading, setIsLoading] = createSignal(false)
  const createCheckoutUrlAction = useAction(createCheckoutUrl)

  // Run once on component mount to check URL parameters
  onMount(() => {
    const url = new URL(window.location.href)
    const result = url.hash

    console.log("STRIPE RESULT", result)

    if (url.hash === "#success") {
      setIsLoading(true)
      // Remove the hash from the URL
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
    }
  })

  createEffect((old?: number) => {
    if (old && old !== billingInfo()?.billing?.balance) {
      setIsLoading(false)
    }
    return billingInfo()?.billing?.balance
  })

  const handleBuyCredits = async () => {
    try {
      setIsLoading(true)
      const baseUrl = window.location.href
      const successUrl = new URL(baseUrl)
      successUrl.hash = "success"

      const checkoutUrl = await createCheckoutUrlAction(successUrl.toString(), baseUrl)
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      }
    } catch (error) {
      console.error("Failed to get checkout URL:", error)
      setIsLoading(false)
    }
  }

  return (
    <div data-slot="root">
      {/* Title */}
      <section data-slot="title-section">
        <h1>Gateway</h1>
        <p>
          Coding models optimized for use with opencode. <a href="/docs">Learn more</a>.
        </p>
      </section>

      <div data-slot="sections">
        {/* Actor Section */}
        <section data-slot="actor-section">
          <div data-slot="section-title">
            <h2>Actor</h2>
            <p>Current authenticated user information and session details.</p>
          </div>
          <div>{JSON.stringify(actor())}</div>
        </section>

        {/* API Keys Section */}
        <section data-slot="keys-section">
          <div data-slot="section-title">
            <h2>API Keys</h2>
            <p>Manage your API keys for accessing opencode services.</p>
          </div>
          <Show
            when={!showCreateForm()}
            fallback={
              <div data-slot="create-form">
                <input
                  data-component="input"
                  type="text"
                  placeholder="Enter key name"
                  value={keyName()}
                  onInput={(e) => setKeyName(e.currentTarget.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleCreateKey()}
                />
                <div data-slot="form-actions">
                  <button
                    color="primary"
                    disabled={createKeySubmission.pending || !keyName().trim()}
                    onClick={handleCreateKey}
                  >
                    {createKeySubmission.pending ? "Creating..." : "Create"}
                  </button>
                  <button
                    color="ghost"
                    onClick={() => {
                      setShowCreateForm(false)
                      setKeyName("")
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            }
          >
            <button
              color="primary"
              onClick={() => {
                console.log("clicked")
                setShowCreateForm(true)
              }}
            >
              Create API Key
            </button>
          </Show>
          <div data-slot="key-list">
            <For
              each={keys()}
              fallback={
                <div data-slot="empty-state">
                  <p>Create an API key to access opencode gateway</p>
                </div>
              }
            >
              {(key) => (
                <div data-slot="key-item">
                  <div data-slot="key-info">
                    <div data-slot="key-name">{key.name}</div>
                    <div data-slot="key-value">{formatKey(key.key)}</div>
                    <div data-slot="key-meta">
                      Created: {formatDate(key.timeCreated)}
                      {key.timeUsed && ` • Last used: ${formatDate(key.timeUsed)}`}
                    </div>
                  </div>
                  <div data-slot="key-actions">
                    <button color="ghost" onClick={() => copyToClipboard(key.key)} title="Copy API key">
                      Copy
                    </button>
                    <button color="ghost" onClick={() => handleDeleteKey(key.id)} title="Delete API key">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>

        {/* Balance Section */}
        <section data-slot="balance-section">
          <div data-slot="section-title">
            <h2>Balance</h2>
            <p>Add credits to your account.</p>
          </div>
          <div data-slot="balance">
            <div
              data-slot="amount"
              classList={{
                danger: (() => {
                  const balanceStr = ((billingInfo()?.billing?.balance ?? 0) / 100000000).toFixed(2)
                  return balanceStr === "0.00" || balanceStr === "-0.00"
                })(),
              }}
            >
              <span data-slot="currency">$</span>
              <span data-slot="value">
                {(() => {
                  const balanceStr = ((billingInfo()?.billing?.balance ?? 0) / 100000000).toFixed(2)
                  return balanceStr === "-0.00" ? "0.00" : balanceStr
                })()}
              </span>
            </div>
            <button color="primary" disabled={isLoading()} onClick={handleBuyCredits}>
              {isLoading() ? "Loading..." : "Buy Credits"}
            </button>
          </div>
        </section>

        {/* Payments Section */}
        <Show when={dummyPaymentData.length > 0}>
          {/* Real data condition: billingInfo() && billingInfo()!.payments.length > 0 */}
          <section data-slot="payments-section">
            <div data-slot="section-title">
              <h2>Payments History</h2>
              <p>Recent payment transactions.</p>
            </div>
            <div data-slot="payments-table">
              <table data-slot="payments-table-element">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Payment ID</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={dummyPaymentData}>
                    {/* Real data: billingInfo()?.payments */}
                    {(payment) => {
                      const date = new Date(payment.timeCreated)
                      return (
                        <tr>
                          <td data-slot="payment-date" title={formatDateUTC(date)}>
                            {formatDateForTable(date)}
                          </td>
                          <td data-slot="payment-id">{payment.id}</td>
                          <td data-slot="payment-amount">${((payment.amount ?? 0) / 100000000).toFixed(2)}</td>
                        </tr>
                      )
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </section>
        </Show>

        {/* Usage Section */}
        <section data-slot="usage-section">
          <div data-slot="section-title">
            <h2>Usage History</h2>
            <p>Recent API usage and costs.</p>
          </div>
          <div data-slot="usage-table">
            <Show
              when={dummyUsageData.length > 0}
              fallback={
                <div data-slot="empty-state">
                  <p>Make your first API call to get started.</p>
                </div>
              }
            >
              <table data-slot="usage-table-element">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Model</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={dummyUsageData}>
                    {(usage) => {
                      const totalTokens = usage.inputTokens + usage.outputTokens + (usage.reasoningTokens || 0)
                      const date = new Date(usage.timeCreated)
                      return (
                        <tr>
                          <td data-slot="usage-date" title={formatDateUTC(date)}>
                            {formatDateForTable(date)}
                          </td>
                          <td data-slot="usage-model">{usage.model}</td>
                          <td data-slot="usage-tokens">{totalTokens.toLocaleString()}</td>
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
      </div>
    </div>
  )
}
