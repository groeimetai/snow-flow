/**
 * ServiceNow OAuth Authentication for SnowCode
 * Handles OAuth2 flow for ServiceNow integration
 */

import crypto from "crypto"
import * as prompts from "@clack/prompts"
import open from "open"
import { Auth } from "./index"

/**
 * OAuth HTML Templates with Snow-Flow minimalist branding
 */
const baseStyles = `
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #1E2531;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #FFFFFF;
    }

    .container {
      max-width: 600px;
      width: 100%;
      text-align: center;
    }

    .logo {
      margin-bottom: 3rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
    }

    .logo-svg {
      width: 150px;
      height: auto;
    }

    .logo-text {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .snow {
      color: #FFFFFF;
    }

    .flow {
      color: #00D9FF;
    }

    .status-icon {
      font-size: 4rem;
      margin-bottom: 2rem;
      display: block;
    }

    h1 {
      font-size: 3rem;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }

    .success-text {
      color: #00D9FF;
    }

    .error-text {
      color: #f5222d;
    }

    p {
      font-size: 1.25rem;
      color: #94A3B8;
      line-height: 1.6;
      margin-bottom: 1rem;
    }

    .instruction {
      font-size: 1.125rem;
      color: #FFFFFF;
      margin-top: 2rem;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .error-details {
      margin-top: 2rem;
      padding: 1.5rem;
      background: rgba(245, 34, 45, 0.1);
      border-radius: 12px;
      border: 1px solid rgba(245, 34, 45, 0.3);
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      color: #f5222d;
      word-break: break-word;
    }

    .footer {
      margin-top: 3rem;
      font-size: 0.875rem;
      color: #64748B;
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 2rem;
      }

      .status-icon {
        font-size: 3rem;
      }

      .logo-text {
        font-size: 1.5rem;
      }
    }
  </style>
`;

const logoSVG = `
  <svg class="logo-svg" viewBox="0 0 100 70" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Mountain gradient (white to cyan) -->
      <linearGradient id="mountain-v" x1="50" y1="8" x2="50" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#00D9FF"/>
      </linearGradient>
    </defs>

    <!-- Icon centered and scaled up -->
    <g transform="translate(26, 2)">
      <!-- Mountain peaks (geometric, clear) - scaled up and better centered -->
      <path d="M6 26 L15 6 L24 16 L33 6 L42 26 Z"
            fill="url(#mountain-v)"
            stroke="#00D9FF"
            stroke-width="1.5"
            stroke-linejoin="round"/>
    </g>

    <!-- Text SNOW centered -->
    <text x="50" y="50" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="#FFFFFF" letter-spacing="-0.02em">SNOW</text>

    <!-- Text FLOW centered -->
    <text x="50" y="66" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="#00D9FF" letter-spacing="-0.02em">FLOW</text>
  </svg>
`;

const OAuthTemplates = {
  success: `
    <html>
      <head>
        <title>Snow-Flow - Authentication Successful</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${logoSVG}
          </div>

          <span class="status-icon">✓</span>

          <h1 class="success-text">
            Connected!
          </h1>

          <p>
            Your ServiceNow instance is now connected to Snow-Flow.
          </p>

          <div class="instruction">
            You can close this window and return to your terminal.
          </div>

          <div class="footer">
            Snow-Flow: ServiceNow Multi-Agent Development Framework
          </div>
        </div>
      </body>
    </html>
  `,

  error: (error: string) => `
    <html>
      <head>
        <title>Snow-Flow - Authentication Error</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${logoSVG}
          </div>

          <span class="status-icon error-text">✕</span>

          <h1 class="error-text">
            Authentication Failed
          </h1>

          <p>
            We couldn't complete the authentication process.
          </p>

          <div class="error-details">
            ${error}
          </div>

          <div class="instruction">
            Please close this window and try again.
          </div>

          <div class="footer">
            Need help? Check the Snow-Flow documentation.
          </div>
        </div>
      </body>
    </html>
  `,

  securityError: `
    <html>
      <head>
        <title>Snow-Flow - Security Error</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${logoSVG}
          </div>

          <span class="status-icon error-text">⚠</span>

          <h1 class="error-text">
            Security Error
          </h1>

          <p>
            Invalid state parameter detected - possible CSRF attack.
          </p>

          <div class="instruction">
            Please close this window and start the authentication process again.
          </div>

          <div class="footer">
            Your security is our priority.
          </div>
        </div>
      </body>
    </html>
  `,

  missingCode: `
    <html>
      <head>
        <title>Snow-Flow - Missing Authorization Code</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${logoSVG}
          </div>

          <span class="status-icon error-text">✕</span>

          <h1 class="error-text">
            Missing Authorization
          </h1>

          <p>
            No authorization code was received from ServiceNow.
          </p>

          <div class="instruction">
            Make sure you approve the authorization request in ServiceNow, then try again.
          </div>

          <div class="footer">
            Snow-Flow: ServiceNow Multi-Agent Development Framework
          </div>
        </div>
      </body>
    </html>
  `,

  tokenExchangeFailed: (error: string) => `
    <html>
      <head>
        <title>Snow-Flow - Token Exchange Failed</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${logoSVG}
          </div>

          <span class="status-icon error-text">✕</span>

          <h1 class="error-text">
            Token Exchange Failed
          </h1>

          <p>
            Unable to exchange authorization code for access token.
          </p>

          <div class="error-details">
            ${error}
          </div>

          <div class="instruction">
            Please verify your OAuth configuration (Client ID and Client Secret) and try again.
          </div>

          <div class="footer">
            Snow-Flow: ServiceNow Multi-Agent Development Framework
          </div>
        </div>
      </body>
    </html>
  `
}

export interface ServiceNowAuthResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  error?: string
}

export interface ServiceNowOAuthOptions {
  instance: string
  clientId: string
  clientSecret: string
  silent?: boolean // When true, suppress console output (for TUI mode)
}

export class ServiceNowOAuth {
  private stateParameter?: string
  private codeVerifier?: string
  private codeChallenge?: string
  private silent: boolean = false

  // Helper for conditional logging (respects silent mode)
  private log = {
    step: (msg: string) => !this.silent && prompts.log.step(msg),
    info: (msg: string) => !this.silent && prompts.log.info(msg),
    message: (msg: string) => !this.silent && prompts.log.message(msg),
    warn: (msg: string) => !this.silent && prompts.log.warn(msg),
    error: (msg: string) => !this.silent && prompts.log.error(msg),
    success: (msg: string) => !this.silent && prompts.log.success(msg),
  }

  // Rate limiting
  private lastTokenRequest: number = 0
  private tokenRequestCount: number = 0
  private readonly TOKEN_REQUEST_WINDOW_MS = 60000 // 1 minute
  private readonly MAX_TOKEN_REQUESTS_PER_WINDOW = 10

  /**
   * Check rate limiting for token requests
   */
  private checkTokenRequestRateLimit(): boolean {
    const now = Date.now()

    if (now - this.lastTokenRequest > this.TOKEN_REQUEST_WINDOW_MS) {
      this.tokenRequestCount = 0
      this.lastTokenRequest = now
    }

    if (this.tokenRequestCount >= this.MAX_TOKEN_REQUESTS_PER_WINDOW) {
      this.log.warn("Rate limit exceeded: Too many token requests. Please wait before retrying.")
      return false
    }

    this.tokenRequestCount++
    return true
  }

  /**
   * Generate a random state parameter for CSRF protection
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString("base64url")
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private generatePKCE() {
    this.codeVerifier = crypto.randomBytes(32).toString("base64url")
    const hash = crypto.createHash("sha256")
    hash.update(this.codeVerifier)
    this.codeChallenge = hash.digest("base64url")
  }

  /**
   * Normalize instance URL
   */
  private normalizeInstanceUrl(instance: string): string {
    let normalized = instance.replace(/\/+$/, "")

    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = `https://${normalized}`
    }

    if (
      !normalized.includes(".service-now.com") &&
      !normalized.includes("localhost") &&
      !normalized.includes("127.0.0.1")
    ) {
      const instanceName = normalized.replace("https://", "").replace("http://", "")
      normalized = `https://${instanceName}.service-now.com`
    }

    return normalized
  }

  /**
   * Validate client secret format
   */
  private validateClientSecret(secret: string): { valid: boolean; reason?: string } {
    if (!secret || secret.trim() === "") {
      return { valid: false, reason: "Client secret is required" }
    }

    if (secret.length < 32) {
      return {
        valid: false,
        reason: "Client secret is too short (should be 32+ characters)",
      }
    }

    const commonPasswords = ["password", "admin", "secret", "client", "snow"]
    const lowerSecret = secret.toLowerCase()
    for (const common of commonPasswords) {
      if (lowerSecret.includes(common)) {
        return {
          valid: false,
          reason: `Client secret appears to be a common password - it should be a random string from ServiceNow`,
        }
      }
    }

    return { valid: true }
  }

  /**
   * Generate authorization URL
   */
  private generateAuthUrl(instance: string, clientId: string): string {
    const baseUrl = instance.startsWith("http") ? instance : `https://${instance}`

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
      state: this.stateParameter!,
      code_challenge: this.codeChallenge!,
      code_challenge_method: "S256",
    })

    return `${baseUrl}/oauth_auth.do?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    instance: string,
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri?: string,
  ): Promise<ServiceNowAuthResult> {
    if (!this.checkTokenRequestRateLimit()) {
      return {
        success: false,
        error: "Rate limit exceeded. Please wait before retrying.",
      }
    }

    const baseUrl = instance.startsWith("http") ? instance : `https://${instance}`
    const tokenUrl = `${baseUrl}/oauth_token.do`

    // redirect_uri MUST match the one used in authorization request
    const finalRedirectUri = redirectUri || "http://localhost:3005/callback"

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: finalRedirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: this.codeVerifier!,
    })

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `Token exchange failed: ${response.status} ${errorText}`,
        }
      }

      const data = await response.json()

      if (data.error) {
        return {
          success: false,
          error: `OAuth error: ${data.error} - ${data.error_description || ""}`,
        }
      }

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Detect if running in GitHub Codespaces
   */
  private isCodespace(): boolean {
    // Check multiple Codespace indicators
    const hasCodespacesEnv = process.env.CODESPACES === 'true'
    const hasCodespaceName = !!process.env.CODESPACE_NAME
    const hasForwardingDomain = !!process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN

    // Debug logging
    if (hasCodespacesEnv || hasCodespaceName || hasForwardingDomain) {
      this.log.info(`🔍 Codespace detection:`)
      this.log.message(`   CODESPACES=${process.env.CODESPACES}`)
      this.log.message(`   CODESPACE_NAME=${process.env.CODESPACE_NAME}`)
      this.log.message(`   GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN=${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`)
    }

    return hasCodespacesEnv || (hasCodespaceName && hasForwardingDomain)
  }

  /**
   * Comprehensive headless environment detection
   * Detects SSH, Docker, CI/CD, Codespaces, and other environments where browser auto-open won't work
   */
  private detectHeadlessEnvironment(): {
    isHeadless: boolean
    type: 'ssh' | 'docker' | 'codespaces' | 'gitpod' | 'ci' | 'remote' | 'wsl' | 'none'
    reason: string
  } {
    // GitHub Codespaces
    if (process.env.CODESPACES === 'true' || (process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN)) {
      return { isHeadless: true, type: 'codespaces', reason: 'GitHub Codespaces detected' }
    }

    // Gitpod
    if (process.env.GITPOD_WORKSPACE_ID || process.env.GITPOD_INSTANCE_ID) {
      return { isHeadless: true, type: 'gitpod', reason: 'Gitpod workspace detected' }
    }

    // SSH connection
    if (process.env.SSH_CLIENT || process.env.SSH_CONNECTION || process.env.SSH_TTY) {
      return { isHeadless: true, type: 'ssh', reason: 'SSH connection detected' }
    }

    // Docker container (check for .dockerenv or cgroup)
    try {
      const fs = require('fs')
      if (fs.existsSync('/.dockerenv')) {
        return { isHeadless: true, type: 'docker', reason: 'Docker container detected' }
      }
      // Check cgroup for container runtime
      if (fs.existsSync('/proc/1/cgroup')) {
        const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8')
        if (cgroup.includes('docker') || cgroup.includes('kubepods') || cgroup.includes('containerd')) {
          return { isHeadless: true, type: 'docker', reason: 'Container environment detected' }
        }
      }
    } catch {
      // Ignore filesystem errors
    }

    // CI/CD environments
    if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI ||
        process.env.JENKINS_HOME || process.env.CIRCLECI || process.env.TRAVIS) {
      return { isHeadless: true, type: 'ci', reason: 'CI/CD environment detected' }
    }

    // VS Code Remote / DevContainers
    if (process.env.REMOTE_CONTAINERS || process.env.VSCODE_REMOTE_CONTAINERS_SESSION) {
      return { isHeadless: true, type: 'remote', reason: 'VS Code Remote Container detected' }
    }

    // DevPod
    if (process.env.DEVPOD) {
      return { isHeadless: true, type: 'remote', reason: 'DevPod detected' }
    }

    // WSL without display
    if (process.env.WSL_DISTRO_NAME && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
      return { isHeadless: true, type: 'wsl', reason: 'WSL without display detected' }
    }

    // Linux without display server
    if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
      // Additional check: if we're in a TTY-only environment
      if (process.env.TERM && !process.env.XDG_CURRENT_DESKTOP) {
        return { isHeadless: true, type: 'remote', reason: 'Linux terminal without display server' }
      }
    }

    return { isHeadless: false, type: 'none', reason: '' }
  }

  /**
   * Get Codespace forwarded URL for port 3005
   */
  private getCodespaceForwardedUrl(): string | null {
    const codespaceName = process.env.CODESPACE_NAME
    const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN

    if (!codespaceName || !forwardingDomain) {
      return null
    }

    return `https://${codespaceName}-3005.${forwardingDomain}/callback`
  }

  /**
   * Main authentication flow with localhost callback server
   */
  async authenticate(options: ServiceNowOAuthOptions): Promise<ServiceNowAuthResult> {
    // Set silent mode from options
    this.silent = options.silent ?? false

    try {
      const normalizedInstance = this.normalizeInstanceUrl(options.instance)

      // Validate client secret
      const secretValidation = this.validateClientSecret(options.clientSecret)
      if (!secretValidation.valid) {
        this.log.error(`Invalid OAuth Client Secret: ${secretValidation.reason}`)
        this.log.info("To get a valid OAuth secret:")
        this.log.message("   1. Log into ServiceNow as admin")
        this.log.message("   2. Navigate to: System OAuth > Application Registry")
        this.log.message("   3. Create a new OAuth application")
        this.log.message("   4. Set Redirect URL to: http://localhost:3005/callback")
        this.log.message("   5. Copy the generated Client Secret")
        return {
          success: false,
          error: secretValidation.reason,
        }
      }

      this.log.step("Starting ServiceNow OAuth flow")
      this.log.info(`Instance: ${normalizedInstance}`)

      // Generate state and PKCE
      this.stateParameter = this.generateState()
      this.generatePKCE()

      // Always use localhost - simplest approach for all environments
      const port = 3005
      const redirectUri = `http://localhost:${port}/callback`

      this.log.message("")

      // Generate authorization URL
      const authUrl = this.generateAuthUrlWithCallback(normalizedInstance, options.clientId, redirectUri)

      // Check if we're in a headless environment
      const headlessEnv = this.detectHeadlessEnvironment()

      if (headlessEnv.isHeadless) {
        // Headless environment - show URL for manual opening
        this.log.info(`🌐 ${headlessEnv.reason}`)
        this.log.warn("Cannot auto-open browser in this environment")
        this.log.message("")
        this.log.step("Please open this URL in your browser:")
        this.log.message("")
        this.log.message(`   ${authUrl}`)
        this.log.message("")
        this.log.info("After approving, you'll need to paste the callback URL")
      } else {
        // Normal environment - auto-open browser
        this.log.step("Opening browser for authentication...")
        this.log.info(`Authorization URL: ${authUrl}`)
        this.log.message("")
        this.openBrowser(authUrl)
      }

      // Start callback server
      // In remote environments (Codespaces, Gitpod, etc), the callback won't reach localhost
      // The user will be prompted to paste the callback URL after clicking Approve
      const result = await this.startCallbackServer(port, normalizedInstance, options.clientId, options.clientSecret, redirectUri)

      if (result.success && result.accessToken) {
        // Save to SnowCode auth store
        await Auth.set("servicenow", {
          type: "servicenow-oauth",
          instance: normalizedInstance,
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresIn ? Date.now() + result.expiresIn * 1000 : undefined,
        })

        this.log.success("Tokens saved securely")
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.log.error(`Authentication failed: ${errorMessage}`)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Handle authentication in Codespaces environment
   * With out-of-band flow, ServiceNow displays the authorization code directly
   */
  private async handleCodespaceAuth(
    instance: string,
    clientId: string,
    clientSecret: string,
  ): Promise<ServiceNowAuthResult> {
    this.log.info("📋 After approving in ServiceNow, copy the authorization code displayed")
    this.log.message("ServiceNow will show you an authorization code on the success page.")
    this.log.message("")

    const authCode = (await prompts.text({
      message: "Paste the authorization code here:",
      placeholder: "Enter the code from ServiceNow",
      validate: (value) => {
        if (!value || value.trim() === "") {
          return "Authorization code is required"
        }
        // Authorization codes are typically alphanumeric, 20-40 chars
        if (value.trim().length < 10) {
          return "Authorization code seems too short"
        }
        return undefined
      },
    })) as string

    if (prompts.isCancel(authCode)) {
      return {
        success: false,
        error: "Authentication cancelled by user",
      }
    }

    // Clean the code (remove whitespace)
    const code = authCode.trim()

    // Exchange code for tokens
    this.log.message("")
    const spinner = this.silent ? null : prompts.spinner()
    spinner?.start("Exchanging authorization code for tokens")

    // Use out-of-band redirect_uri for Codespaces
    const tokenResult = await this.exchangeCodeForTokens(
      instance,
      clientId,
      clientSecret,
      code,
      "urn:ietf:wg:oauth:2.0:oob"
    )

    if (tokenResult.success) {
      spinner?.stop("Authentication successful ✓")
    } else {
      spinner?.stop("Token exchange failed ✗")
    }

    return tokenResult
  }

  /**
   * Generate authorization URL with localhost callback
   */
  private generateAuthUrlWithCallback(instance: string, clientId: string, redirectUri: string): string {
    const baseUrl = instance.startsWith("http") ? instance : `https://${instance}`

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state: this.stateParameter!,
      code_challenge: this.codeChallenge!,
      code_challenge_method: "S256",
    })

    return `${baseUrl}/oauth_auth.do?${params.toString()}`
  }

  /**
   * Prepare OAuth for headless environment - returns auth URL without starting callback server
   * Used when browser can't be auto-opened (Codespaces, SSH, Docker, etc.)
   */
  prepareHeadlessAuth(options: {
    instance: string
    clientId: string
    clientSecret: string
  }): {
    success: boolean
    authUrl?: string
    sessionData?: {
      instance: string
      clientId: string
      clientSecret: string
      state: string
      codeVerifier: string
      redirectUri: string
    }
    error?: string
  } {
    try {
      const normalizedInstance = this.normalizeInstanceUrl(options.instance)

      // Validate client secret
      const secretValidation = this.validateClientSecret(options.clientSecret)
      if (!secretValidation.valid) {
        return { success: false, error: secretValidation.reason }
      }

      // Generate PKCE and state
      this.stateParameter = this.generateState()
      this.generatePKCE()

      // Use localhost callback - user will need to paste the redirect URL
      const redirectUri = "http://localhost:3005/callback"

      // Generate auth URL
      const authUrl = this.generateAuthUrlWithCallback(normalizedInstance, options.clientId, redirectUri)

      return {
        success: true,
        authUrl,
        sessionData: {
          instance: normalizedInstance,
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          state: this.stateParameter,
          codeVerifier: this.codeVerifier!,
          redirectUri,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Complete OAuth flow with manually provided authorization code
   * Used in headless environments where user completes OAuth in external browser
   */
  async completeHeadlessAuth(options: {
    code: string
    sessionData: {
      instance: string
      clientId: string
      clientSecret: string
      state: string
      codeVerifier: string
      redirectUri: string
    }
  }): Promise<ServiceNowAuthResult> {
    try {
      // Restore PKCE state
      this.codeVerifier = options.sessionData.codeVerifier
      this.stateParameter = options.sessionData.state

      // Exchange code for token
      const tokenResult = await this.exchangeCodeForTokens(
        options.code,
        options.sessionData.instance,
        options.sessionData.clientId,
        options.sessionData.clientSecret,
        options.sessionData.redirectUri
      )

      if (tokenResult.success && tokenResult.accessToken) {
        // Save to auth store
        await Auth.set("servicenow", {
          type: "servicenow-oauth",
          instance: options.sessionData.instance,
          clientId: options.sessionData.clientId,
          clientSecret: options.sessionData.clientSecret,
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          expiresAt: tokenResult.expiresIn ? Date.now() + tokenResult.expiresIn * 1000 : undefined,
        })
      }

      return tokenResult
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Auto-open browser
   */
  private openBrowser(url: string): void {
    try {
      // Use the 'open' package for reliable cross-platform browser opening
      open(url).catch(() => {
        this.log.warn("Could not auto-open browser. Please manually open the URL above.")
      })
    } catch (err) {
      this.log.warn("Could not auto-open browser. Please manually open the URL above.")
    }
  }

  /**
   * Start localhost callback server with Codespaces URL pasting fallback
   */
  private async startCallbackServer(
    port: number,
    instance: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<ServiceNowAuthResult> {
    const inCodespace = this.isCodespace()

    return new Promise((resolve) => {
      const { createServer } = require("http")
      const { URL } = require("url")
      let resolved = false

      const server = createServer(async (req: any, res: any) => {
        if (resolved) return

        try {
          const url = new URL(req.url!, `http://localhost:${port}`)

          if (url.pathname === "/callback") {
            const code = url.searchParams.get("code")
            const error = url.searchParams.get("error")
            const state = url.searchParams.get("state")

            // Validate state parameter
            if (state !== this.stateParameter) {
              res.writeHead(400, { "Content-Type": "text/html" })
              res.end(OAuthTemplates.securityError)
              server.close()
              resolved = true
              resolve({ success: false, error: "Invalid state parameter" })
              return
            }

            if (error) {
              res.writeHead(400, { "Content-Type": "text/html" })
              res.end(OAuthTemplates.error(`OAuth error: ${error}`))
              server.close()
              resolved = true
              resolve({ success: false, error: `OAuth error: ${error}` })
              return
            }

            if (!code) {
              res.writeHead(400, { "Content-Type": "text/html" })
              res.end(OAuthTemplates.missingCode)
              server.close()
              resolved = true
              resolve({ success: false, error: "No authorization code received" })
              return
            }

            // Exchange code for tokens (only show spinner if not in silent mode)
            const spinner = this.silent ? null : prompts.spinner()
            spinner?.start("Exchanging authorization code for tokens")
            const tokenResult = await this.exchangeCodeForTokens(
              instance,
              clientId,
              clientSecret,
              code,
              redirectUri
            )

            if (tokenResult.success) {
              res.writeHead(200, { "Content-Type": "text/html" })
              res.end(OAuthTemplates.success)
              spinner?.stop("Authentication successful")
              server.close()
              resolved = true
              resolve(tokenResult)
            } else {
              res.writeHead(500, { "Content-Type": "text/html" })
              res.end(OAuthTemplates.tokenExchangeFailed(tokenResult.error || "Unknown error"))
              spinner?.stop("Token exchange failed")
              server.close()
              resolved = true
              resolve(tokenResult)
            }
          } else {
            res.writeHead(404, { "Content-Type": "text/plain" })
            res.end("Not Found")
          }
        } catch (error) {
          res.writeHead(500, { "Content-Type": "text/plain" })
          res.end("Internal Server Error")
          server.close()
          resolved = true
          resolve({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })

      server.listen(port, async () => {
        this.log.info(`Callback server started on http://localhost:${port}/callback`)
        this.log.info("Waiting for OAuth callback...")

        // In Codespaces and remote environments, the callback won't work automatically
        if (inCodespace) {
          this.log.message("")
          this.log.info("🌐 GitHub Codespaces Detected")
          this.log.message("")
          this.log.info("After clicking 'Approve' in ServiceNow:")
          this.log.message("   1. Your browser will show a 'Can't reach this page' or 404 error")
          this.log.message("   2. Copy the FULL URL from your browser address bar")
          this.log.message("      (it starts with: http://localhost:3005/callback?code=...)")
          this.log.message("   3. Paste it below in a few seconds")
          this.log.message("")

          // Wait a bit to see if automatic callback works (unlikely in Codespaces)
          await new Promise(resolve => setTimeout(resolve, 3000))

          if (!resolved) {
            try {
              const callbackUrl = await prompts.text({
                message: "Paste the callback URL here (or press Enter to keep waiting):",
                placeholder: "http://localhost:3005/callback?code=...&state=...",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return undefined // Allow empty to continue waiting
                  }
                  if (!value.includes("/callback")) {
                    return "URL must contain '/callback'"
                  }
                  return undefined
                }
              })

              if (!prompts.isCancel(callbackUrl) && callbackUrl && callbackUrl.trim() !== "") {
                // Parse the pasted URL
                try {
                  const parsedUrl = new URL(callbackUrl.replace('localhost:3005', 'localhost:' + port))
                  const code = parsedUrl.searchParams.get("code")
                  const error = parsedUrl.searchParams.get("error")
                  const state = parsedUrl.searchParams.get("state")

                  // Validate state parameter
                  if (state !== this.stateParameter) {
                    server.close()
                    resolved = true
                    resolve({ success: false, error: "Invalid state parameter - possible CSRF attack" })
                    return
                  }

                  if (error) {
                    server.close()
                    resolved = true
                    resolve({ success: false, error: `OAuth error: ${error}` })
                    return
                  }

                  if (!code) {
                    this.log.warn("No authorization code found in URL, continuing to wait for callback...")
                  } else {
                    // Exchange code for tokens
                    const spinner = this.silent ? null : prompts.spinner()
                    spinner?.start("Exchanging authorization code for tokens")
                    const tokenResult = await this.exchangeCodeForTokens(
                      instance,
                      clientId,
                      clientSecret,
                      code,
                      redirectUri
                    )

                    if (tokenResult.success) {
                      spinner?.stop("Authentication successful")
                      server.close()
                      resolved = true
                      resolve(tokenResult)
                    } else {
                      spinner?.stop("Token exchange failed")
                      server.close()
                      resolved = true
                      resolve(tokenResult)
                    }
                  }
                } catch (urlError) {
                  this.log.warn("Invalid URL format, continuing to wait for callback...")
                }
              }
            } catch (promptError) {
              // If prompt fails, just continue waiting
              this.log.warn("Continuing to wait for automatic callback...")
            }
          }
        }
      })

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!resolved) {
          server.close()
          resolved = true
          resolve({
            success: false,
            error: "Authentication timeout (5 minutes)",
          })
        }
      }, 300000)
    })
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    instance: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<ServiceNowAuthResult> {
    if (!this.checkTokenRequestRateLimit()) {
      return {
        success: false,
        error: "Rate limit exceeded",
      }
    }

    const baseUrl = instance.startsWith("http") ? instance : `https://${instance}`
    const tokenUrl = `${baseUrl}/oauth_token.do`

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      })

      if (!response.ok) {
        return {
          success: false,
          error: `Token refresh failed: ${response.status}`,
        }
      }

      const data = await response.json()

      if (data.error) {
        return {
          success: false,
          error: `OAuth error: ${data.error}`,
        }
      }

      // Update stored tokens
      await Auth.set("servicenow", {
        type: "servicenow-oauth",
        instance,
        clientId,
        clientSecret,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      })

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: data.expires_in,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
