import { Billing } from "@opencode/cloud-core/billing.js"
import { Key } from "@opencode/cloud-core/key.js"
import { action, createAsync, revalidate, query, useAction, useSubmission } from "@solidjs/router"
import { createEffect, createSignal, For, onMount, Show } from "solid-js"
import { getActor } from "~/context/auth"
import { withActor } from "~/context/auth.withActor"
import "./index.css"

/////////////////////////////////////
// Keys related queries and actions
/////////////////////////////////////

const listKeys = query(async () => {
  "use server"
  return withActor(() => Key.list())
}, "keys")

const createKey = action(async (name: string) => {
  "use server"
  return withActor(() => Key.create({ name }))
}, "createKey")

const removeKey = action(async (id: string) => {
  "use server"
  return withActor(() => Key.remove({ id }))
}, "removeKey")

/////////////////////////////////////
// Billing related queries and actions
/////////////////////////////////////

const getBillingInfo = query(async () => {
  "use server"
  return withActor(async () => {
    const billing = await Billing.get()
    const payments = await Billing.payments()
    const usage = await Billing.usages()
    return { billing, payments, usage }
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
      revalidate("keys")
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
      revalidate("keys")
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
      {/* Actor Section */}
      <section data-slot="actor-section">
        <div data-slot="section-title">
          <h1>Actor</h1>
          <p>Current authenticated user information and session details.</p>
        </div>
        <div>{JSON.stringify(actor())}</div>
      </section>

      {/* API Keys Section */}
      <section data-slot="keys-section">
        <div data-slot="section-title">
          <h1>API Keys</h1>
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
          <h1>Balance</h1>
          <p>Manage your billing and add credits to your account.</p>
        </div>
        <div data-slot="balance">
          <p>
            {(() => {
              const balanceStr = ((billingInfo()?.billing?.balance ?? 0) / 100000000).toFixed(2)
              return `$${balanceStr === "-0.00" ? "0.00" : balanceStr}`
            })()}
          </p>
          <button color="primary" disabled={isLoading()} onClick={handleBuyCredits}>
            {isLoading() ? "Loading..." : "Buy Credits"}
          </button>
        </div>
      </section>

      {/* Payments Section */}
      <section data-slot="payments-section">
        <div data-slot="section-title">
          <h1>Payments History</h1>
          <p>Your recent payment transactions.</p>
        </div>
        <div data-slot="payments-list">
          <For
            each={billingInfo()?.payments}
            fallback={
              <div data-slot="empty-state">
                <p>No payment history yet. Your payments will appear here after your first purchase.</p>
              </div>
            }
          >
            {(payment) => (
              <div data-slot="payment-item">
                <span data-slot="payment-id">{payment.id}</span>
                {"  |  "}
                <span data-slot="payment-amount">${((payment.amount ?? 0) / 100000000).toFixed(2)}</span>
                {"  |  "}
                <span data-slot="payment-date">{new Date(payment.timeCreated).toLocaleDateString()}</span>
              </div>
            )}
          </For>
        </div>
      </section>

      {/* Usage Section */}
      <section data-slot="usage-section">
        <div data-slot="section-title">
          <h1>Usage History</h1>
          <p>Your recent API usage and costs.</p>
        </div>
        <div data-slot="usage-list">
          <For
            each={billingInfo()?.usage}
            fallback={
              <div data-slot="empty-state">
                <p>No API usage yet. Your usage history will appear here after your first API calls.</p>
              </div>
            }
          >
            {(usage) => (
              <div data-slot="usage-item">
                <span data-slot="usage-model">{usage.model}</span>
                {"  |  "}
                <span data-slot="usage-tokens">{usage.inputTokens + usage.outputTokens} tokens</span>
                {"  |  "}
                <span data-slot="usage-cost">${((usage.cost ?? 0) / 100000000).toFixed(4)}</span>
                {"  |  "}
                <span data-slot="usage-date">{new Date(usage.timeCreated).toLocaleDateString()}</span>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  )
}
