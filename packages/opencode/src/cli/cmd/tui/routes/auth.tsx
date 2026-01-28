import { createSignal, Show, For, createMemo, onMount } from "solid-js"
import { useRoute } from "@tui/context/route"
import { useTheme } from "@tui/context/theme"
import { useTerminalDimensions, useKeyboard } from "@opentui/solid"
import { TextAttributes, TextareaRenderable } from "@opentui/core"
import { Logo } from "@tui/component/logo"
import { useToast } from "@tui/ui/toast"

type AuthProvider = "servicenow" | "enterprise"
type AuthStep = "select" | "servicenow-instance" | "servicenow-clientid" | "servicenow-secret" | "enterprise-key" | "authenticating"

interface AuthCredentials {
  servicenow?: {
    instance: string
    clientId: string
    clientSecret: string
    accessToken?: string
    expiresAt?: number
  }
  enterprise?: {
    licenseKey: string
    token?: string
    role?: "developer" | "stakeholder" | "admin" | undefined
  }
}

export function Auth() {
  const route = useRoute()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const toast = useToast()

  const [step, setStep] = createSignal<AuthStep>("select")
  const [credentials, setCredentials] = createSignal<AuthCredentials>({})
  const [loading, setLoading] = createSignal(false)

  // Form state
  const [snInstance, setSnInstance] = createSignal("")
  const [snClientId, setSnClientId] = createSignal("")
  const [snClientSecret, setSnClientSecret] = createSignal("")
  const [entLicenseKey, setEntLicenseKey] = createSignal("")

  let instanceInput: TextareaRenderable
  let clientIdInput: TextareaRenderable
  let secretInput: TextareaRenderable
  let licenseInput: TextareaRenderable

  const isServiceNowConfigured = createMemo(() => {
    const creds = credentials()
    return !!(creds.servicenow?.accessToken && creds.servicenow.expiresAt && creds.servicenow.expiresAt > Date.now())
  })

  const isEnterpriseConfigured = createMemo(() => {
    const creds = credentials()
    return !!(creds.enterprise?.token || creds.enterprise?.licenseKey)
  })

  // Load existing credentials on mount
  onMount(async () => {
    try {
      const { Auth } = await import("@/auth")
      const snAuth = await Auth.get("servicenow")
      if (snAuth?.type === "servicenow-oauth") {
        setCredentials((prev) => ({
          ...prev,
          servicenow: {
            instance: snAuth.instance,
            clientId: snAuth.clientId,
            clientSecret: snAuth.clientSecret,
            accessToken: snAuth.accessToken,
            expiresAt: snAuth.expiresAt,
          },
        }))
        setSnInstance(snAuth.instance)
        setSnClientId(snAuth.clientId)
        setSnClientSecret(snAuth.clientSecret)
      }

      const entAuth = await Auth.get("enterprise")
      if (entAuth?.type === "enterprise") {
        const role = entAuth.role as "developer" | "stakeholder" | "admin" | undefined
        setCredentials((prev) => ({
          ...prev,
          enterprise: {
            licenseKey: entAuth.licenseKey ?? "",
            token: entAuth.token,
            role,
          },
        }))
        setEntLicenseKey(entAuth.licenseKey ?? "")
      }
    } catch {
      // Auth module not available
    }
  })

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      const currentStep = step()
      if (currentStep === "select") {
        route.navigate({ type: "home" })
      } else if (currentStep === "servicenow-instance") {
        setStep("select")
      } else if (currentStep === "servicenow-clientid") {
        setStep("servicenow-instance")
      } else if (currentStep === "servicenow-secret") {
        setStep("servicenow-clientid")
      } else if (currentStep === "enterprise-key") {
        setStep("select")
      } else {
        setStep("select")
      }
      return
    }

    if (step() === "select") {
      if (evt.name === "1" || evt.name === "s") {
        setStep("servicenow-instance")
        setTimeout(() => instanceInput?.focus(), 10)
      } else if (evt.name === "2" || evt.name === "e") {
        setStep("enterprise-key")
        setTimeout(() => licenseInput?.focus(), 10)
      }
    }
  })

  const handleServiceNowLogin = async () => {
    if (!snInstance() || !snClientId() || !snClientSecret()) {
      toast.show({
        variant: "error",
        message: "Please fill in all ServiceNow fields",
      })
      return
    }

    setStep("authenticating")
    setLoading(true)
    try {
      const { ServiceNowOAuth } = await import("@/servicenow")
      const oauth = new ServiceNowOAuth()
      const result = await oauth.authenticate({
        instance: snInstance(),
        clientId: snClientId(),
        clientSecret: snClientSecret(),
      })

      if (result.success) {
        // Save credentials to auth store
        const { Auth } = await import("@/auth")
        await Auth.set("servicenow", {
          type: "servicenow-oauth",
          instance: snInstance(),
          clientId: snClientId(),
          clientSecret: snClientSecret(),
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresIn ? Date.now() + result.expiresIn * 1000 : undefined,
        })

        toast.show({
          variant: "info",
          message: "ServiceNow connected! MCP server will be available on next restart.",
          duration: 5000,
        })
        setCredentials((prev) => ({
          ...prev,
          servicenow: {
            instance: snInstance(),
            clientId: snClientId(),
            clientSecret: snClientSecret(),
            accessToken: result.accessToken,
            expiresAt: result.expiresIn ? Date.now() + result.expiresIn * 1000 : undefined,
          },
        }))
        setStep("select")
      } else {
        toast.show({
          variant: "error",
          message: result.error ?? "Authentication failed",
          duration: 5000,
        })
        setStep("servicenow-secret")
      }
    } catch (e) {
      toast.show({
        variant: "error",
        message: e instanceof Error ? e.message : "Authentication failed",
        duration: 5000,
      })
      setStep("servicenow-secret")
    } finally {
      setLoading(false)
    }
  }

  const handleEnterpriseLogin = async () => {
    if (!entLicenseKey()) {
      toast.show({
        variant: "error",
        message: "Please enter your license key",
      })
      return
    }

    if (!entLicenseKey().startsWith("SNOW-ENT-") && !entLicenseKey().startsWith("SNOW-SI-")) {
      toast.show({
        variant: "error",
        message: "Invalid license key format. Must start with SNOW-ENT- or SNOW-SI-",
      })
      return
    }

    setStep("authenticating")
    setLoading(true)
    try {
      const { Auth } = await import("@/auth")
      await Auth.set("enterprise", {
        type: "enterprise",
        licenseKey: entLicenseKey(),
      })

      toast.show({
        variant: "info",
        message: "Enterprise license configured!",
        duration: 3000,
      })
      setCredentials((prev) => ({
        ...prev,
        enterprise: {
          licenseKey: entLicenseKey(),
        },
      }))
      setStep("select")
    } catch (e) {
      toast.show({
        variant: "error",
        message: e instanceof Error ? e.message : "Failed to save license",
        duration: 5000,
      })
      setStep("enterprise-key")
    } finally {
      setLoading(false)
    }
  }

  const providers = [
    {
      id: "servicenow" as const,
      name: "ServiceNow",
      description: "Connect to your ServiceNow instance with OAuth2",
      configured: isServiceNowConfigured,
      key: "1",
    },
    {
      id: "enterprise" as const,
      name: "Enterprise",
      description: "Access Jira, Azure DevOps, Confluence integrations",
      configured: isEnterpriseConfigured,
      key: "2",
    },
  ]

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={theme.background}
      flexDirection="column"
      padding={2}
    >
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={2}>
        <box flexDirection="row" gap={1} alignItems="center">
          <Logo />
          <text attributes={TextAttributes.BOLD} fg={theme.text}>
            {" "}Authentication
          </text>
        </box>
        <text fg={theme.textMuted}>esc to go back</text>
      </box>

      {/* Provider Selection */}
      <Show when={step() === "select"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Select authentication provider:
          </text>
          <box height={1} />
          <For each={providers}>
            {(provider) => (
              <box
                flexDirection="row"
                gap={2}
                padding={1}
                backgroundColor={theme.backgroundPanel}
              >
                <text fg={theme.primary} attributes={TextAttributes.BOLD}>
                  [{provider.key}]
                </text>
                <box flexDirection="column">
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.text} attributes={TextAttributes.BOLD}>
                      {provider.name}
                    </text>
                    <Show when={provider.configured()}>
                      <text fg={theme.success}>Connected</text>
                    </Show>
                  </box>
                  <text fg={theme.textMuted}>{provider.description}</text>
                </box>
              </box>
            )}
          </For>
        </box>
      </Show>

      {/* ServiceNow Instance Step */}
      <Show when={step() === "servicenow-instance"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            ServiceNow Instance URL
          </text>
          <text fg={theme.textMuted}>
            Enter your ServiceNow instance URL (e.g., dev12345 or dev12345.service-now.com)
          </text>
          <box height={1} />
          <textarea
            ref={(val: TextareaRenderable) => (instanceInput = val)}
            height={3}
            initialValue={snInstance()}
            placeholder="dev12345.service-now.com"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setSnInstance(instanceInput.plainText)
              setStep("servicenow-clientid")
              setTimeout(() => clientIdInput?.focus(), 10)
            }}
          />
          <text fg={theme.textMuted}>Press Enter to continue</text>
        </box>
      </Show>

      {/* ServiceNow Client ID Step */}
      <Show when={step() === "servicenow-clientid"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            OAuth Client ID
          </text>
          <text fg={theme.textMuted}>
            From ServiceNow: System OAuth {">"} Application Registry
          </text>
          <box height={1} />
          <textarea
            ref={(val: TextareaRenderable) => (clientIdInput = val)}
            height={3}
            initialValue={snClientId()}
            placeholder="Enter OAuth Client ID"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setSnClientId(clientIdInput.plainText)
              setStep("servicenow-secret")
              setTimeout(() => secretInput?.focus(), 10)
            }}
          />
          <text fg={theme.textMuted}>Press Enter to continue</text>
        </box>
      </Show>

      {/* ServiceNow Client Secret Step */}
      <Show when={step() === "servicenow-secret"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            OAuth Client Secret
          </text>
          <text fg={theme.textMuted}>
            The client secret from your OAuth application
          </text>
          <box height={1} />
          <textarea
            ref={(val: TextareaRenderable) => (secretInput = val)}
            height={3}
            initialValue={snClientSecret()}
            placeholder="Enter OAuth Client Secret"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setSnClientSecret(secretInput.plainText)
              handleServiceNowLogin()
            }}
          />
          <box height={1} />
          <text fg={theme.textMuted}>Instance: {snInstance()}</text>
          <text fg={theme.textMuted}>Client ID: {snClientId()}</text>
          <text fg={theme.textMuted}>Press Enter to authenticate</text>
        </box>
      </Show>

      {/* Enterprise License Key Step */}
      <Show when={step() === "enterprise-key"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Enterprise License Key
          </text>
          <text fg={theme.textMuted}>
            Enter your Snow-Flow Enterprise license key
          </text>
          <box height={1} />
          <textarea
            ref={(val: TextareaRenderable) => (licenseInput = val)}
            height={3}
            initialValue={entLicenseKey()}
            placeholder="SNOW-ENT-XXXX-XXXX"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setEntLicenseKey(licenseInput.plainText)
              handleEnterpriseLogin()
            }}
          />
          <box height={1} />
          <text fg={theme.textMuted}>Enterprise features include:</text>
          <text fg={theme.textMuted}>- Jira, Azure DevOps, Confluence integration</text>
          <text fg={theme.textMuted}>- Stakeholder read-only seats</text>
          <text fg={theme.textMuted}>Press Enter to validate</text>
        </box>
      </Show>

      {/* Authenticating */}
      <Show when={step() === "authenticating"}>
        <box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Authenticating...
          </text>
          <text fg={theme.textMuted}>
            Please complete the OAuth flow in your browser
          </text>
        </box>
      </Show>
    </box>
  )
}
