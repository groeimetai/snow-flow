import { createSignal, createMemo, onMount, Show } from "solid-js"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useTheme } from "@tui/context/theme"
import { TextAttributes, TextareaRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"

type AuthMethod = "servicenow-oauth" | "servicenow-basic" | "enterprise-portal" | "enterprise-license"

interface AuthCredentials {
  servicenow?: {
    instance: string
    clientId: string
    clientSecret: string
    accessToken?: string
    expiresAt?: number
  }
  servicenowBasic?: {
    instance: string
    username: string
    password: string
  }
  enterprise?: {
    subdomain?: string
    licenseKey?: string
    token?: string
    role?: string
  }
}

/**
 * Main auth dialog - shows available authentication methods
 */
export function DialogAuth() {
  const dialog = useDialog()
  const toast = useToast()
  const [credentials, setCredentials] = createSignal<AuthCredentials>({})

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
      } else if (snAuth?.type === "servicenow-basic") {
        setCredentials((prev) => ({
          ...prev,
          servicenowBasic: {
            instance: snAuth.instance,
            username: snAuth.username,
            password: snAuth.password,
          },
        }))
      }

      const entAuth = await Auth.get("enterprise")
      if (entAuth?.type === "enterprise") {
        setCredentials((prev) => ({
          ...prev,
          enterprise: {
            subdomain: entAuth.enterpriseUrl?.replace(/^https?:\/\//, "").replace(/\.snow-flow\.dev\/?$/, ""),
            licenseKey: entAuth.licenseKey,
            token: entAuth.token,
            role: entAuth.role,
          },
        }))
      }
    } catch {
      // Auth module not available
    }
  })

  const isServiceNowConfigured = createMemo(() => {
    const creds = credentials()
    return !!(
      (creds.servicenow?.accessToken && creds.servicenow.expiresAt && creds.servicenow.expiresAt > Date.now()) ||
      (creds.servicenowBasic?.username && creds.servicenowBasic?.password)
    )
  })

  const isEnterpriseConfigured = createMemo(() => {
    const creds = credentials()
    return !!(creds.enterprise?.token || creds.enterprise?.licenseKey)
  })

  const options: DialogSelectOption<AuthMethod>[] = [
    {
      title: "ServiceNow OAuth",
      value: "servicenow-oauth",
      description: isServiceNowConfigured() ? "Connected" : undefined,
      category: "ServiceNow",
      footer: "OAuth2 + PKCE",
      onSelect: () => {
        dialog.replace(() => <DialogAuthServiceNowOAuth />)
      },
    },
    {
      title: "ServiceNow Basic Auth",
      value: "servicenow-basic",
      description: credentials().servicenowBasic ? "Configured" : undefined,
      category: "ServiceNow",
      footer: "Username/Password",
      onSelect: () => {
        dialog.replace(() => <DialogAuthServiceNowBasic />)
      },
    },
    {
      title: "Enterprise Portal",
      value: "enterprise-portal",
      description: isEnterpriseConfigured() ? "Connected" : undefined,
      category: "Enterprise",
      footer: "Jira, Azure DevOps, Confluence",
      onSelect: () => {
        dialog.replace(() => <DialogAuthEnterprise />)
      },
    },
  ]

  return <DialogSelect title="ServiceNow Authentication" options={options} />
}

/**
 * ServiceNow OAuth dialog - multi-step input for OAuth credentials
 */
function DialogAuthServiceNowOAuth() {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()

  const [step, setStep] = createSignal<"instance" | "clientId" | "secret" | "authenticating">("instance")
  const [instance, setInstance] = createSignal("")
  const [clientId, setClientId] = createSignal("")
  const [clientSecret, setClientSecret] = createSignal("")

  let instanceInput: TextareaRenderable
  let clientIdInput: TextareaRenderable
  let secretInput: TextareaRenderable

  // Load existing credentials
  onMount(async () => {
    try {
      const { Auth } = await import("@/auth")
      const snAuth = await Auth.get("servicenow")
      if (snAuth?.type === "servicenow-oauth") {
        setInstance(snAuth.instance)
        setClientId(snAuth.clientId)
        setClientSecret(snAuth.clientSecret)
      }
    } catch {
      // Auth module not available
    }
    setTimeout(() => instanceInput?.focus(), 10)
  })

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      const currentStep = step()
      if (currentStep === "instance") {
        dialog.replace(() => <DialogAuth />)
      } else if (currentStep === "clientId") {
        setStep("instance")
        setTimeout(() => instanceInput?.focus(), 10)
      } else if (currentStep === "secret") {
        setStep("clientId")
        setTimeout(() => clientIdInput?.focus(), 10)
      }
    }
  })

  const handleAuthenticate = async () => {
    if (!instance() || !clientId() || !clientSecret()) {
      toast.show({
        variant: "error",
        message: "Please fill in all fields",
      })
      return
    }

    setStep("authenticating")
    try {
      const { ServiceNowOAuth } = await import("@/auth/servicenow-oauth")
      const oauth = new ServiceNowOAuth()
      const result = await oauth.authenticate({
        instance: instance(),
        clientId: clientId(),
        clientSecret: clientSecret(),
      })

      if (result.success) {
        toast.show({
          variant: "info",
          message: "ServiceNow connected! MCP server will be available on next restart.",
          duration: 5000,
        })
        dialog.clear()
      } else {
        toast.show({
          variant: "error",
          message: result.error ?? "Authentication failed",
          duration: 5000,
        })
        setStep("secret")
        setTimeout(() => secretInput?.focus(), 10)
      }
    } catch (e) {
      toast.show({
        variant: "error",
        message: e instanceof Error ? e.message : "Authentication failed",
        duration: 5000,
      })
      setStep("secret")
      setTimeout(() => secretInput?.focus(), 10)
    }
  }

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          ServiceNow OAuth
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>

      <Show when={step() === "instance"}>
        <box gap={1}>
          <text fg={theme.textMuted}>
            Enter your ServiceNow instance URL (e.g., dev12345 or dev12345.service-now.com)
          </text>
          <textarea
            ref={(val: TextareaRenderable) => (instanceInput = val)}
            height={3}
            initialValue={instance()}
            placeholder="dev12345.service-now.com"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setInstance(instanceInput.plainText)
              setStep("clientId")
              setTimeout(() => clientIdInput?.focus(), 10)
            }}
          />
          <text fg={theme.textMuted}>Press Enter to continue</text>
        </box>
      </Show>

      <Show when={step() === "clientId"}>
        <box gap={1}>
          <text fg={theme.textMuted}>
            OAuth Client ID from ServiceNow: System OAuth {">"} Application Registry
          </text>
          <textarea
            ref={(val: TextareaRenderable) => (clientIdInput = val)}
            height={3}
            initialValue={clientId()}
            placeholder="Enter OAuth Client ID"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setClientId(clientIdInput.plainText)
              setStep("secret")
              setTimeout(() => secretInput?.focus(), 10)
            }}
          />
          <text fg={theme.textMuted}>Instance: {instance()}</text>
          <text fg={theme.textMuted}>Press Enter to continue</text>
        </box>
      </Show>

      <Show when={step() === "secret"}>
        <box gap={1}>
          <text fg={theme.textMuted}>The client secret from your OAuth application</text>
          <textarea
            ref={(val: TextareaRenderable) => (secretInput = val)}
            height={3}
            initialValue={clientSecret()}
            placeholder="Enter OAuth Client Secret"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setClientSecret(secretInput.plainText)
              handleAuthenticate()
            }}
          />
          <text fg={theme.textMuted}>Instance: {instance()}</text>
          <text fg={theme.textMuted}>Client ID: {clientId()}</text>
          <text fg={theme.textMuted}>Press Enter to authenticate</text>
        </box>
      </Show>

      <Show when={step() === "authenticating"}>
        <box gap={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Authenticating...
          </text>
          <text fg={theme.textMuted}>Please complete the OAuth flow in your browser</text>
        </box>
      </Show>
    </box>
  )
}

/**
 * ServiceNow Basic Auth dialog
 */
function DialogAuthServiceNowBasic() {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()

  const [step, setStep] = createSignal<"instance" | "username" | "password">("instance")
  const [instance, setInstance] = createSignal("")
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")

  let instanceInput: TextareaRenderable
  let usernameInput: TextareaRenderable
  let passwordInput: TextareaRenderable

  // Load existing credentials
  onMount(async () => {
    try {
      const { Auth } = await import("@/auth")
      const snAuth = await Auth.get("servicenow")
      if (snAuth?.type === "servicenow-basic") {
        setInstance(snAuth.instance)
        setUsername(snAuth.username)
      }
    } catch {
      // Auth module not available
    }
    setTimeout(() => instanceInput?.focus(), 10)
  })

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      const currentStep = step()
      if (currentStep === "instance") {
        dialog.replace(() => <DialogAuth />)
      } else if (currentStep === "username") {
        setStep("instance")
        setTimeout(() => instanceInput?.focus(), 10)
      } else if (currentStep === "password") {
        setStep("username")
        setTimeout(() => usernameInput?.focus(), 10)
      }
    }
  })

  const handleSave = async () => {
    if (!instance() || !username() || !password()) {
      toast.show({
        variant: "error",
        message: "Please fill in all fields",
      })
      return
    }

    try {
      const { Auth } = await import("@/auth")

      // Normalize instance URL
      let normalizedInstance = instance().replace(/\/+$/, "")
      if (!normalizedInstance.startsWith("http://") && !normalizedInstance.startsWith("https://")) {
        normalizedInstance = `https://${normalizedInstance}`
      }
      if (!normalizedInstance.includes(".service-now.com") && !normalizedInstance.includes("localhost")) {
        normalizedInstance = `https://${normalizedInstance}.service-now.com`
      }

      await Auth.set("servicenow", {
        type: "servicenow-basic",
        instance: normalizedInstance,
        username: username(),
        password: password(),
      })

      toast.show({
        variant: "info",
        message: "ServiceNow credentials saved!",
        duration: 3000,
      })
      dialog.clear()
    } catch (e) {
      toast.show({
        variant: "error",
        message: e instanceof Error ? e.message : "Failed to save credentials",
        duration: 5000,
      })
    }
  }

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          ServiceNow Basic Auth
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>

      <Show when={step() === "instance"}>
        <box gap={1}>
          <text fg={theme.textMuted}>Enter your ServiceNow instance URL</text>
          <textarea
            ref={(val: TextareaRenderable) => (instanceInput = val)}
            height={3}
            initialValue={instance()}
            placeholder="dev12345.service-now.com"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setInstance(instanceInput.plainText)
              setStep("username")
              setTimeout(() => usernameInput?.focus(), 10)
            }}
          />
          <text fg={theme.textMuted}>Press Enter to continue</text>
        </box>
      </Show>

      <Show when={step() === "username"}>
        <box gap={1}>
          <text fg={theme.textMuted}>ServiceNow username</text>
          <textarea
            ref={(val: TextareaRenderable) => (usernameInput = val)}
            height={3}
            initialValue={username()}
            placeholder="admin"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setUsername(usernameInput.plainText)
              setStep("password")
              setTimeout(() => passwordInput?.focus(), 10)
            }}
          />
          <text fg={theme.textMuted}>Instance: {instance()}</text>
          <text fg={theme.textMuted}>Press Enter to continue</text>
        </box>
      </Show>

      <Show when={step() === "password"}>
        <box gap={1}>
          <text fg={theme.textMuted}>ServiceNow password</text>
          <textarea
            ref={(val: TextareaRenderable) => (passwordInput = val)}
            height={3}
            initialValue={password()}
            placeholder="Enter password"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setPassword(passwordInput.plainText)
              handleSave()
            }}
          />
          <text fg={theme.textMuted}>Instance: {instance()}</text>
          <text fg={theme.textMuted}>Username: {username()}</text>
          <text fg={theme.textMuted}>Press Enter to save</text>
        </box>
      </Show>
    </box>
  )
}

/**
 * Enterprise Portal dialog with browser-based device authorization flow
 */
function DialogAuthEnterprise() {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()

  const [step, setStep] = createSignal<"subdomain" | "browser" | "code" | "verifying">("subdomain")
  const [subdomain, setSubdomain] = createSignal("")
  const [sessionId, setSessionId] = createSignal("")
  const [authCode, setAuthCode] = createSignal("")

  let subdomainInput: TextareaRenderable
  let codeInput: TextareaRenderable

  // Load saved subdomain from existing enterprise config
  onMount(async () => {
    try {
      const { Auth } = await import("@/auth")
      const entAuth = await Auth.get("enterprise")
      if (entAuth?.type === "enterprise" && entAuth.enterpriseUrl) {
        // Extract subdomain from URL like https://acme.snow-flow.dev
        const match = entAuth.enterpriseUrl.match(/https?:\/\/([^.]+)\.snow-flow\.dev/)
        if (match) {
          setSubdomain(match[1])
        }
      }
    } catch {
      // Auth module not available
    }
    setTimeout(() => subdomainInput?.focus(), 10)
  })

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      const currentStep = step()
      if (currentStep === "subdomain") {
        dialog.replace(() => <DialogAuth />)
      } else if (currentStep === "browser" || currentStep === "code") {
        setStep("subdomain")
        setSessionId("")
        setAuthCode("")
        setTimeout(() => subdomainInput?.focus(), 10)
      }
    }
  })

  const startDeviceAuth = async () => {
    const sub = subdomain().trim().toLowerCase()
    if (!sub) {
      toast.show({ variant: "error", message: "Please enter your organization subdomain" })
      return
    }

    // Validate subdomain format (alphanumeric with optional hyphens, no leading/trailing hyphen)
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sub) && sub.length > 1) {
      toast.show({ variant: "error", message: "Invalid subdomain format" })
      return
    }
    // Single character subdomain is also valid
    if (sub.length === 1 && !/^[a-z0-9]$/.test(sub)) {
      toast.show({ variant: "error", message: "Invalid subdomain format" })
      return
    }

    const portalUrl = `https://${sub}.snow-flow.dev`

    try {
      // Get machine info
      const os = await import("os")
      const machineInfo = `${os.hostname()} (${os.platform()} ${os.arch()})`

      // Request device session
      const response = await fetch(`${portalUrl}/api/auth/device/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineInfo }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Failed to start device authorization")
      }

      const data = await response.json()
      setSessionId(data.sessionId)

      // Open browser with verification URL
      const { spawn } = await import("child_process")
      const url = data.verificationUrl
      if (process.platform === "darwin") {
        spawn("open", [url], { detached: true, stdio: "ignore" })
      } else if (process.platform === "win32") {
        spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" })
      } else {
        spawn("xdg-open", [url], { detached: true, stdio: "ignore" })
      }

      toast.show({ variant: "info", message: "Browser opened for verification", duration: 3000 })
      setStep("browser")

      // Auto-advance to code input after a moment
      setTimeout(() => {
        setStep("code")
        setTimeout(() => codeInput?.focus(), 10)
      }, 2000)
    } catch (e) {
      toast.show({ variant: "error", message: e instanceof Error ? e.message : "Failed to start auth" })
    }
  }

  const verifyAuthCode = async () => {
    const code = authCode().trim().toUpperCase()
    if (!code) {
      toast.show({ variant: "error", message: "Please enter the authorization code" })
      return
    }

    setStep("verifying")
    const sub = subdomain().trim().toLowerCase()
    const portalUrl = `https://${sub}.snow-flow.dev`

    try {
      const response = await fetch(`${portalUrl}/api/auth/device/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId(),
          authCode: code,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Verification failed")
      }

      const data = await response.json()

      // Save to Auth store
      const { Auth } = await import("@/auth")
      await Auth.set("enterprise", {
        type: "enterprise",
        token: data.token,
        enterpriseUrl: portalUrl,
        username: data.user?.username || data.user?.email,
        email: data.user?.email,
        role: data.user?.role,
      })

      const userName = data.user?.username || data.user?.email || data.customer?.name || "Enterprise"
      toast.show({
        variant: "info",
        message: `Connected as ${userName}! MCP server will be available on next restart.`,
        duration: 5000,
      })
      dialog.clear()
    } catch (e) {
      toast.show({ variant: "error", message: e instanceof Error ? e.message : "Verification failed" })
      setStep("code")
      setTimeout(() => codeInput?.focus(), 10)
    }
  }

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          Enterprise Portal
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>

      <Show when={step() === "subdomain"}>
        <box gap={1}>
          <text fg={theme.textMuted}>Enter your organization subdomain (e.g., "acme" for acme.snow-flow.dev)</text>
          <textarea
            ref={(val: TextareaRenderable) => (subdomainInput = val)}
            height={3}
            initialValue={subdomain()}
            placeholder="your-org"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setSubdomain(subdomainInput.plainText)
              startDeviceAuth()
            }}
          />
          <text fg={theme.textMuted}>Enterprise features include:</text>
          <text fg={theme.textMuted}>  - Jira, Azure DevOps, Confluence integration</text>
          <text fg={theme.textMuted}>  - Stakeholder read-only seats</text>
          <text fg={theme.textMuted}>  - Custom themes and branding</text>
          <box paddingTop={1} flexDirection="row">
            <text fg={theme.text}>enter </text>
            <text fg={theme.textMuted}>continue</text>
          </box>
        </box>
      </Show>

      <Show when={step() === "browser"}>
        <box gap={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Opening browser for verification...
          </text>
          <text fg={theme.textMuted}>URL: https://{subdomain()}.snow-flow.dev/device/authorize</text>
          <box paddingTop={1}>
            <text fg={theme.text}>After logging in on the portal:</text>
            <text fg={theme.textMuted}>  1. Click "Approve" to authorize this device</text>
            <text fg={theme.textMuted}>  2. Copy the authorization code shown</text>
          </box>
        </box>
      </Show>

      <Show when={step() === "code"}>
        <box gap={1}>
          <text fg={theme.textMuted}>Enter the authorization code from the portal</text>
          <textarea
            ref={(val: TextareaRenderable) => (codeInput = val)}
            height={3}
            initialValue={authCode()}
            placeholder="ABC-DEF-12"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setAuthCode(codeInput.plainText)
              verifyAuthCode()
            }}
          />
          <text fg={theme.textMuted}>Portal: https://{subdomain()}.snow-flow.dev</text>
          <box paddingTop={1} flexDirection="row">
            <text fg={theme.text}>enter </text>
            <text fg={theme.textMuted}>verify</text>
          </box>
        </box>
      </Show>

      <Show when={step() === "verifying"}>
        <box gap={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Verifying...
          </text>
          <text fg={theme.textMuted}>Validating authorization code with {subdomain()}.snow-flow.dev</text>
        </box>
      </Show>
    </box>
  )
}
