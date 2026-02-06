import { createSignal, onMount, Show, For } from "solid-js"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useTheme } from "@tui/context/theme"
import { TextAttributes, TextareaRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"

type Step =
  | "check-auth"
  | "discovering"
  | "select-endpoint"
  | "select-model"
  | "manual-url"
  | "manual-model"
  | "saving"

interface DiscoveredEndpoint {
  name: string
  sysId: string
  description?: string
}

interface DiscoveredModel {
  id: string
  name: string
  contextWindow?: number
}

/**
 * ServiceNow LLM (MID Server) configuration dialog.
 * Discovers available LLM endpoints and models from ServiceNow instance,
 * with manual fallback when the Snow-Flow API is not deployed.
 */
export function DialogAuthServiceNowLLM() {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()

  const [step, setStep] = createSignal<Step>("check-auth")
  const [instance, setInstance] = createSignal("")
  const [authToken, setAuthToken] = createSignal("")
  const [authType, setAuthType] = createSignal<"oauth" | "basic">("oauth")

  // Discovery results
  const [endpoints, setEndpoints] = createSignal<DiscoveredEndpoint[]>([])
  const [models, setModels] = createSignal<DiscoveredModel[]>([])

  // User selections
  const [selectedEndpoint, setSelectedEndpoint] = createSignal<DiscoveredEndpoint | null>(null)
  const [selectedModel, setSelectedModel] = createSignal<DiscoveredModel | null>(null)

  // Manual input
  const [manualUrl, setManualUrl] = createSignal("")
  const [manualModel, setManualModel] = createSignal("")

  let manualUrlInput: TextareaRenderable
  let manualModelInput: TextareaRenderable

  onMount(async () => {
    try {
      const { Auth } = await import("@/auth")
      const snAuth = await Auth.get("servicenow")

      if (!snAuth) {
        toast.show({
          variant: "error",
          message: "No ServiceNow auth configured. Please set up OAuth or Basic Auth first.",
          duration: 5000,
        })
        // Go back to auth menu after a moment
        setTimeout(async () => {
          const { DialogAuth } = await import("./dialog-auth")
          dialog.replace(() => <DialogAuth />)
        }, 2000)
        return
      }

      if (snAuth.type === "servicenow-oauth") {
        setInstance(snAuth.instance)
        setAuthType("oauth")
        if (snAuth.accessToken) {
          setAuthToken(snAuth.accessToken)
        }
      } else if (snAuth.type === "servicenow-basic") {
        setInstance(snAuth.instance)
        setAuthType("basic")
        setAuthToken(Buffer.from(`${snAuth.username}:${snAuth.password}`).toString("base64"))
      }

      // Also check if servicenow-llm is already configured
      const llmAuth = await Auth.get("servicenow-llm")
      if (llmAuth?.type === "mid-server") {
        setManualUrl(`${llmAuth.instance}/api/snow_flow/llm`)
        if (llmAuth.midServerName) {
          setManualModel(llmAuth.midServerName)
        }
      }

      // Start discovery
      setStep("discovering")
      await discoverEndpoints()
    } catch {
      toast.show({
        variant: "error",
        message: "Failed to load auth credentials",
        duration: 5000,
      })
    }
  })

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      const currentStep = step()
      if (currentStep === "check-auth" || currentStep === "discovering") {
        goBack()
      } else if (currentStep === "select-endpoint") {
        goBack()
      } else if (currentStep === "select-model") {
        if (endpoints().length > 0) {
          setStep("select-endpoint")
        } else {
          goBack()
        }
      } else if (currentStep === "manual-url") {
        goBack()
      } else if (currentStep === "manual-model") {
        setStep("manual-url")
        setTimeout(() => manualUrlInput?.focus(), 10)
      }
    }
  })

  const goBack = async () => {
    const { DialogAuth } = await import("./dialog-auth")
    dialog.replace(() => <DialogAuth />)
  }

  const getAuthHeaders = (): Record<string, string> => {
    if (authType() === "basic") {
      return { Authorization: `Basic ${authToken()}` }
    }
    return { Authorization: `Bearer ${authToken()}` }
  }

  const discoverEndpoints = async () => {
    const inst = instance()
    if (!inst || !authToken()) {
      setStep("manual-url")
      setTimeout(() => manualUrlInput?.focus(), 10)
      return
    }

    const headers = {
      ...getAuthHeaders(),
      Accept: "application/json",
    }

    // Try Snow-Flow API discovery first
    try {
      const response = await fetch(`${inst}/api/snow_flow/llm/rest-messages`, {
        method: "GET",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        const result = data?.result || data
        if (Array.isArray(result) && result.length > 0) {
          setEndpoints(result.map((item: any) => ({
            name: item.name || item.sys_name || item.id,
            sysId: item.sys_id || item.id,
            description: item.description || item.short_description,
          })))
          setStep("select-endpoint")
          return
        }
      }
    } catch {
      // API not available, try fallback
    }

    // Fallback: query sys_rest_message table directly
    try {
      const query = "active=true^nameSTARTSWITHllm^ORnameSTARTSWITHLLM^ORnameSTARTSWITHai^ORnameSTARTSWITHAI^ORnameLIKEmid"
      const response = await fetch(
        `${inst}/api/now/table/sys_rest_message?sysparm_query=${encodeURIComponent(query)}&sysparm_fields=sys_id,name,description&sysparm_limit=20`,
        { method: "GET", headers },
      )

      if (response.ok) {
        const data = await response.json()
        const result = data?.result
        if (Array.isArray(result) && result.length > 0) {
          setEndpoints(result.map((item: any) => ({
            name: item.name,
            sysId: item.sys_id,
            description: item.description,
          })))
          setStep("select-endpoint")
          return
        }
      }
    } catch {
      // Fallback failed too
    }

    // No endpoints discovered, go to manual input
    toast.show({
      variant: "info",
      message: "Auto-discovery unavailable. Please enter endpoint manually.",
      duration: 3000,
    })
    setStep("manual-url")
    setTimeout(() => manualUrlInput?.focus(), 10)
  }

  const discoverModels = async (endpoint: DiscoveredEndpoint) => {
    const inst = instance()
    const headers = {
      ...getAuthHeaders(),
      Accept: "application/json",
    }

    // Try Snow-Flow API model discovery
    try {
      const response = await fetch(
        `${inst}/api/snow_flow/llm/models?rest_message=${encodeURIComponent(endpoint.sysId)}`,
        { method: "GET", headers },
      )

      if (response.ok) {
        const data = await response.json()
        const result = data?.result || data
        if (Array.isArray(result) && result.length > 0) {
          setModels(result.map((item: any) => ({
            id: item.id || item.model_id || item.name,
            name: item.name || item.display_name || item.id,
            contextWindow: item.context_window || item.contextWindow,
          })))
          setStep("select-model")
          return
        }
      }
    } catch {
      // Model discovery failed
    }

    // Fallback to manual model input
    toast.show({
      variant: "info",
      message: "Model discovery unavailable. Please enter model ID manually.",
      duration: 3000,
    })
    setStep("manual-model")
    setTimeout(() => manualModelInput?.focus(), 10)
  }

  const handleEndpointSelect = async (endpoint: DiscoveredEndpoint) => {
    setSelectedEndpoint(endpoint)
    setStep("discovering")
    await discoverModels(endpoint)
  }

  const handleModelSelect = async (model: DiscoveredModel) => {
    setSelectedModel(model)
    await saveConfig(
      `${instance()}/api/snow_flow/llm`,
      model.id,
      model.name,
      model.contextWindow,
    )
  }

  const handleManualUrlSubmit = () => {
    const url = manualUrlInput.plainText.trim()
    if (!url) {
      toast.show({ variant: "error", message: "Please enter a base URL" })
      return
    }
    setManualUrl(url)
    setStep("manual-model")
    setTimeout(() => manualModelInput?.focus(), 10)
  }

  const handleManualModelSubmit = async () => {
    const modelId = manualModelInput.plainText.trim()
    if (!modelId) {
      toast.show({ variant: "error", message: "Please enter a model ID" })
      return
    }
    setManualModel(modelId)
    const baseURL = manualUrl() || `${instance()}/api/snow_flow/llm`
    await saveConfig(baseURL, modelId, modelId)
  }

  const saveConfig = async (
    baseURL: string,
    modelId: string,
    modelName: string,
    contextWindow?: number,
  ) => {
    setStep("saving")
    try {
      const { Config } = await import("@/config/config")

      // Save provider config via Config.update (merges into project config)
      await Config.update({
        provider: {
          "servicenow-llm": {
            name: "ServiceNow LLM",
            npm: "@ai-sdk/openai-compatible",
            api: baseURL,
            models: {
              [modelId]: {
                name: modelName,
                tool_call: true,
                temperature: true,
                reasoning: false,
                attachment: false,
                modalities: {
                  input: ["text"],
                  output: ["text"],
                },
                limit: {
                  context: contextWindow || 32000,
                  output: 4096,
                },
                cost: {
                  input: 0,
                  output: 0,
                },
              },
            },
            options: {
              baseURL,
              timeout: 180000,
            },
          },
        },
      } as any)

      toast.show({
        variant: "info",
        message: `ServiceNow LLM configured: ${modelName}`,
        duration: 5000,
      })
      dialog.clear()
    } catch (e) {
      toast.show({
        variant: "error",
        message: e instanceof Error ? e.message : "Failed to save configuration",
        duration: 5000,
      })
      setStep("manual-url")
      setTimeout(() => manualUrlInput?.focus(), 10)
    }
  }

  // Build endpoint options for DialogSelect
  const endpointOptions = (): DialogSelectOption<string>[] =>
    endpoints().map((ep) => ({
      title: ep.name,
      value: ep.sysId,
      description: ep.description,
      category: "REST Messages",
      onSelect: () => handleEndpointSelect(ep),
    }))

  // Build model options for DialogSelect
  const modelOptions = (): DialogSelectOption<string>[] =>
    models().map((m) => ({
      title: m.name,
      value: m.id,
      description: m.contextWindow ? `Context: ${m.contextWindow.toLocaleString()} tokens` : undefined,
      category: "Models",
      onSelect: () => handleModelSelect(m),
    }))

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          ServiceNow LLM (MID Server)
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>

      {/* Check auth */}
      <Show when={step() === "check-auth"}>
        <box gap={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Checking ServiceNow credentials...
          </text>
          <text fg={theme.textMuted}>Verifying OAuth or Basic Auth is configured</text>
        </box>
      </Show>

      {/* Discovering */}
      <Show when={step() === "discovering"}>
        <box gap={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Discovering LLM endpoints...
          </text>
          <text fg={theme.textMuted}>Instance: {instance()}</text>
          <text fg={theme.textMuted}>Searching for REST Messages and MID Server endpoints</text>
        </box>
      </Show>

      {/* Select endpoint */}
      <Show when={step() === "select-endpoint"}>
        <DialogSelect
          title="Select LLM Endpoint"
          options={[
            ...endpointOptions(),
            {
              title: "Enter manually",
              value: "__manual__",
              description: "Type a custom base URL",
              category: "Other",
              onSelect: () => {
                setStep("manual-url")
                setTimeout(() => manualUrlInput?.focus(), 10)
              },
            },
          ]}
        />
      </Show>

      {/* Select model */}
      <Show when={step() === "select-model"}>
        <DialogSelect
          title="Select Model"
          options={[
            ...modelOptions(),
            {
              title: "Enter manually",
              value: "__manual__",
              description: "Type a custom model ID",
              category: "Other",
              onSelect: () => {
                setStep("manual-model")
                setTimeout(() => manualModelInput?.focus(), 10)
              },
            },
          ]}
        />
      </Show>

      {/* Manual URL */}
      <Show when={step() === "manual-url"}>
        <box gap={1}>
          <text fg={theme.textMuted}>
            Enter the base URL for the LLM endpoint
          </text>
          <textarea
            ref={(val: TextareaRenderable) => (manualUrlInput = val)}
            height={3}
            initialValue={manualUrl() || `${instance()}/api/snow_flow/llm`}
            placeholder="https://instance.service-now.com/api/snow_flow/llm"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={handleManualUrlSubmit}
          />
          <text fg={theme.textMuted}>Instance: {instance()}</text>
          <text fg={theme.textMuted}>Press Enter to continue</text>
        </box>
      </Show>

      {/* Manual model */}
      <Show when={step() === "manual-model"}>
        <box gap={1}>
          <text fg={theme.textMuted}>
            Enter the model ID (e.g., qwen3-1.7b, llama3-8b, gpt-4o)
          </text>
          <textarea
            ref={(val: TextareaRenderable) => (manualModelInput = val)}
            height={3}
            initialValue={manualModel()}
            placeholder="qwen3-1.7b"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={handleManualModelSubmit}
          />
          <Show when={selectedEndpoint()}>
            <text fg={theme.textMuted}>Endpoint: {selectedEndpoint()!.name}</text>
          </Show>
          <text fg={theme.textMuted}>Press Enter to save</text>
        </box>
      </Show>

      {/* Saving */}
      <Show when={step() === "saving"}>
        <box gap={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Saving configuration...
          </text>
          <text fg={theme.textMuted}>Writing provider config to snow-code.jsonc</text>
        </box>
      </Show>
    </box>
  )
}
