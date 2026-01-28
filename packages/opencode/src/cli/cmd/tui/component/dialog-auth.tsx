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
 * Enterprise Portal dialog with portal prefix and device auth flow
 */
function DialogAuthEnterprise() {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()

  const [step, setStep] = createSignal<"subdomain" | "authenticating" | "license">("subdomain")
  const [subdomain, setSubdomain] = createSignal("")
  const [licenseKey, setLicenseKey] = createSignal("")

  let subdomainInput: TextareaRenderable
  let licenseInput: TextareaRenderable

  // Load existing credentials
  onMount(async () => {
    try {
      const { Auth } = await import("@/auth")
      const entAuth = await Auth.get("enterprise")
      if (entAuth?.type === "enterprise") {
        if (entAuth.enterpriseUrl) {
          const match = entAuth.enterpriseUrl.match(/^https?:\/\/([^.]+)\.snow-flow\.dev/)
          if (match) {
            setSubdomain(match[1])
          }
        }
        if (entAuth.licenseKey) {
          setLicenseKey(entAuth.licenseKey)
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
      } else if (currentStep === "license") {
        setStep("subdomain")
        setTimeout(() => subdomainInput?.focus(), 10)
      }
    }
  })

  const validateSubdomain = (value: string): string | undefined => {
    if (!value || value.trim() === "") {
      return "Portal subdomain is required"
    }
    // Subdomain format: alphanumeric with hyphens, not starting/ending with hyphen
    const pattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/
    if (!pattern.test(value.toLowerCase())) {
      return "Invalid subdomain format (use lowercase letters, numbers, hyphens)"
    }
    return undefined
  }

  const handleDeviceAuth = async () => {
    const validation = validateSubdomain(subdomain())
    if (validation) {
      toast.show({
        variant: "error",
        message: validation,
      })
      return
    }

    setStep("authenticating")

    try {
      const portalUrl = `https://${subdomain().toLowerCase()}.snow-flow.dev`

      // Request device authorization
      const deviceResponse = await fetch(`${portalUrl}/api/auth/device/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "snow-code" }),
      })

      if (!deviceResponse.ok) {
        throw new Error(`Portal returned ${deviceResponse.status}: ${await deviceResponse.text()}`)
      }

      const deviceData = await deviceResponse.json()
      const { device_code, user_code, verification_uri, verification_uri_complete, interval = 5 } = deviceData

      // Open browser for user verification
      toast.show({
        variant: "info",
        message: `Opening browser for verification. Code: ${user_code}`,
        duration: 10000,
      })

      // Open browser
      const { spawn } = require("child_process")
      const url = verification_uri_complete || verification_uri
      if (process.platform === "darwin") {
        spawn("open", [url], { detached: true, stdio: "ignore" })
      } else if (process.platform === "win32") {
        spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" })
      } else {
        spawn("xdg-open", [url], { detached: true, stdio: "ignore" })
      }

      // Poll for verification
      const maxAttempts = 60 // 5 minutes with 5 second intervals
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, interval * 1000))

        const verifyResponse = await fetch(`${portalUrl}/api/auth/device/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_code }),
        })

        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json()
          if (verifyData.access_token) {
            // Save to auth store
            const { Auth } = await import("@/auth")
            await Auth.set("enterprise", {
              type: "enterprise",
              enterpriseUrl: portalUrl,
              token: verifyData.access_token,
              sessionToken: verifyData.session_token,
              username: verifyData.user?.name,
              email: verifyData.user?.email,
              role: verifyData.user?.role,
            })

            toast.show({
              variant: "info",
              message: "Enterprise portal connected!",
              duration: 3000,
            })
            dialog.clear()
            return
          }
        } else if (verifyResponse.status === 400) {
          const errorData = await verifyResponse.json()
          if (errorData.error === "authorization_pending") {
            continue // Keep polling
          } else if (errorData.error === "slow_down") {
            await new Promise((resolve) => setTimeout(resolve, 5000)) // Extra delay
            continue
          } else if (errorData.error === "expired_token" || errorData.error === "access_denied") {
            throw new Error(errorData.error_description || errorData.error)
          }
        }
      }

      throw new Error("Verification timeout - please try again")
    } catch (e) {
      toast.show({
        variant: "error",
        message: e instanceof Error ? e.message : "Authentication failed",
        duration: 5000,
      })
      setStep("subdomain")
      setTimeout(() => subdomainInput?.focus(), 10)
    }
  }

  const handleLicenseKey = async () => {
    if (!licenseKey()) {
      toast.show({
        variant: "error",
        message: "Please enter your license key",
      })
      return
    }

    if (!licenseKey().startsWith("SNOW-ENT-") && !licenseKey().startsWith("SNOW-SI-")) {
      toast.show({
        variant: "error",
        message: "Invalid license key format. Must start with SNOW-ENT- or SNOW-SI-",
      })
      return
    }

    try {
      const { Auth } = await import("@/auth")
      await Auth.set("enterprise", {
        type: "enterprise",
        licenseKey: licenseKey(),
      })

      toast.show({
        variant: "info",
        message: "Enterprise license configured!",
        duration: 3000,
      })
      dialog.clear()
    } catch (e) {
      toast.show({
        variant: "error",
        message: e instanceof Error ? e.message : "Failed to save license",
        duration: 5000,
      })
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
          <text fg={theme.textMuted}>Enter your organization's portal subdomain</text>
          <text fg={theme.textMuted}>e.g., "acme" for acme.snow-flow.dev</text>
          <textarea
            ref={(val: TextareaRenderable) => (subdomainInput = val)}
            height={3}
            initialValue={subdomain()}
            placeholder="acme"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setSubdomain(subdomainInput.plainText)
              handleDeviceAuth()
            }}
          />
          <box flexDirection="row" gap={2}>
            <text fg={theme.text}>
              enter <span style={{ fg: theme.textMuted }}>authenticate via browser</span>
            </text>
          </box>
          <box
            onMouseUp={() => {
              setStep("license")
              setTimeout(() => licenseInput?.focus(), 10)
            }}
          >
            <text fg={theme.primary}>Or use license key instead</text>
          </box>
        </box>
      </Show>

      <Show when={step() === "authenticating"}>
        <box gap={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Authenticating...
          </text>
          <text fg={theme.textMuted}>Please complete verification in your browser</text>
          <text fg={theme.textMuted}>Portal: {subdomain()}.snow-flow.dev</text>
        </box>
      </Show>

      <Show when={step() === "license"}>
        <box gap={1}>
          <text fg={theme.textMuted}>Enter your Snow-Flow Enterprise license key</text>
          <textarea
            ref={(val: TextareaRenderable) => (licenseInput = val)}
            height={3}
            initialValue={licenseKey()}
            placeholder="SNOW-ENT-XXXX-XXXX"
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.text}
            keyBindings={[{ name: "return", action: "submit" }]}
            onSubmit={() => {
              setLicenseKey(licenseInput.plainText)
              handleLicenseKey()
            }}
          />
          <text fg={theme.textMuted}>Enterprise features include:</text>
          <text fg={theme.textMuted}>- Jira, Azure DevOps, Confluence integration</text>
          <text fg={theme.textMuted}>- Stakeholder read-only seats</text>
          <text fg={theme.textMuted}>Press Enter to validate</text>
        </box>
      </Show>
    </box>
  )
}
