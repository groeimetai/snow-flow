import { Billing } from "@opencode/cloud-core/billing.js"
import { Key } from "@opencode/cloud-core/key.js"
import { action, createAsync, revalidate, query, useAction, useSubmission } from "@solidjs/router"
import { createSignal, For, Show } from "solid-js"
import { getActor, withActor } from "~/context/auth"

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

//export const route = {
//  preload: () => listKeys(),
//}

export default function () {
  const actor = createAsync(() => getActor())
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

  return (
    <div>
      <h1>Actor</h1>
      <div>{JSON.stringify(actor())}</div>
      <h1>API Keys</h1>
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
    </div>
  )
}
