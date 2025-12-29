package dialog

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/v2/textinput"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	list "github.com/sst/opencode/internal/components/list"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/components/toast"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
)

// Server URL from environment
func getServerURL() string {
	serverURL := os.Getenv("SNOWCODE_SERVER")
	if serverURL == "" {
		serverURL = "http://127.0.0.1:3006"
	}
	// Strip trailing slash to prevent double slashes in URL construction
	return strings.TrimSuffix(serverURL, "/")
}

// Enterprise portal URL - supports custom subdomains
// Reads from env var, saved config, or defaults to portal.snow-flow.dev
func getEnterprisePortalURL() string {
	// Check environment variable first
	if envURL := os.Getenv("SNOW_FLOW_PORTAL_URL"); envURL != "" {
		return strings.TrimSuffix(envURL, "/")
	}

	// Check for subdomain in environment
	if subdomain := os.Getenv("SNOW_FLOW_SUBDOMAIN"); subdomain != "" && subdomain != "portal" {
		return fmt.Sprintf("https://%s.snow-flow.dev", subdomain)
	}

	// Try to read subdomain from saved enterprise config
	configPath := os.ExpandEnv("$HOME/.snow-code/enterprise.json")
	if data, err := os.ReadFile(configPath); err == nil {
		var config struct {
			Subdomain string `json:"subdomain"`
		}
		if json.Unmarshal(data, &config) == nil && config.Subdomain != "" && config.Subdomain != "portal" {
			return fmt.Sprintf("https://%s.snow-flow.dev", config.Subdomain)
		}
	}

	// Default to main portal
	return "https://portal.snow-flow.dev"
}

// Provider from server API
type Provider struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	AuthType    string `json:"authType"`
	Recommended bool   `json:"recommended"`
	EnvVar      string `json:"envVar"`
	BaseURL     string `json:"baseUrl"`
}

// Model from server API
type Model struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	ContextWindow int    `json:"contextWindow"`
	Status        string `json:"status"`
}

// AuthMethod represents a login method for a provider
type AuthMethod struct {
	Label  string `json:"label"`
	Type   string `json:"type"`   // "oauth" or "api"
	Method string `json:"method"` // "code", "auto", or "api"
}

// MID Server info from discovery
type MidServer struct {
	Name      string `json:"name"`
	SysID     string `json:"sys_id"`
	Status    string `json:"status"`
	Validated bool   `json:"validated"`
}

// REST Message with methods from discovery
type RestMessage struct {
	Name     string            `json:"name"`
	SysID    string            `json:"sys_id"`
	Endpoint string            `json:"endpoint"`
	Methods  []RestMessageMethod `json:"methods"`
}

type RestMessageMethod struct {
	Name       string `json:"name"`
	HttpMethod string `json:"http_method"`
	SysID      string `json:"sys_id"`
}

// MID Server model from discovery
type MidServerModel struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	ContextWindow int    `json:"contextWindow"`
	MaxTokens     int    `json:"maxTokens"`
}

// ServiceNow instance from enterprise portal
type ServiceNowInstanceFromPortal struct {
	ID              int    `json:"id"`
	InstanceName    string `json:"instanceName"`
	InstanceURL     string `json:"instanceUrl"`
	EnvironmentType string `json:"environmentType"`
	ClientID        string `json:"clientId"`
	ClientSecret    string `json:"clientSecret"`
	IsDefault       bool   `json:"isDefault"`
	Enabled         bool   `json:"enabled"`
}

// Enterprise credentials from portal (for display, not stored locally)
type EnterpriseCredentials struct {
	Jira       *EnterpriseJiraCredentials       `json:"jira,omitempty"`
	AzureDevOps *EnterpriseAzureDevOpsCredentials `json:"azure-devops,omitempty"`
	Confluence *EnterpriseConfluenceCredentials `json:"confluence,omitempty"`
}

type EnterpriseJiraCredentials struct {
	BaseURL  string `json:"baseUrl"`
	Email    string `json:"email"`
	Enabled  bool   `json:"enabled"`
}

type EnterpriseAzureDevOpsCredentials struct {
	BaseURL  string `json:"baseUrl"`
	Username string `json:"username,omitempty"`
	Enabled  bool   `json:"enabled"`
}

type EnterpriseConfluenceCredentials struct {
	BaseURL string `json:"baseUrl"`
	Email   string `json:"email"`
	Enabled bool   `json:"enabled"`
}

// Auth flow steps
type authStep int

const (
	stepSelectAuthType authStep = iota
	stepSelectLicenseType
	stepSelectLLMProvider
	stepSelectAuthMethod // New: select between OAuth/API key for provider
	stepSelectModel
	stepInputAPIKey
	stepInputServiceNow
	stepSelectServiceNowAuthMethod
	stepInputServiceNowBasic
	stepInputEnterpriseSubdomain // New: ask for enterprise/SI subdomain
	stepInputEnterpriseCode
	stepInputOAuthCode // New: input OAuth code (Claude Pro/Max style)
	stepBrowserAuth
	stepOAuthPolling // New: polling for GitHub Copilot style
	// MID Server LLM Configuration steps
	stepSelectMidServer
	stepSelectRestMessage
	stepSelectHttpMethod
	stepSelectMidServerModel
	stepDeployLLMAPI
	stepTestMidServer
	// Enterprise portal ServiceNow auto-config steps
	stepSelectPortalServiceNow // Select ServiceNow instance from enterprise portal
	// Complete Setup flow steps
	stepCompleteSelectAccount  // Ask if user has Snow-Flow account (Enterprise or Manual)
	stepComplete
	// Portal (Individual/Teams) auth steps
	stepSelectPortalAuthMethod  // Choose between browser/email/magic-link
	stepInputPortalEmail        // Input email and password
	stepInputPortalMagicLinkEmail // Input email for magic link
	stepInputPortalMagicLinkCode  // Input code from magic link email
)

// AuthSelectedMsg is sent when auth completes
type AuthSelectedMsg struct {
	AuthType string
	Success  bool
}

// AuthDialog interface for the auth dialog
type AuthDialog interface {
	layout.Modal
}

type authOption struct {
	value       string
	label       string
	description string
}

func (a authOption) Render(selected bool, width int, baseStyle styles.Style) string {
	t := theme.CurrentTheme()

	labelStyle := baseStyle.
		Foreground(t.Text()).
		Bold(selected)

	descStyle := baseStyle.
		Foreground(t.TextMuted()).
		Italic(true)

	if selected {
		labelStyle = labelStyle.Foreground(t.Primary())
	}

	label := labelStyle.Render(a.label)
	desc := descStyle.Render("  " + a.description)

	return lipgloss.JoinHorizontal(lipgloss.Left, label, desc)
}

func (a authOption) Selectable() bool {
	return true
}

func (a authOption) FilterValue() string {
	return a.label
}

type authDialog struct {
	width  int
	height int

	modal       *modal.Modal
	list        list.List[list.Item]
	step        authStep
	authType    string
	llmProvider string

	// Server URL for API calls
	serverURL string

	// Loaded providers from API
	providers []Provider
	models    []Model

	// Auth methods for current provider (OAuth options)
	authMethods         []AuthMethod
	selectedMethodIndex int

	// OAuth session state
	oauthSessionId   string
	oauthMethod      string // "code" or "auto"
	oauthInstructions string

	// Text inputs for credentials
	inputs       []textinput.Model
	focusedInput int
	inputLabels  []string

	// Browser auth state
	waitingForBrowser bool
	browserMessage    string
	deviceCode        string

	// Enterprise auth state
	enterpriseSubdomain      string // Subdomain for enterprise portal (e.g., "acme" for acme.snow-flow.dev)
	enterpriseSessionId      string
	enterpriseAuthCode       string
	enterpriseToken          string // JWT token from enterprise portal
	enterpriseCredentials    *EnterpriseCredentials
	portalServiceNowInstances []ServiceNowInstanceFromPortal
	enterpriseMcpServerUrl   string
	enterpriseTheme          map[string]interface{}
	appliedThemeName         string // Theme name applied during auth (for persistence)

	// Stored credentials
	instanceURL       string
	clientID          string
	clientSecret      string
	apiKey            string
	serviceNowAuthMethod string
	username          string
	password          string
	selectedModel     string

	// Portal (Individual/Teams) auth state
	portalAuthMethod    string  // "browser", "email", "magic-link"
	portalEmail         string
	portalPassword      string
	portalMagicLinkCode string
	portalEnabledServices []string // Services available to show in success message

	// OAuth model selection state
	oauthCompleted bool // True when OAuth succeeded, used for post-OAuth model selection

	// Complete Setup summary info
	completeSetupEmail       string
	completeSetupPlan        string
	completeSetupRole        string
	completeSetupCompany     string
	completeSetupServiceNow  string // Instance URL that was configured

	// MID Server LLM configuration state
	midServers           []MidServer
	restMessages         []RestMessage
	midServerModels      []MidServerModel
	selectedMidServer    string
	selectedRestMessage  string
	selectedHttpMethod   string
	selectedMidServerModel string
	snowAccessToken      string  // ServiceNow OAuth access token for MID Server API calls
	deployedApiBaseUri   string  // Base URI of deployed Snow-Flow LLM API

	// Loading state
	loading        bool
	loadingMessage string

	// LLM Provider search
	searchInput       textinput.Model
	allProviderOptions []authOption
}

func (a *authDialog) Init() tea.Cmd {
	return textinput.Blink
}

func (a *authDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height

	case ProvidersLoadedMsg:
		a.loading = false
		if msg.Error != "" {
			return a, toast.NewErrorToast("Failed to load providers: " + msg.Error)
		}
		a.providers = msg.Providers
		a.setupLLMProviderListFromProviders()

	case ModelsLoadedMsg:
		a.loading = false
		if msg.Error != "" {
			return a, toast.NewErrorToast("Failed to load models: " + msg.Error)
		}
		a.models = msg.Models
		a.setupModelList()

	case BrowserAuthCompleteMsg:
		a.waitingForBrowser = false
		a.loading = false
		if msg.Success {
			return a, tea.Sequence(
				util.CmdHandler(modal.CloseModalMsg{}),
				toast.NewSuccessToast("Authentication completed!"),
			)
		}
		return a, toast.NewErrorToast("Authentication failed: " + msg.Error)

	case EnterpriseSessionMsg:
		a.loading = false
		if !msg.Success {
			return a, toast.NewErrorToast("Enterprise auth failed: " + msg.Error)
		}
		// Store session ID and show code input step
		a.enterpriseSessionId = msg.SessionId
		a.step = stepInputEnterpriseCode
		a.setupEnterpriseCodeInput()
		a.browserMessage = "Browser opened. After approving, paste the code below."

	case EnterpriseVerifyMsg:
		a.loading = false
		if msg.Success {
			// Store the token and fetch enterprise credentials (including ServiceNow instances)
			a.enterpriseToken = msg.Token
			// Save Complete Setup info for final summary
			a.completeSetupEmail = msg.CustomerName
			a.completeSetupCompany = msg.CustomerCompany
			a.completeSetupRole = msg.Role
			a.completeSetupPlan = "Enterprise"

			// Save slug to enterprise.json for future auth redirects
			if msg.Slug != "" {
				configPath := os.ExpandEnv("$HOME/.snow-code/enterprise.json")
				// Ensure .snow-code directory exists
				configDir := os.ExpandEnv("$HOME/.snow-code")
				os.MkdirAll(configDir, 0755)
				// Read existing config or create new one
				config := map[string]interface{}{}
				if data, err := os.ReadFile(configPath); err == nil {
					json.Unmarshal(data, &config)
				}
				// Update subdomain
				config["subdomain"] = msg.Slug
				// Write back
				if configData, err := json.MarshalIndent(config, "", "  "); err == nil {
					os.WriteFile(configPath, configData, 0644)
					slog.Info("Saved subdomain for future auth", "slug", msg.Slug)
				}
			}

			a.loading = true
			a.loadingMessage = fmt.Sprintf("Fetching credentials for %s...", msg.CustomerCompany)
			return a, a.fetchEnterpriseCredentials()
		}
		return a, toast.NewErrorToast("Verification failed: " + msg.Error)

	case EnterpriseCredentialsMsg:
		a.loading = false
		if !msg.Success {
			// Credentials fetch failed, but auth succeeded - continue without portal config
			return a, tea.Sequence(
				util.CmdHandler(modal.CloseModalMsg{}),
				toast.NewWarningToast("Enterprise auth ok, but couldn't fetch credentials: " + msg.Error),
			)
		}
		// Store credentials and check for ServiceNow instances
		a.enterpriseCredentials = msg.Credentials
		a.portalServiceNowInstances = msg.ServiceNowInstances
		a.enterpriseMcpServerUrl = msg.McpServerUrl
		a.enterpriseTheme = msg.Theme

		// Apply enterprise theme if provided
		if msg.Theme != nil && len(msg.Theme) > 0 {
			themeName := "enterprise-custom"
			if nameVal, ok := msg.Theme["name"]; ok {
				if name, ok := nameVal.(string); ok && name != "" {
					themeName = name
				}
			}
			if parsedTheme, err := theme.ParseEnterpriseTheme(themeName, msg.Theme); err == nil {
				theme.RegisterTheme(themeName, parsedTheme)
				if err := theme.SetTheme(themeName); err == nil {
					slog.Info("Enterprise theme applied", "theme", themeName)
					// Send message to persist theme in app state
					// This will be handled by the main app's Update loop
					a.appliedThemeName = themeName
				} else {
					slog.Warn("Failed to set enterprise theme", "error", err)
				}
			} else {
				slog.Warn("Failed to parse enterprise theme", "error", err)
			}
		}

		// Log enabled services for info
		var enabledServices []string
		if msg.Credentials != nil {
			if msg.Credentials.Jira != nil && msg.Credentials.Jira.Enabled {
				enabledServices = append(enabledServices, "Jira")
			}
			if msg.Credentials.AzureDevOps != nil && msg.Credentials.AzureDevOps.Enabled {
				enabledServices = append(enabledServices, "Azure DevOps")
			}
			if msg.Credentials.Confluence != nil && msg.Credentials.Confluence.Enabled {
				enabledServices = append(enabledServices, "Confluence")
			}
		}
		slog.Info("Enterprise services enabled", "services", enabledServices)

		// Check for ServiceNow instances from portal
		if len(msg.ServiceNowInstances) > 0 {
			if len(msg.ServiceNowInstances) == 1 {
				// Auto-configure single instance (also configures enterprise MCP)
				// Save for Complete Setup summary
				a.completeSetupServiceNow = msg.ServiceNowInstances[0].InstanceName
				a.loading = true
				a.loadingMessage = fmt.Sprintf("Configuring ServiceNow (%s)...", msg.ServiceNowInstances[0].InstanceName)
				return a, a.configurePortalServiceNow(msg.ServiceNowInstances[0])
			}
			// Multiple instances - let user select
			a.step = stepSelectPortalServiceNow
			a.setupPortalServiceNowList()
			return a, nil
		}
		// No ServiceNow instances - but still need to configure enterprise MCP for third-party apps
		if msg.McpServerUrl != "" {
			a.loading = true
			a.loadingMessage = "Configuring enterprise MCP..."
			return a, a.configureEnterpriseMcp()
		}
		// No MCP URL either - just complete
		cmds := []tea.Cmd{
			util.CmdHandler(modal.CloseModalMsg{}),
			toast.NewSuccessToast("Enterprise authentication completed!"),
		}
		if a.appliedThemeName != "" {
			cmds = append(cmds, util.CmdHandler(ThemeSelectedMsg{ThemeName: a.appliedThemeName}))
		}
		return a, tea.Batch(cmds...)

	case PortalServiceNowConfigMsg:
		a.loading = false
		if msg.Success {
			// In Complete Setup, continue to LLM Provider selection
			if a.authType == "complete" {
				a.step = stepSelectLLMProvider
				a.loading = true
				a.loadingMessage = "Loading LLM providers..."
				return a, tea.Batch(
					toast.NewSuccessToast("ServiceNow configured from portal!"),
					a.loadProviders(),
				)
			}
			cmds := []tea.Cmd{
				util.CmdHandler(modal.CloseModalMsg{}),
				toast.NewSuccessToast("Enterprise auth + ServiceNow configured!"),
			}
			if a.appliedThemeName != "" {
				cmds = append(cmds, util.CmdHandler(ThemeSelectedMsg{ThemeName: a.appliedThemeName}))
			}
			return a, tea.Batch(cmds...)
		}
		// Config failed but auth succeeded - in Complete Setup, still continue to LLM
		if a.authType == "complete" {
			a.step = stepSelectLLMProvider
			a.loading = true
			a.loadingMessage = "Loading LLM providers..."
			return a, tea.Batch(
				toast.NewWarningToast("ServiceNow config failed, continuing to LLM..."),
				a.loadProviders(),
			)
		}
		return a, tea.Sequence(
			util.CmdHandler(modal.CloseModalMsg{}),
			toast.NewWarningToast("Enterprise auth ok, ServiceNow config failed: " + msg.Error),
		)

	case EnterpriseMcpConfigMsg:
		a.loading = false
		if msg.Success {
			// In Complete Setup, continue to LLM Provider selection
			if a.authType == "complete" {
				a.step = stepSelectLLMProvider
				a.loading = true
				a.loadingMessage = "Loading LLM providers..."
				return a, tea.Batch(
					toast.NewSuccessToast("Enterprise MCP configured!"),
					a.loadProviders(),
				)
			}
			// Show enabled third-party services
			var services []string
			if a.enterpriseCredentials != nil {
				if a.enterpriseCredentials.Jira != nil && a.enterpriseCredentials.Jira.Enabled {
					services = append(services, "Jira")
				}
				if a.enterpriseCredentials.AzureDevOps != nil && a.enterpriseCredentials.AzureDevOps.Enabled {
					services = append(services, "Azure DevOps")
				}
				if a.enterpriseCredentials.Confluence != nil && a.enterpriseCredentials.Confluence.Enabled {
					services = append(services, "Confluence")
				}
			}
			successMsg := "Enterprise MCP configured!"
			if len(services) > 0 {
				successMsg = fmt.Sprintf("Enterprise MCP configured! Services: %s", strings.Join(services, ", "))
			}
			cmds := []tea.Cmd{
				util.CmdHandler(modal.CloseModalMsg{}),
				toast.NewSuccessToast(successMsg),
			}
			if a.appliedThemeName != "" {
				cmds = append(cmds, util.CmdHandler(ThemeSelectedMsg{ThemeName: a.appliedThemeName}))
			}
			return a, tea.Batch(cmds...)
		}
		// Config failed - in Complete Setup, still continue to LLM
		if a.authType == "complete" {
			a.step = stepSelectLLMProvider
			a.loading = true
			a.loadingMessage = "Loading LLM providers..."
			return a, tea.Batch(
				toast.NewWarningToast("Enterprise MCP config failed, continuing to LLM..."),
				a.loadProviders(),
			)
		}
		return a, tea.Sequence(
			util.CmdHandler(modal.CloseModalMsg{}),
			toast.NewWarningToast("Enterprise auth ok, MCP config failed: " + msg.Error),
		)

	case PortalLoginMsg:
		a.loading = false
		if msg.Success {
			a.portalEnabledServices = msg.EnabledServices
			successMsg := fmt.Sprintf("Portal login successful! Welcome %s", msg.Email)
			if len(msg.EnabledServices) > 0 {
				successMsg = fmt.Sprintf("Portal login successful! Services: %s", strings.Join(msg.EnabledServices, ", "))
			}
			return a, tea.Sequence(
				util.CmdHandler(modal.CloseModalMsg{}),
				toast.NewSuccessToast(successMsg),
			)
		}
		return a, toast.NewErrorToast("Login failed: " + msg.Error)

	case PortalMagicLinkRequestMsg:
		a.loading = false
		if msg.Success {
			// Magic link sent, now show code input
			a.step = stepInputPortalMagicLinkCode
			a.setupPortalMagicLinkCodeInput()
			return a, tea.Batch(
				toast.NewSuccessToast("Magic link sent! Check your email."),
				a.updateInputFocus(),
			)
		}
		return a, toast.NewErrorToast("Failed to send magic link: " + msg.Error)

	case PortalMagicLinkVerifyMsg:
		a.loading = false
		if msg.Success {
			a.portalEnabledServices = msg.EnabledServices
			successMsg := fmt.Sprintf("Portal login successful! Welcome %s", msg.Email)
			if len(msg.EnabledServices) > 0 {
				successMsg = fmt.Sprintf("Portal login successful! Services: %s", strings.Join(msg.EnabledServices, ", "))
			}
			return a, tea.Sequence(
				util.CmdHandler(modal.CloseModalMsg{}),
				toast.NewSuccessToast(successMsg),
			)
		}
		return a, toast.NewErrorToast("Verification failed: " + msg.Error)

	case OAuthModelSavedMsg:
		a.loading = false
		if msg.Success {
			provider := a.findProvider(a.llmProvider)
			name := a.llmProvider
			if provider != nil {
				name = provider.Name
			}
			// For Complete Setup, show detailed summary
			if a.authType == "complete" {
				return a, tea.Sequence(
					util.CmdHandler(modal.CloseModalMsg{}),
					a.showCompleteSetupSummary(name, a.selectedModel),
				)
			}
			successMsg := fmt.Sprintf("%s configured with %s!", name, a.selectedModel)
			return a, tea.Sequence(
				util.CmdHandler(modal.CloseModalMsg{}),
				toast.NewSuccessToast(successMsg),
			)
		}
		return a, toast.NewErrorToast("Failed to save model: " + msg.Error)

	case AuthSavedMsg:
		a.loading = false
		if msg.Success {
			// In Complete Setup, if this is ServiceNow config, continue to LLM Provider
			isServiceNowConfig := strings.Contains(msg.Message, "ServiceNow")
			if a.authType == "complete" && isServiceNowConfig {
				a.step = stepSelectLLMProvider
				a.loading = true
				a.loadingMessage = "Loading LLM providers..."
				return a, tea.Batch(
					toast.NewSuccessToast(msg.Message),
					a.loadProviders(),
				)
			}
			// For Complete Setup, if this is the final LLM API key save, show detailed summary
			isLLMConfig := strings.Contains(msg.Message, "API key")
			if a.authType == "complete" && isLLMConfig {
				provider := a.findProvider(a.llmProvider)
				name := a.llmProvider
				if provider != nil {
					name = provider.Name
				}
				return a, tea.Sequence(
					util.CmdHandler(modal.CloseModalMsg{}),
					a.showCompleteSetupSummary(name, a.selectedModel),
				)
			}
			return a, tea.Sequence(
				util.CmdHandler(modal.CloseModalMsg{}),
				toast.NewSuccessToast(msg.Message),
			)
		}
		return a, toast.NewErrorToast("Save failed: " + msg.Error)

	case AuthMethodsLoadedMsg:
		a.loading = false
		if msg.Error != "" {
			// Default to API key if methods can't be loaded
			a.authMethods = []AuthMethod{{Label: "Enter API Key", Type: "api", Method: "api"}}
		} else {
			a.authMethods = msg.Methods
		}
		// If only one method and it's API, skip to model selection
		if len(a.authMethods) == 1 && a.authMethods[0].Type == "api" {
			a.step = stepSelectModel
			a.loading = true
			a.loadingMessage = "Loading models..."
			return a, a.loadModels(a.llmProvider)
		}
		// Multiple methods - show selection
		a.step = stepSelectAuthMethod
		a.setupAuthMethodList()

	case OAuthAuthorizeMsg:
		a.loading = false
		if !msg.Success {
			return a, toast.NewErrorToast("OAuth failed: " + msg.Error)
		}
		a.oauthSessionId = msg.SessionId
		a.oauthMethod = msg.Method
		a.oauthInstructions = msg.Instructions

		if msg.Method == "code" {
			// Show code input
			a.step = stepInputOAuthCode
			a.setupOAuthCodeInput()
		} else if msg.Method == "auto" {
			// Start polling
			a.step = stepOAuthPolling
			a.browserMessage = msg.Instructions
			return a, a.pollOAuth()
		}

	case OAuthExchangeMsg:
		a.loading = false
		if msg.Success {
			// OAuth succeeded - now show model selection
			a.oauthCompleted = true
			a.step = stepSelectModel
			a.loading = true
			a.loadingMessage = "Loading models..."
			provider := a.findProvider(a.llmProvider)
			name := a.llmProvider
			if provider != nil {
				name = provider.Name
			}
			return a, tea.Batch(
				toast.NewSuccessToast(name+" authentication completed! Select a model."),
				a.loadModels(a.llmProvider),
			)
		}
		return a, toast.NewErrorToast("OAuth failed: " + msg.Error)

	case OAuthPollMsg:
		if msg.Complete {
			a.loading = false
			if msg.Success {
				// OAuth succeeded - now show model selection
				a.oauthCompleted = true
				a.step = stepSelectModel
				a.loading = true
				a.loadingMessage = "Loading models..."
				provider := a.findProvider(a.llmProvider)
				name := a.llmProvider
				if provider != nil {
					name = provider.Name
				}
				return a, tea.Batch(
					toast.NewSuccessToast(name+" authentication completed! Select a model."),
					a.loadModels(a.llmProvider),
				)
			}
			return a, toast.NewErrorToast("OAuth failed: " + msg.Error)
		}
		// Still polling - wait and poll again
		return a, tea.Tick(time.Second*2, func(t time.Time) tea.Msg {
			return a.pollOAuth()()
		})

	// MID Server LLM Configuration handlers
	case ServiceNowOAuthCompleteMsg:
		a.loading = false
		if !msg.Success {
			return a, toast.NewErrorToast("ServiceNow auth failed: " + msg.Error)
		}
		a.snowAccessToken = msg.AccessToken
		// After ServiceNow auth, start MID Server discovery
		a.loading = true
		a.loadingMessage = "Discovering MID Servers..."
		return a, a.discoverMidServers()

	case MidServersLoadedMsg:
		a.loading = false
		if msg.Error != "" {
			return a, toast.NewErrorToast("Failed to discover MID Servers: " + msg.Error)
		}
		a.midServers = msg.MidServers
		if len(a.midServers) == 0 {
			return a, toast.NewErrorToast("No MID Servers found. Please configure a MID Server first.")
		}
		a.step = stepSelectMidServer
		a.setupMidServerList()

	case RestMessagesLoadedMsg:
		a.loading = false
		if msg.Error != "" {
			return a, toast.NewErrorToast("Failed to discover REST Messages: " + msg.Error)
		}
		a.restMessages = msg.RestMessages
		if len(a.restMessages) == 0 {
			return a, toast.NewErrorToast("No REST Messages found. Please configure LLM REST Message first.")
		}
		a.step = stepSelectRestMessage
		a.setupRestMessageList()

	case MidServerModelsLoadedMsg:
		a.loading = false
		if msg.Error != "" {
			// Models are optional - proceed without
			a.midServerModels = []MidServerModel{}
		} else {
			a.midServerModels = msg.Models
		}
		if len(a.midServerModels) == 0 {
			// No models discovered - skip to deploy
			a.step = stepDeployLLMAPI
			a.loading = true
			a.loadingMessage = "Deploying Snow-Flow LLM API..."
			return a, a.deployLLMAPI()
		}
		a.step = stepSelectMidServerModel
		a.setupMidServerModelList()

	case DeployLLMAPIMsg:
		a.loading = false
		if !msg.Success {
			return a, toast.NewErrorToast("Deployment failed: " + msg.Error)
		}
		a.deployedApiBaseUri = msg.BaseUri
		// After deploy, test connectivity
		a.step = stepTestMidServer
		a.loading = true
		a.loadingMessage = "Testing LLM connectivity..."
		return a, a.testMidServer()

	case TestMidServerMsg:
		a.loading = false
		if msg.Success {
			return a, tea.Sequence(
				util.CmdHandler(modal.CloseModalMsg{}),
				toast.NewSuccessToast("MID Server LLM configured! Response: "+msg.Response),
			)
		}
		// Test failed but config is done
		return a, tea.Sequence(
			util.CmdHandler(modal.CloseModalMsg{}),
			toast.NewInfoToast("MID Server LLM API deployed. Test failed: "+msg.Error),
		)

	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			if a.step != stepSelectAuthType {
				a.goBack()
				return a, nil
			}
			return a, util.CmdHandler(modal.CloseModalMsg{})

		case "tab", "down":
			if len(a.inputs) > 0 && (a.step == stepInputAPIKey || a.step == stepInputServiceNow || a.step == stepInputServiceNowBasic || a.step == stepInputEnterpriseSubdomain || a.step == stepInputEnterpriseCode || a.step == stepInputOAuthCode) {
				a.focusedInput = (a.focusedInput + 1) % len(a.inputs)
				return a, a.updateInputFocus()
			}

		case "shift+tab", "up":
			if len(a.inputs) > 0 && (a.step == stepInputAPIKey || a.step == stepInputServiceNow || a.step == stepInputServiceNowBasic || a.step == stepInputEnterpriseSubdomain || a.step == stepInputEnterpriseCode || a.step == stepInputOAuthCode) {
				a.focusedInput--
				if a.focusedInput < 0 {
					a.focusedInput = len(a.inputs) - 1
				}
				return a, a.updateInputFocus()
			}

		case "enter":
			return a.handleEnter()
		}
	}

	// Update list if in list step
	if a.step == stepSelectAuthType || a.step == stepSelectLicenseType ||
		a.step == stepSelectLLMProvider || a.step == stepSelectModel ||
		a.step == stepSelectServiceNowAuthMethod || a.step == stepSelectAuthMethod ||
		a.step == stepSelectMidServer || a.step == stepSelectRestMessage ||
		a.step == stepSelectHttpMethod || a.step == stepSelectMidServerModel ||
		a.step == stepSelectPortalServiceNow || a.step == stepCompleteSelectAccount {
		var cmd tea.Cmd
		listModel, cmd := a.list.Update(msg)
		a.list = listModel.(list.List[list.Item])
		cmds = append(cmds, cmd)
	}

	// Update search input for LLM Provider step
	if a.step == stepSelectLLMProvider {
		prevValue := a.searchInput.Value()
		var cmd tea.Cmd
		a.searchInput, cmd = a.searchInput.Update(msg)
		cmds = append(cmds, cmd)
		// Filter list when search value changes
		if a.searchInput.Value() != prevValue {
			a.filterProviderList(a.searchInput.Value())
		}
	}

	// Update text inputs if in input step
	if a.step == stepInputAPIKey || a.step == stepInputServiceNow || a.step == stepInputServiceNowBasic || a.step == stepInputEnterpriseSubdomain || a.step == stepInputEnterpriseCode || a.step == stepInputOAuthCode {
		for i := range a.inputs {
			var cmd tea.Cmd
			a.inputs[i], cmd = a.inputs[i].Update(msg)
			cmds = append(cmds, cmd)
		}
	}

	return a, tea.Batch(cmds...)
}

func (a *authDialog) handleEnter() (tea.Model, tea.Cmd) {
	switch a.step {
	case stepSelectAuthType:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				a.authType = opt.value
				switch opt.value {
				case "complete":
					// Complete Setup: First ask about Snow-Flow account
					a.step = stepCompleteSelectAccount
					a.setupCompleteAccountList()
				case "snow-flow":
					a.step = stepSelectLicenseType
					a.setupLicenseTypeList()
				case "llm":
					a.step = stepSelectLLMProvider
					a.loading = true
					a.loadingMessage = "Loading providers..."
					return a, a.loadProviders()
				case "servicenow":
					a.step = stepSelectServiceNowAuthMethod
					a.setupServiceNowAuthMethodList()
				}
			}
		}

	case stepSelectLicenseType:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				if opt.value == "portal" {
					// Portal (Individual/Teams) - ask which auth method (browser/email/magic-link)
					// Uses portal.snow-flow.dev directly
					a.step = stepSelectPortalAuthMethod
					a.setupPortalAuthMethodList()
				} else {
					// Enterprise - ask for subdomain first (e.g., acme.snow-flow.dev)
					a.step = stepInputEnterpriseSubdomain
					a.setupEnterpriseSubdomainInput()
				}
			}
		}

	case stepCompleteSelectAccount:
		// Complete Setup Step 1: Snow-Flow Account
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				if opt.value == "enterprise" {
					// Enterprise login - ask for subdomain first
					a.step = stepInputEnterpriseSubdomain
					a.setupEnterpriseSubdomainInput()
				} else {
					// Manual setup - go to ServiceNow configuration first
					a.step = stepSelectServiceNowAuthMethod
					a.setupServiceNowAuthMethodList()
				}
			}
		}

	case stepSelectLLMProvider:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				a.llmProvider = opt.value

				// Special cases
				if opt.value == "amazon-bedrock" {
					return a, tea.Sequence(
						util.CmdHandler(modal.CloseModalMsg{}),
						toast.NewInfoToast("Configure AWS credentials: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"),
					)
				}
				if opt.value == "google-vertex" {
					return a, tea.Sequence(
						util.CmdHandler(modal.CloseModalMsg{}),
						toast.NewInfoToast("Configure GCP: gcloud auth application-default login"),
					)
				}
				if opt.value == "midserver-llm" {
					// Check if we have enterprise ServiceNow credentials from portal
					if len(a.portalServiceNowInstances) > 0 {
						if len(a.portalServiceNowInstances) == 1 {
							// Single instance - use it directly
							instance := a.portalServiceNowInstances[0]
							a.instanceURL = instance.InstanceURL
							a.clientID = instance.ClientID
							a.clientSecret = instance.ClientSecret
							a.loading = true
							a.loadingMessage = "Using ServiceNow from enterprise portal..."
							return a, a.authenticateServiceNowForMidServer()
						}
						// Multiple instances - let user select which one to use for MID Server
						a.step = stepSelectPortalServiceNow
						a.setupPortalServiceNowList()
						return a, nil
					}
					// No enterprise credentials - need manual ServiceNow OAuth input
					a.step = stepInputServiceNow
					a.setupServiceNowInputs()
					return a, a.updateInputFocus()
				}

				// Load auth methods for this provider (OAuth options like Claude Pro/Max)
				a.loading = true
				a.loadingMessage = "Loading auth options..."
				return a, a.loadAuthMethods(opt.value)
			}
		}

	case stepSelectAuthMethod:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if _, ok := item.(authOption); ok {
				methodIndex := idx
				a.selectedMethodIndex = methodIndex

				if len(a.authMethods) > methodIndex {
					method := a.authMethods[methodIndex]
					if method.Type == "api" {
						// API key method - go to model selection first
						a.step = stepSelectModel
						a.loading = true
						a.loadingMessage = "Loading models..."
						return a, a.loadModels(a.llmProvider)
					} else {
						// OAuth method - start OAuth flow
						a.loading = true
						a.loadingMessage = "Starting authentication..."
						return a, a.startOAuth(a.llmProvider, methodIndex)
					}
				}
			}
		}

	case stepSelectModel:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				a.selectedModel = opt.value

				// If OAuth was already completed, just save model preference and close
				if a.oauthCompleted {
					a.loading = true
					a.loadingMessage = "Saving model preference..."
					return a, a.saveOAuthModelPreference()
				}

				// Otherwise, go to API key input
				a.step = stepInputAPIKey
				provider := a.findProvider(a.llmProvider)
				label := a.llmProvider
				if provider != nil {
					label = provider.Name
				}
				a.setupAPIKeyInput(a.llmProvider, label)
				return a, a.updateInputFocus()
			}
		}

	case stepSelectServiceNowAuthMethod:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				a.serviceNowAuthMethod = opt.value
				if opt.value == "oauth" {
					a.step = stepInputServiceNow
					a.setupServiceNowInputs()
				} else {
					a.step = stepInputServiceNowBasic
					a.setupServiceNowBasicInputs()
				}
				return a, a.updateInputFocus()
			}
		}

	case stepInputAPIKey:
		if len(a.inputs) > 0 && a.inputs[0].Value() != "" {
			a.apiKey = a.inputs[0].Value()
			a.loading = true
			a.loadingMessage = "Saving API key..."
			return a, a.saveAPIKey()
		}
		return a, toast.NewErrorToast("Please enter an API key")

	case stepInputServiceNow:
		if len(a.inputs) >= 3 {
			a.instanceURL = a.inputs[0].Value()
			a.clientID = a.inputs[1].Value()
			a.clientSecret = a.inputs[2].Value()

			if a.instanceURL == "" || a.clientID == "" || a.clientSecret == "" {
				return a, toast.NewErrorToast("Please fill in all fields")
			}

			a.loading = true
			if a.llmProvider == "midserver-llm" {
				// For MID Server LLM, we need to authenticate and then discover MID Servers
				a.loadingMessage = "Authenticating with ServiceNow..."
				return a, a.authenticateServiceNowForMidServer()
			}
			a.loadingMessage = "Authenticating with ServiceNow..."
			return a, a.saveServiceNowOAuth()
		}

	case stepSelectMidServer:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				a.selectedMidServer = opt.value
				// After selecting MID Server, discover REST Messages
				a.loading = true
				a.loadingMessage = "Discovering REST Messages..."
				return a, a.discoverRestMessages()
			}
		}

	case stepSelectRestMessage:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				a.selectedRestMessage = opt.value
				// Find the REST Message and show its HTTP methods
				for _, rm := range a.restMessages {
					if rm.Name == opt.value {
						if len(rm.Methods) > 0 {
							a.step = stepSelectHttpMethod
							a.setupHttpMethodList(rm.Methods)
							return a, nil
						}
						break
					}
				}
				// No methods found, try to discover models directly
				a.loading = true
				a.loadingMessage = "Discovering models..."
				return a, a.discoverMidServerModels()
			}
		}

	case stepSelectHttpMethod:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				a.selectedHttpMethod = opt.value
				// After selecting HTTP Method, discover models
				a.loading = true
				a.loadingMessage = "Discovering models..."
				return a, a.discoverMidServerModels()
			}
		}

	case stepSelectMidServerModel:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				a.selectedMidServerModel = opt.value
				// After selecting model, deploy API
				a.loading = true
				a.loadingMessage = "Deploying Snow-Flow LLM API..."
				return a, a.deployLLMAPI()
			}
		}

	case stepSelectPortalServiceNow:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				// Find the selected instance
				for _, inst := range a.portalServiceNowInstances {
					if fmt.Sprintf("%d", inst.ID) == opt.value {
						// Save for Complete Setup summary
						a.completeSetupServiceNow = inst.InstanceName
						// Check if this is for MID Server LLM flow
						if a.llmProvider == "midserver-llm" {
							// Use instance credentials for MID Server authentication
							a.instanceURL = inst.InstanceURL
							a.clientID = inst.ClientID
							a.clientSecret = inst.ClientSecret
							a.loading = true
							a.loadingMessage = fmt.Sprintf("Authenticating with %s for MID Server...", inst.InstanceName)
							return a, a.authenticateServiceNowForMidServer()
						}
						// Regular Complete Setup flow - configure ServiceNow
						a.loading = true
						a.loadingMessage = fmt.Sprintf("Configuring ServiceNow (%s)...", inst.InstanceName)
						return a, a.configurePortalServiceNow(inst)
					}
				}
			}
		}

	case stepInputServiceNowBasic:
		if len(a.inputs) >= 3 {
			a.instanceURL = a.inputs[0].Value()
			a.username = a.inputs[1].Value()
			a.password = a.inputs[2].Value()

			if a.instanceURL == "" || a.username == "" || a.password == "" {
				return a, toast.NewErrorToast("Please fill in all fields")
			}

			a.loading = true
			a.loadingMessage = "Saving credentials..."
			return a, a.saveServiceNowBasic()
		}

	case stepInputEnterpriseSubdomain:
		if len(a.inputs) > 0 && a.inputs[0].Value() != "" {
			subdomain := strings.TrimSpace(a.inputs[0].Value())
			// Remove any .snow-flow.dev suffix if user typed it
			subdomain = strings.TrimSuffix(subdomain, ".snow-flow.dev")
			subdomain = strings.ToLower(subdomain)
			a.enterpriseSubdomain = subdomain
			// Now start browser auth
			a.step = stepBrowserAuth
			a.waitingForBrowser = true
			a.browserMessage = fmt.Sprintf("Opening browser for %s.snow-flow.dev...", subdomain)
			return a, a.startBrowserAuth("enterprise")
		}
		return a, toast.NewErrorToast("Please enter your organization subdomain")

	case stepInputEnterpriseCode:
		if len(a.inputs) > 0 && a.inputs[0].Value() != "" {
			a.enterpriseAuthCode = strings.TrimSpace(a.inputs[0].Value())
			a.loading = true
			a.loadingMessage = "Verifying authorization code..."
			return a, a.verifyEnterpriseCode()
		}
		return a, toast.NewErrorToast("Please enter the authorization code from the browser")

	case stepInputOAuthCode:
		if len(a.inputs) > 0 && a.inputs[0].Value() != "" {
			a.loading = true
			a.loadingMessage = "Exchanging authorization code..."
			return a, a.exchangeOAuthCode()
		}
		return a, toast.NewErrorToast("Please paste the authorization code from the browser")

	case stepBrowserAuth:
		if a.waitingForBrowser {
			return a, a.checkBrowserAuth()
		}

	case stepSelectPortalAuthMethod:
		if item, idx := a.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(authOption); ok {
				a.portalAuthMethod = opt.value
				switch opt.value {
				case "browser":
					// Browser auth - same as before
					a.step = stepBrowserAuth
					a.waitingForBrowser = true
					a.browserMessage = "Opening browser for Snow-Flow Portal login..."
					return a, a.startBrowserAuth("portal")
				case "email":
					// Email/password input
					a.step = stepInputPortalEmail
					a.setupPortalEmailInputs()
					return a, a.updateInputFocus()
				case "magic-link":
					// Magic link - first ask for email
					a.step = stepInputPortalMagicLinkEmail
					a.setupPortalMagicLinkEmailInput()
					return a, a.updateInputFocus()
				}
			}
		}

	case stepInputPortalEmail:
		if len(a.inputs) >= 2 {
			a.portalEmail = a.inputs[0].Value()
			a.portalPassword = a.inputs[1].Value()

			if a.portalEmail == "" || a.portalPassword == "" {
				return a, toast.NewErrorToast("Please fill in both email and password")
			}

			a.loading = true
			a.loadingMessage = "Authenticating..."
			return a, a.portalEmailLogin()
		}

	case stepInputPortalMagicLinkEmail:
		if len(a.inputs) > 0 && a.inputs[0].Value() != "" {
			a.portalEmail = a.inputs[0].Value()
			a.loading = true
			a.loadingMessage = "Sending magic link..."
			return a, a.portalMagicLinkRequest()
		}
		return a, toast.NewErrorToast("Please enter your email address")

	case stepInputPortalMagicLinkCode:
		if len(a.inputs) > 0 && a.inputs[0].Value() != "" {
			a.portalMagicLinkCode = strings.TrimSpace(a.inputs[0].Value())
			a.loading = true
			a.loadingMessage = "Verifying code..."
			return a, a.portalMagicLinkVerify()
		}
		return a, toast.NewErrorToast("Please enter the code from your email")
	}

	return a, nil
}

func (a *authDialog) goBack() {
	switch a.step {
	case stepSelectLicenseType:
		a.step = stepSelectAuthType
		a.setupAuthTypeList()
	case stepCompleteSelectAccount:
		a.step = stepSelectAuthType
		a.setupAuthTypeList()
	case stepSelectLLMProvider:
		// In Complete Setup, go back to account selection; otherwise go back to auth type
		if a.authType == "complete" {
			a.step = stepCompleteSelectAccount
			a.setupCompleteAccountList()
		} else {
			a.step = stepSelectAuthType
			a.setupAuthTypeList()
		}
	case stepSelectAuthMethod:
		a.step = stepSelectLLMProvider
		a.setupLLMProviderListFromProviders()
	case stepSelectModel:
		if len(a.authMethods) > 1 {
			a.step = stepSelectAuthMethod
			a.setupAuthMethodList()
		} else {
			a.step = stepSelectLLMProvider
			a.setupLLMProviderListFromProviders()
		}
	case stepInputAPIKey:
		if len(a.models) > 0 {
			a.step = stepSelectModel
			a.setupModelList()
		} else if len(a.authMethods) > 1 {
			a.step = stepSelectAuthMethod
			a.setupAuthMethodList()
		} else {
			a.step = stepSelectLLMProvider
			a.setupLLMProviderListFromProviders()
		}
	case stepInputOAuthCode:
		a.step = stepSelectAuthMethod
		a.setupAuthMethodList()
		a.oauthSessionId = ""
	case stepOAuthPolling:
		a.step = stepSelectAuthMethod
		a.setupAuthMethodList()
		a.oauthSessionId = ""
	case stepSelectServiceNowAuthMethod:
		// In Complete Setup (manual), go back to account selection
		if a.authType == "complete" {
			a.step = stepCompleteSelectAccount
			a.setupCompleteAccountList()
		} else {
			a.step = stepSelectAuthType
			a.setupAuthTypeList()
		}
	case stepInputServiceNow, stepInputServiceNowBasic:
		if a.llmProvider == "midserver-llm" {
			// MID Server LLM flow goes back to provider selection
			a.step = stepSelectLLMProvider
			a.setupLLMProviderListFromProviders()
		} else {
			a.step = stepSelectServiceNowAuthMethod
			a.setupServiceNowAuthMethodList()
		}
	case stepInputEnterpriseSubdomain:
		a.step = stepSelectLicenseType
		a.setupLicenseTypeList()
	case stepInputEnterpriseCode:
		a.step = stepInputEnterpriseSubdomain
		a.setupEnterpriseSubdomainInput()
	case stepBrowserAuth:
		a.waitingForBrowser = false
		if a.authType == "snow-flow" {
			a.step = stepSelectLicenseType
			a.setupLicenseTypeList()
		} else {
			a.step = stepSelectLLMProvider
			a.setupLLMProviderListFromProviders()
		}
	// MID Server LLM Configuration steps
	case stepSelectMidServer:
		a.step = stepInputServiceNow
		a.setupServiceNowInputs()
	case stepSelectRestMessage:
		a.step = stepSelectMidServer
		a.setupMidServerList()
	case stepSelectHttpMethod:
		a.step = stepSelectRestMessage
		a.setupRestMessageList()
	case stepSelectMidServerModel:
		if a.selectedHttpMethod != "" {
			a.step = stepSelectHttpMethod
			for _, rm := range a.restMessages {
				if rm.Name == a.selectedRestMessage {
					a.setupHttpMethodList(rm.Methods)
					break
				}
			}
		} else {
			a.step = stepSelectRestMessage
			a.setupRestMessageList()
		}
	case stepDeployLLMAPI, stepTestMidServer:
		if len(a.midServerModels) > 0 {
			a.step = stepSelectMidServerModel
			a.setupMidServerModelList()
		} else if a.selectedHttpMethod != "" {
			a.step = stepSelectHttpMethod
			for _, rm := range a.restMessages {
				if rm.Name == a.selectedRestMessage {
					a.setupHttpMethodList(rm.Methods)
					break
				}
			}
		} else {
			a.step = stepSelectRestMessage
			a.setupRestMessageList()
		}
	case stepSelectPortalServiceNow:
		// Check if this is for MID Server LLM flow
		if a.llmProvider == "midserver-llm" {
			// Go back to LLM provider selection
			a.step = stepSelectLLMProvider
			a.setupLLMProviderListFromProviders()
		}
		// For Complete Setup flow - going back from portal ServiceNow selection
		// Just close the modal - they can reconfigure later
	// Portal auth steps
	case stepSelectPortalAuthMethod:
		a.step = stepSelectLicenseType
		a.setupLicenseTypeList()
	case stepInputPortalEmail:
		a.step = stepSelectPortalAuthMethod
		a.setupPortalAuthMethodList()
	case stepInputPortalMagicLinkEmail:
		a.step = stepSelectPortalAuthMethod
		a.setupPortalAuthMethodList()
	case stepInputPortalMagicLinkCode:
		a.step = stepInputPortalMagicLinkEmail
		a.setupPortalMagicLinkEmailInput()
	}
}

func (a *authDialog) findProvider(id string) *Provider {
	for _, p := range a.providers {
		if p.ID == id {
			return &p
		}
	}
	return nil
}

func (a *authDialog) setupAuthTypeList() {
	options := []authOption{
		{value: "complete", label: "Complete Setup", description: "LLM + ServiceNow + License (recommended)"},
		{value: "snow-flow", label: "Snow-Flow License", description: "Individual/Teams or Enterprise"},
		{value: "llm", label: "LLM Provider", description: "Anthropic, OpenAI, etc."},
		{value: "servicenow", label: "ServiceNow Instance", description: "Direct connection"},
	}
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Authenticate"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupCompleteAccountList() {
	options := []authOption{
		{value: "enterprise", label: "Yes, Enterprise", description: "Browser login - auto-configures ServiceNow + credentials (recommended)"},
		{value: "manual", label: "No, manual setup", description: "Enter ServiceNow credentials manually"},
	}
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Step 1: Snow-Flow Account"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupLicenseTypeList() {
	options := []authOption{
		{value: "portal", label: "Individual / Teams", description: "Email-based login (€99/mo or €79/seat)"},
		{value: "enterprise", label: "Enterprise", description: "License key login (custom pricing)"},
	}
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Select Account Type"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupPortalAuthMethodList() {
	options := []authOption{
		{value: "browser", label: "Browser", description: "Recommended - opens browser for approval"},
		{value: "email", label: "Email & Password", description: "Direct login with credentials"},
		{value: "magic-link", label: "Magic Link", description: "Passwordless via email"},
	}
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Portal Authentication"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupPortalEmailInputs() {
	emailInput := textinput.New()
	emailInput.Placeholder = "your@email.com"
	emailInput.CharLimit = 100

	passwordInput := textinput.New()
	passwordInput.Placeholder = "••••••••"
	passwordInput.EchoMode = textinput.EchoPassword
	passwordInput.CharLimit = 100

	a.inputs = []textinput.Model{emailInput, passwordInput}
	a.focusedInput = 0
	a.inputLabels = []string{"Email", "Password"}
	a.inputs[0].Focus()
	a.modal = modal.New(modal.WithTitle("Portal Login"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupPortalMagicLinkEmailInput() {
	input := textinput.New()
	input.Placeholder = "your@email.com"
	input.Focus()
	input.CharLimit = 100
	a.inputs = []textinput.Model{input}
	a.focusedInput = 0
	a.inputLabels = []string{"Email"}
	a.modal = modal.New(modal.WithTitle("Magic Link - Enter Email"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupPortalMagicLinkCodeInput() {
	input := textinput.New()
	input.Placeholder = "Paste the code from your email..."
	input.Focus()
	input.CharLimit = 100
	a.inputs = []textinput.Model{input}
	a.focusedInput = 0
	a.inputLabels = []string{"Verification Code"}
	a.modal = modal.New(modal.WithTitle("Magic Link - Enter Code"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupServiceNowAuthMethodList() {
	options := []authOption{
		{value: "oauth", label: "OAuth 2.0", description: "Recommended - Client credentials"},
		{value: "basic", label: "Basic Auth", description: "Username & password"},
	}
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("ServiceNow Authentication"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupAuthMethodList() {
	var options []authOption
	for _, m := range a.authMethods {
		desc := ""
		if m.Type == "oauth" {
			desc = "Browser-based login"
		} else {
			desc = "Manual API key entry"
		}
		options = append(options, authOption{
			value:       m.Label,
			label:       m.Label,
			description: desc,
		})
	}
	a.setListItems(options)
	provider := a.findProvider(a.llmProvider)
	title := "Login Method"
	if provider != nil {
		title = provider.Name + " - Login Method"
	}
	a.modal = modal.New(modal.WithTitle(title), modal.WithMaxWidth(60))
}

func (a *authDialog) setupOAuthCodeInput() {
	input := textinput.New()
	input.Placeholder = "Paste authorization code here..."
	input.Focus()
	input.CharLimit = 200
	a.inputs = []textinput.Model{input}
	a.focusedInput = 0
	a.inputLabels = []string{"Authorization Code"}
	a.modal = modal.New(modal.WithTitle("Enter Authorization Code"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupLLMProviderListFromProviders() {
	var options []authOption
	for _, p := range a.providers {
		hint := p.Description
		if p.Recommended {
			hint += " (recommended)"
		}
		options = append(options, authOption{
			value:       p.ID,
			label:       p.Name,
			description: hint,
		})
	}
	// Store all options for filtering
	a.allProviderOptions = options
	// Initialize search input
	a.searchInput = textinput.New()
	a.searchInput.Placeholder = "Type to search..."
	a.searchInput.Focus()
	a.searchInput.CharLimit = 50
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Select LLM Provider"), modal.WithMaxWidth(60))
}

// filterProviderList filters the provider list based on search query
func (a *authDialog) filterProviderList(query string) {
	if query == "" {
		a.setListItems(a.allProviderOptions)
		return
	}
	query = strings.ToLower(query)
	var filtered []authOption
	for _, opt := range a.allProviderOptions {
		if strings.Contains(strings.ToLower(opt.label), query) ||
			strings.Contains(strings.ToLower(opt.description), query) ||
			strings.Contains(strings.ToLower(opt.value), query) {
			filtered = append(filtered, opt)
		}
	}
	a.setListItems(filtered)
}

func (a *authDialog) setupModelList() {
	var options []authOption
	for _, m := range a.models {
		desc := ""
		if m.ContextWindow > 0 {
			desc = fmt.Sprintf("%dK context", m.ContextWindow/1000)
		}
		if m.Status != "" {
			if desc != "" {
				desc += " "
			}
			desc += "[" + m.Status + "]"
		}
		options = append(options, authOption{
			value:       m.ID,
			label:       m.Name,
			description: desc,
		})
	}

	if len(options) == 0 {
		// No models available, skip to API key input
		provider := a.findProvider(a.llmProvider)
		label := a.llmProvider
		if provider != nil {
			label = provider.Name
		}
		a.step = stepInputAPIKey
		a.setupAPIKeyInput(a.llmProvider, label)
		return
	}

	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Select Model"), modal.WithMaxWidth(60))
}

func (a *authDialog) setListItems(options []authOption) {
	items := make([]list.Item, len(options))
	for i, opt := range options {
		items[i] = opt
	}

	a.list = list.NewListComponent(
		list.WithItems(items),
		list.WithMaxVisibleHeight[list.Item](12),
		list.WithFallbackMessage[list.Item]("No options available"),
		list.WithRenderFunc(func(item list.Item, selected bool, width int, baseStyle styles.Style) string {
			return item.Render(selected, width, baseStyle)
		}),
		list.WithSelectableFunc(func(item list.Item) bool {
			return item.Selectable()
		}),
	)
	a.list.SetMaxWidth(55)
}

func (a *authDialog) setupAPIKeyInput(provider, providerLabel string) {
	ti := textinput.New()
	ti.Placeholder = fmt.Sprintf("Enter your %s API key", providerLabel)
	ti.CharLimit = 256
	ti.SetWidth(50)
	ti.EchoMode = textinput.EchoPassword
	ti.EchoCharacter = '•'
	ti.Focus()

	a.inputs = []textinput.Model{ti}
	a.inputLabels = []string{"API Key"}
	a.focusedInput = 0
	a.modal = modal.New(modal.WithTitle(providerLabel+" API Key"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupServiceNowInputs() {
	ti1 := textinput.New()
	ti1.Placeholder = "dev12345.service-now.com"
	ti1.CharLimit = 128
	ti1.SetWidth(50)
	ti1.Focus()

	ti2 := textinput.New()
	ti2.Placeholder = "OAuth Client ID (32+ characters)"
	ti2.CharLimit = 128
	ti2.SetWidth(50)

	ti3 := textinput.New()
	ti3.Placeholder = "OAuth Client Secret"
	ti3.CharLimit = 256
	ti3.SetWidth(50)
	ti3.EchoMode = textinput.EchoPassword
	ti3.EchoCharacter = '•'

	a.inputs = []textinput.Model{ti1, ti2, ti3}
	a.inputLabels = []string{"Instance URL", "Client ID", "Client Secret"}
	a.focusedInput = 0
	a.modal = modal.New(modal.WithTitle("ServiceNow OAuth Credentials"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupServiceNowBasicInputs() {
	ti1 := textinput.New()
	ti1.Placeholder = "dev12345.service-now.com"
	ti1.CharLimit = 128
	ti1.SetWidth(50)
	ti1.Focus()

	ti2 := textinput.New()
	ti2.Placeholder = "Username"
	ti2.CharLimit = 128
	ti2.SetWidth(50)

	ti3 := textinput.New()
	ti3.Placeholder = "Password"
	ti3.CharLimit = 256
	ti3.SetWidth(50)
	ti3.EchoMode = textinput.EchoPassword
	ti3.EchoCharacter = '•'

	a.inputs = []textinput.Model{ti1, ti2, ti3}
	a.inputLabels = []string{"Instance URL", "Username", "Password"}
	a.focusedInput = 0
	a.modal = modal.New(modal.WithTitle("ServiceNow Basic Auth"), modal.WithMaxWidth(60))
}

func (a *authDialog) updateInputFocus() tea.Cmd {
	cmds := make([]tea.Cmd, len(a.inputs))
	for i := range a.inputs {
		if i == a.focusedInput {
			cmds[i] = a.inputs[i].Focus()
		} else {
			a.inputs[i].Blur()
		}
	}
	return tea.Batch(cmds...)
}

// HTTP calls to server API

type ProvidersLoadedMsg struct {
	Providers []Provider
	Error     string
}

type ModelsLoadedMsg struct {
	Models []Model
	Error  string
}

type AuthSavedMsg struct {
	Success bool
	Message string
	Error   string
}

// AuthMethodsLoadedMsg is sent when auth methods are loaded for a provider
type AuthMethodsLoadedMsg struct {
	Methods []AuthMethod
	Error   string
}

// OAuthAuthorizeMsg is sent when OAuth authorization is started
type OAuthAuthorizeMsg struct {
	Success      bool
	SessionId    string
	URL          string
	Instructions string
	Method       string // "code" or "auto"
	Error        string
}

// OAuthExchangeMsg is sent when OAuth code exchange completes
type OAuthExchangeMsg struct {
	Success bool
	Error   string
}

// OAuthPollMsg is sent when OAuth polling completes
type OAuthPollMsg struct {
	Success  bool
	Complete bool
	Error    string
}

// MID Server LLM Configuration message types
type MidServersLoadedMsg struct {
	MidServers []MidServer
	Error      string
}

type RestMessagesLoadedMsg struct {
	RestMessages []RestMessage
	Error        string
}

type MidServerModelsLoadedMsg struct {
	Models []MidServerModel
	Error  string
}

type DeployLLMAPIMsg struct {
	Success   bool
	Namespace string
	BaseUri   string
	Error     string
}

type TestMidServerMsg struct {
	Success  bool
	Response string
	Error    string
}

type ServiceNowOAuthCompleteMsg struct {
	Success     bool
	AccessToken string
	Error       string
}

func (a *authDialog) loadProviders() tea.Cmd {
	serverURL := a.serverURL
	return func() tea.Msg {
		url := serverURL + "/auth/providers"
		slog.Debug("Loading providers", "url", url)

		resp, err := http.Get(url)
		if err != nil {
			slog.Error("Failed to load providers", "error", err, "url", url)
			return ProvidersLoadedMsg{Error: err.Error()}
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			slog.Error("Provider load failed", "status", resp.StatusCode, "url", url)
			return ProvidersLoadedMsg{Error: fmt.Sprintf("HTTP %d (URL: %s)", resp.StatusCode, url)}
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return ProvidersLoadedMsg{Error: err.Error()}
		}

		var providers []Provider
		if err := json.Unmarshal(body, &providers); err != nil {
			return ProvidersLoadedMsg{Error: err.Error()}
		}

		slog.Debug("Providers loaded", "count", len(providers))
		return ProvidersLoadedMsg{Providers: providers}
	}
}

func (a *authDialog) loadModels(providerId string) tea.Cmd {
	serverURL := a.serverURL
	return func() tea.Msg {
		url := serverURL + "/auth/providers/" + providerId + "/models"
		slog.Debug("Loading models", "url", url, "provider", providerId)

		resp, err := http.Get(url)
		if err != nil {
			slog.Error("Failed to load models", "error", err, "url", url)
			return ModelsLoadedMsg{Error: err.Error()}
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			slog.Error("Models load failed", "status", resp.StatusCode, "url", url)
			return ModelsLoadedMsg{Error: fmt.Sprintf("HTTP %d (URL: %s)", resp.StatusCode, url)}
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return ModelsLoadedMsg{Error: err.Error()}
		}

		var models []Model
		if err := json.Unmarshal(body, &models); err != nil {
			return ModelsLoadedMsg{Error: err.Error()}
		}

		slog.Debug("Models loaded", "count", len(models), "provider", providerId)
		return ModelsLoadedMsg{Models: models}
	}
}

// loadAuthMethods loads available auth methods for a provider (OAuth options)
func (a *authDialog) loadAuthMethods(providerId string) tea.Cmd {
	serverURL := a.serverURL
	return func() tea.Msg {
		url := serverURL + "/auth/providers/" + providerId + "/methods"
		slog.Debug("Loading auth methods", "url", url, "provider", providerId)

		resp, err := http.Get(url)
		if err != nil {
			slog.Error("Failed to load auth methods", "error", err)
			return AuthMethodsLoadedMsg{Error: err.Error()}
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			// Default to API key only
			return AuthMethodsLoadedMsg{Methods: []AuthMethod{{Label: "Enter API Key", Type: "api", Method: "api"}}}
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return AuthMethodsLoadedMsg{Error: err.Error()}
		}

		var methods []AuthMethod
		if err := json.Unmarshal(body, &methods); err != nil {
			return AuthMethodsLoadedMsg{Error: err.Error()}
		}

		slog.Debug("Auth methods loaded", "count", len(methods), "provider", providerId)
		return AuthMethodsLoadedMsg{Methods: methods}
	}
}

// startOAuth starts OAuth authorization flow
func (a *authDialog) startOAuth(providerId string, methodIndex int) tea.Cmd {
	serverURL := a.serverURL
	return func() tea.Msg {
		payload := map[string]interface{}{
			"provider":    providerId,
			"methodIndex": methodIndex,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/oauth/authorize", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return OAuthAuthorizeMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success      bool   `json:"success"`
			SessionId    string `json:"sessionId"`
			URL          string `json:"url"`
			Instructions string `json:"instructions"`
			Method       string `json:"method"`
			Error        string `json:"error"`
		}
		json.Unmarshal(body, &result)

		return OAuthAuthorizeMsg{
			Success:      result.Success,
			SessionId:    result.SessionId,
			URL:          result.URL,
			Instructions: result.Instructions,
			Method:       result.Method,
			Error:        result.Error,
		}
	}
}

// exchangeOAuthCode exchanges OAuth code for tokens
func (a *authDialog) exchangeOAuthCode() tea.Cmd {
	serverURL := a.serverURL
	provider := a.llmProvider
	sessionId := a.oauthSessionId
	code := strings.TrimSpace(a.inputs[0].Value())
	return func() tea.Msg {
		payload := map[string]string{
			"provider":  provider,
			"sessionId": sessionId,
			"code":      code,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/oauth/exchange", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return OAuthExchangeMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success bool   `json:"success"`
			Error   string `json:"error"`
		}
		json.Unmarshal(body, &result)

		return OAuthExchangeMsg{Success: result.Success, Error: result.Error}
	}
}

// pollOAuth polls for OAuth completion (GitHub Copilot style)
func (a *authDialog) pollOAuth() tea.Cmd {
	serverURL := a.serverURL
	provider := a.llmProvider
	sessionId := a.oauthSessionId
	return func() tea.Msg {
		payload := map[string]string{
			"provider":  provider,
			"sessionId": sessionId,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/oauth/poll", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return OAuthPollMsg{Success: false, Complete: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success  bool   `json:"success"`
			Complete bool   `json:"complete"`
			Error    string `json:"error"`
		}
		json.Unmarshal(body, &result)

		return OAuthPollMsg{Success: result.Success, Complete: result.Complete, Error: result.Error}
	}
}

func (a *authDialog) saveAPIKey() tea.Cmd {
	serverURL := a.serverURL
	return func() tea.Msg {
		payload := map[string]string{
			"provider": a.llmProvider,
			"apiKey":   a.apiKey,
		}
		if a.selectedModel != "" {
			payload["model"] = a.selectedModel
		}

		jsonData, _ := json.Marshal(payload)
		resp, err := http.Post(serverURL+"/auth/llm/apikey", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return AuthSavedMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			body, _ := io.ReadAll(resp.Body)
			return AuthSavedMsg{Success: false, Error: string(body)}
		}

		provider := a.findProvider(a.llmProvider)
		name := a.llmProvider
		if provider != nil {
			name = provider.Name
		}

		return AuthSavedMsg{Success: true, Message: name + " API key saved!"}
	}
}

func (a *authDialog) saveServiceNowOAuth() tea.Cmd {
	serverURL := a.serverURL
	return func() tea.Msg {
		// Use forceReauth: true for explicit /auth flow (user wants to re-authenticate)
		payload := map[string]interface{}{
			"instance":     a.instanceURL,
			"clientId":     a.clientID,
			"clientSecret": a.clientSecret,
			"forceReauth":  true, // Always do full OAuth for explicit auth flow
		}

		jsonData, _ := json.Marshal(payload)
		resp, err := http.Post(serverURL+"/auth/servicenow/oauth", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return AuthSavedMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success bool   `json:"success"`
			Error   string `json:"error"`
		}
		json.Unmarshal(body, &result)

		if result.Success {
			return AuthSavedMsg{Success: true, Message: "ServiceNow OAuth configured!"}
		}
		return AuthSavedMsg{Success: false, Error: result.Error}
	}
}

func (a *authDialog) saveServiceNowBasic() tea.Cmd {
	serverURL := a.serverURL
	return func() tea.Msg {
		payload := map[string]string{
			"instance": a.instanceURL,
			"username": a.username,
			"password": a.password,
		}

		jsonData, _ := json.Marshal(payload)
		resp, err := http.Post(serverURL+"/auth/servicenow/basic", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return AuthSavedMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success bool `json:"success"`
		}
		json.Unmarshal(body, &result)

		if result.Success {
			return AuthSavedMsg{Success: true, Message: "ServiceNow credentials saved!"}
		}
		return AuthSavedMsg{Success: false, Error: "Failed to save credentials"}
	}
}

func (a *authDialog) startBrowserAuth(authType string) tea.Cmd {
	// Capture subdomain for enterprise auth (used for subdomain-specific portal URLs)
	subdomain := a.enterpriseSubdomain
	return func() tea.Msg {
		switch authType {
		case "portal", "enterprise":
			// Determine portal URL
			// - Enterprise users: use their subdomain (e.g., acme.snow-flow.dev)
			// - Portal (Individual/Teams): use portal.snow-flow.dev
			var portalURL string
			if authType == "enterprise" && subdomain != "" && subdomain != "portal" {
				portalURL = fmt.Sprintf("https://%s.snow-flow.dev", subdomain)
			} else {
				portalURL = getEnterprisePortalURL() // Falls back to portal.snow-flow.dev or saved config
			}

			hostname, _ := os.Hostname()
			machineInfo := fmt.Sprintf("%s@%s (%s)", os.Getenv("USER"), hostname, "darwin")

			payload := map[string]string{"machineInfo": machineInfo}
			jsonData, _ := json.Marshal(payload)

			resp, err := http.Post(portalURL+"/api/auth/device/request", "application/json", bytes.NewBuffer(jsonData))
			if err != nil {
				return EnterpriseSessionMsg{Success: false, Error: err.Error()}
			}
			defer resp.Body.Close()

			body, _ := io.ReadAll(resp.Body)
			var result struct {
				SessionId       string `json:"sessionId"`
				VerificationUrl string `json:"verificationUrl"`
				Error           string `json:"error"`
			}
			json.Unmarshal(body, &result)

			if resp.StatusCode != 200 || result.SessionId == "" {
				errMsg := result.Error
				if errMsg == "" {
					errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
				}
				return EnterpriseSessionMsg{Success: false, Error: errMsg}
			}

			// Open browser for user to approve
			exec.Command("open", result.VerificationUrl).Start()

			// Return session ID for code verification step
			return EnterpriseSessionMsg{
				Success:         true,
				SessionId:       result.SessionId,
				VerificationURL: result.VerificationUrl,
			}

		default:
			// OAuth for LLM providers - fallback (shouldn't be used anymore)
			var url string
			url = "https://console.anthropic.com/oauth"
			if authType == "google-oauth" {
				url = "https://accounts.google.com/o/oauth2/auth"
			}
			exec.Command("open", url).Start()
			time.Sleep(2 * time.Second)
			return BrowserAuthWaitingMsg{}
		}
	}
}

func (a *authDialog) checkBrowserAuth() tea.Cmd {
	return func() tea.Msg {
		// For now, assume success after user presses enter
		// In production, this would poll the server for auth completion
		return BrowserAuthCompleteMsg{Success: true}
	}
}

// BrowserAuthWaitingMsg indicates browser auth is in progress
type BrowserAuthWaitingMsg struct{}

// BrowserAuthCompleteMsg indicates browser auth completed
type BrowserAuthCompleteMsg struct {
	Success bool
	Error   string
}

// EnterpriseSessionMsg indicates enterprise device auth session created
type EnterpriseSessionMsg struct {
	Success         bool
	SessionId       string
	VerificationURL string
	Error           string
}

// EnterpriseVerifyMsg indicates enterprise code verification result
type EnterpriseVerifyMsg struct {
	Success         bool
	Token           string
	CustomerName    string
	CustomerCompany string
	Slug            string // Subdomain slug for future auth redirects
	Role            string
	EnabledServices []string
	Error           string
}

// EnterpriseCredentialsMsg indicates enterprise credentials have been fetched
type EnterpriseCredentialsMsg struct {
	Success              bool
	Credentials          *EnterpriseCredentials
	ServiceNowInstances  []ServiceNowInstanceFromPortal
	McpServerUrl         string
	Theme                map[string]interface{}
	Error                string
}

// PortalServiceNowConfigMsg indicates ServiceNow has been configured from portal
type PortalServiceNowConfigMsg struct {
	Success bool
	Error   string
}

// EnterpriseMcpConfigMsg indicates enterprise MCP has been configured
type EnterpriseMcpConfigMsg struct {
	Success bool
	Error   string
}

// PortalLoginMsg indicates portal email/password login result
type PortalLoginMsg struct {
	Success         bool
	Token           string
	Email           string
	Name            string
	Plan            string
	Organization    string
	Role            string
	EnabledServices []string
	Error           string
}

// PortalMagicLinkRequestMsg indicates magic link was sent
type PortalMagicLinkRequestMsg struct {
	Success bool
	Message string
	Error   string
}

// PortalMagicLinkVerifyMsg indicates magic link code verification result
type PortalMagicLinkVerifyMsg struct {
	Success         bool
	Token           string
	Email           string
	Name            string
	Plan            string
	Organization    string
	Role            string
	EnabledServices []string
	Error           string
}

// OAuthModelSavedMsg indicates OAuth model preference was saved
type OAuthModelSavedMsg struct {
	Success bool
	Error   string
}

func (a *authDialog) verifyEnterpriseCode() tea.Cmd {
	sessionId := a.enterpriseSessionId
	authCode := a.enterpriseAuthCode
	subdomain := a.enterpriseSubdomain
	return func() tea.Msg {
		// Determine portal URL based on subdomain
		var portalURL string
		if subdomain != "" && subdomain != "portal" {
			portalURL = fmt.Sprintf("https://%s.snow-flow.dev", subdomain)
		} else {
			portalURL = getEnterprisePortalURL()
		}

		// Call enterprise portal directly, same as CLI
		payload := map[string]string{
			"sessionId": sessionId,
			"authCode":  authCode,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(portalURL+"/api/auth/device/verify", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return EnterpriseVerifyMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Token    string `json:"token"`
			AuthType string `json:"authType"`
			Customer struct {
				Name    string `json:"name"`
				Company string `json:"company"`
				Slug    string `json:"slug"`
			} `json:"customer"`
			ServiceIntegrator struct {
				Name    string `json:"name"`
				Company string `json:"company"`
				Slug    string `json:"slug"`
			} `json:"serviceIntegrator"`
			Error string `json:"error"`
		}
		json.Unmarshal(body, &result)

		if resp.StatusCode != 200 || result.Token == "" {
			errMsg := result.Error
			if errMsg == "" {
				errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
			return EnterpriseVerifyMsg{Success: false, Error: errMsg}
		}

		// Extract slug from customer or serviceIntegrator response
		slug := result.Customer.Slug
		if slug == "" {
			slug = result.ServiceIntegrator.Slug
		}

		// Determine name and company from available data
		name := result.Customer.Name
		company := result.Customer.Company
		if name == "" {
			name = result.ServiceIntegrator.Name
			company = result.ServiceIntegrator.Company
		}

		slog.Info("Enterprise auth successful",
			"customer", name,
			"company", company,
			"slug", slug)

		return EnterpriseVerifyMsg{
			Success:         true,
			Token:           result.Token,
			CustomerName:    name,
			CustomerCompany: company,
			Slug:            slug,
		}
	}
}

// fetchEnterpriseCredentials fetches credentials from enterprise portal after successful verification
func (a *authDialog) fetchEnterpriseCredentials() tea.Cmd {
	token := a.enterpriseToken
	return func() tea.Msg {
		// Call enterprise portal to get credentials (including ServiceNow instances)
		client := &http.Client{Timeout: 30 * time.Second}
		req, err := http.NewRequest("GET", getEnterprisePortalURL()+"/api/auth/enterprise/credentials", nil)
		if err != nil {
			return EnterpriseCredentialsMsg{Success: false, Error: err.Error()}
		}
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := client.Do(req)
		if err != nil {
			return EnterpriseCredentialsMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			body, _ := io.ReadAll(resp.Body)
			var errResult struct {
				Error string `json:"error"`
			}
			json.Unmarshal(body, &errResult)
			errMsg := errResult.Error
			if errMsg == "" {
				errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
			return EnterpriseCredentialsMsg{Success: false, Error: errMsg}
		}

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Credentials          *EnterpriseCredentials        `json:"credentials"`
			ServiceNowInstances  []ServiceNowInstanceFromPortal `json:"servicenowInstances"`
			McpServerUrl         string                        `json:"mcpServerUrl"`
			Theme                map[string]interface{}        `json:"theme"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			return EnterpriseCredentialsMsg{Success: false, Error: "Failed to parse credentials: " + err.Error()}
		}

		slog.Info("Enterprise credentials fetched",
			"hasCredentials", result.Credentials != nil,
			"serviceNowInstances", len(result.ServiceNowInstances),
			"mcpServerUrl", result.McpServerUrl)

		return EnterpriseCredentialsMsg{
			Success:             true,
			Credentials:         result.Credentials,
			ServiceNowInstances: result.ServiceNowInstances,
			McpServerUrl:        result.McpServerUrl,
			Theme:               result.Theme,
		}
	}
}

// configurePortalServiceNow configures ServiceNow from portal instance via server
func (a *authDialog) configurePortalServiceNow(instance ServiceNowInstanceFromPortal) tea.Cmd {
	serverURL := a.serverURL
	enterpriseToken := a.enterpriseToken
	mcpServerUrl := a.enterpriseMcpServerUrl
	role := a.completeSetupRole

	// Build enabled services list from enterprise credentials
	var enabledServices []string
	if a.enterpriseCredentials != nil {
		if a.enterpriseCredentials.Jira != nil && a.enterpriseCredentials.Jira.Enabled {
			enabledServices = append(enabledServices, "jira")
		}
		if a.enterpriseCredentials.AzureDevOps != nil && a.enterpriseCredentials.AzureDevOps.Enabled {
			enabledServices = append(enabledServices, "azdo")
		}
		if a.enterpriseCredentials.Confluence != nil && a.enterpriseCredentials.Confluence.Enabled {
			enabledServices = append(enabledServices, "confluence")
		}
	}

	return func() tea.Msg {
		// Strip protocol and trailing slash from instance URL
		instanceUrl := instance.InstanceURL
		if len(instanceUrl) > 8 && instanceUrl[:8] == "https://" {
			instanceUrl = instanceUrl[8:]
		} else if len(instanceUrl) > 7 && instanceUrl[:7] == "http://" {
			instanceUrl = instanceUrl[7:]
		}
		if len(instanceUrl) > 0 && instanceUrl[len(instanceUrl)-1] == '/' {
			instanceUrl = instanceUrl[:len(instanceUrl)-1]
		}

		// Configure ServiceNow via server endpoint
		payload := map[string]interface{}{
			"instanceUrl":   instanceUrl,
			"authMethod":    "oauth",
			"clientId":      instance.ClientID,
			"clientSecret":  instance.ClientSecret,
			// Also send enterprise config for MCP setup
			"enterpriseToken":    enterpriseToken,
			"enterpriseMcpUrl":   mcpServerUrl,
			// Send enabled services and role for documentation update
			"enabledServices":    enabledServices,
			"role":               role,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/servicenow/configure", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return PortalServiceNowConfigMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			body, _ := io.ReadAll(resp.Body)
			var errResult struct {
				Error string `json:"error"`
			}
			json.Unmarshal(body, &errResult)
			errMsg := errResult.Error
			if errMsg == "" {
				errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
			return PortalServiceNowConfigMsg{Success: false, Error: errMsg}
		}

		slog.Info("ServiceNow configured from portal",
			"instance", instanceUrl,
			"clientId", instance.ClientID[:8]+"...")

		return PortalServiceNowConfigMsg{Success: true}
	}
}

// configureEnterpriseMcp configures enterprise MCP server for third-party apps (Jira, Azure DevOps, Confluence)
// This is called when there are no ServiceNow instances but enterprise credentials exist
func (a *authDialog) configureEnterpriseMcp() tea.Cmd {
	serverURL := a.serverURL
	enterpriseToken := a.enterpriseToken
	mcpServerUrl := a.enterpriseMcpServerUrl
	role := a.completeSetupRole

	// Build enabled services list from enterprise credentials
	var enabledServices []string
	if a.enterpriseCredentials != nil {
		if a.enterpriseCredentials.Jira != nil && a.enterpriseCredentials.Jira.Enabled {
			enabledServices = append(enabledServices, "jira")
		}
		if a.enterpriseCredentials.AzureDevOps != nil && a.enterpriseCredentials.AzureDevOps.Enabled {
			enabledServices = append(enabledServices, "azdo")
		}
		if a.enterpriseCredentials.Confluence != nil && a.enterpriseCredentials.Confluence.Enabled {
			enabledServices = append(enabledServices, "confluence")
		}
	}

	return func() tea.Msg {
		// Call server endpoint to configure enterprise MCP
		payload := map[string]interface{}{
			"enterpriseToken":  enterpriseToken,
			"mcpServerUrl":     mcpServerUrl,
			// Send enabled services and role for documentation update
			"enabledServices":  enabledServices,
			"role":             role,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/enterprise/configure-mcp", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return EnterpriseMcpConfigMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			body, _ := io.ReadAll(resp.Body)
			var errResult struct {
				Error string `json:"error"`
			}
			json.Unmarshal(body, &errResult)
			errMsg := errResult.Error
			if errMsg == "" {
				errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
			return EnterpriseMcpConfigMsg{Success: false, Error: errMsg}
		}

		slog.Info("Enterprise MCP configured",
			"mcpServerUrl", mcpServerUrl)

		return EnterpriseMcpConfigMsg{Success: true}
	}
}

// portalEmailLogin performs email/password login via server endpoint
func (a *authDialog) portalEmailLogin() tea.Cmd {
	serverURL := a.serverURL
	email := a.portalEmail
	password := a.portalPassword
	return func() tea.Msg {
		payload := map[string]string{
			"email":    email,
			"password": password,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/portal/login", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return PortalLoginMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success         bool     `json:"success"`
			Token           string   `json:"token"`
			User            struct {
				Email string `json:"email"`
				Name  string `json:"name"`
				Plan  string `json:"plan"`
				Role  string `json:"role"`
			} `json:"user"`
			Organization    struct {
				Name string `json:"name"`
			} `json:"organization"`
			EnabledServices []string `json:"enabledServices"`
			Error           string   `json:"error"`
		}
		json.Unmarshal(body, &result)

		if !result.Success {
			errMsg := result.Error
			if errMsg == "" {
				errMsg = "Authentication failed"
			}
			return PortalLoginMsg{Success: false, Error: errMsg}
		}

		return PortalLoginMsg{
			Success:         true,
			Token:           result.Token,
			Email:           result.User.Email,
			Name:            result.User.Name,
			Plan:            result.User.Plan,
			Organization:    result.Organization.Name,
			Role:            result.User.Role,
			EnabledServices: result.EnabledServices,
		}
	}
}

// portalMagicLinkRequest sends magic link to email via server endpoint
func (a *authDialog) portalMagicLinkRequest() tea.Cmd {
	serverURL := a.serverURL
	email := a.portalEmail
	return func() tea.Msg {
		payload := map[string]string{
			"email": email,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/portal/magic-link/request", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return PortalMagicLinkRequestMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
			Error   string `json:"error"`
		}
		json.Unmarshal(body, &result)

		if !result.Success {
			errMsg := result.Error
			if errMsg == "" {
				errMsg = "Failed to send magic link"
			}
			return PortalMagicLinkRequestMsg{Success: false, Error: errMsg}
		}

		return PortalMagicLinkRequestMsg{
			Success: true,
			Message: result.Message,
		}
	}
}

// portalMagicLinkVerify verifies the magic link code via server endpoint
func (a *authDialog) portalMagicLinkVerify() tea.Cmd {
	serverURL := a.serverURL
	code := a.portalMagicLinkCode
	return func() tea.Msg {
		payload := map[string]string{
			"code": code,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/portal/magic-link/verify", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return PortalMagicLinkVerifyMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success         bool     `json:"success"`
			Token           string   `json:"token"`
			User            struct {
				Email string `json:"email"`
				Name  string `json:"name"`
				Plan  string `json:"plan"`
				Role  string `json:"role"`
			} `json:"user"`
			Organization    struct {
				Name string `json:"name"`
			} `json:"organization"`
			EnabledServices []string `json:"enabledServices"`
			Error           string   `json:"error"`
		}
		json.Unmarshal(body, &result)

		if !result.Success {
			errMsg := result.Error
			if errMsg == "" {
				errMsg = "Invalid or expired code"
			}
			return PortalMagicLinkVerifyMsg{Success: false, Error: errMsg}
		}

		return PortalMagicLinkVerifyMsg{
			Success:         true,
			Token:           result.Token,
			Email:           result.User.Email,
			Name:            result.User.Name,
			Plan:            result.User.Plan,
			Organization:    result.Organization.Name,
			Role:            result.User.Role,
			EnabledServices: result.EnabledServices,
		}
	}
}

func (a *authDialog) setupEnterpriseSubdomainInput() {
	// Check if we already have a saved subdomain
	configPath := os.ExpandEnv("$HOME/.snow-code/enterprise.json")
	if data, err := os.ReadFile(configPath); err == nil {
		var config struct {
			Subdomain string `json:"subdomain"`
		}
		if json.Unmarshal(data, &config) == nil && config.Subdomain != "" {
			a.enterpriseSubdomain = config.Subdomain
		}
	}

	input := textinput.New()
	input.Placeholder = "e.g., acme (for acme.snow-flow.dev)"
	if a.enterpriseSubdomain != "" {
		input.SetValue(a.enterpriseSubdomain)
	}
	input.Focus()
	input.CharLimit = 50
	a.inputs = []textinput.Model{input}
	a.focusedInput = 0
	a.inputLabels = []string{"Your organization subdomain"}
	a.modal = modal.New(modal.WithTitle("Enterprise Portal"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupEnterpriseCodeInput() {
	input := textinput.New()
	input.Placeholder = "Paste your authorization code here..."
	input.Focus()
	input.CharLimit = 100
	a.inputs = []textinput.Model{input}
	a.focusedInput = 0
	a.inputLabels = []string{"Authorization Code"}
}

// saveOAuthModelPreference saves just the model preference after OAuth auth
func (a *authDialog) saveOAuthModelPreference() tea.Cmd {
	serverURL := a.serverURL
	provider := a.llmProvider
	model := a.selectedModel
	return func() tea.Msg {
		payload := map[string]string{
			"provider": provider,
			"model":    model,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/oauth/save-model", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return OAuthModelSavedMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			body, _ := io.ReadAll(resp.Body)
			var errResult struct {
				Error string `json:"error"`
			}
			json.Unmarshal(body, &errResult)
			return OAuthModelSavedMsg{Success: false, Error: errResult.Error}
		}

		return OAuthModelSavedMsg{Success: true}
	}
}

func (a *authDialog) Render(background string) string {
	t := theme.CurrentTheme()
	var content string

	if a.loading {
		loadingStyle := styles.NewStyle().Foreground(t.Primary())
		content = loadingStyle.Render("⏳ " + a.loadingMessage)
	} else {
		switch a.step {
		case stepSelectAuthType, stepSelectLicenseType,
			stepSelectModel, stepSelectServiceNowAuthMethod, stepSelectAuthMethod,
			stepCompleteSelectAccount, stepSelectPortalAuthMethod:
			content = a.list.View()

		case stepSelectLLMProvider:
			// Show search input above the list for LLM providers
			var lines []string
			labelStyle := styles.NewStyle().Foreground(t.TextMuted())
			lines = append(lines, labelStyle.Render("Search:"))
			lines = append(lines, a.searchInput.View())
			lines = append(lines, "")
			lines = append(lines, a.list.View())
			lines = append(lines, "")
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			lines = append(lines, helpStyle.Render("↑/↓: navigate • Enter: select • Type: search • Esc: back"))
			content = strings.Join(lines, "\n")

		case stepInputAPIKey, stepInputServiceNow, stepInputServiceNowBasic,
			stepInputPortalEmail, stepInputPortalMagicLinkEmail, stepInputPortalMagicLinkCode:
			var lines []string
			for i, input := range a.inputs {
				label := a.inputLabels[i]
				labelStyle := styles.NewStyle().Foreground(t.TextMuted())
				if i == a.focusedInput {
					labelStyle = labelStyle.Foreground(t.Primary()).Bold(true)
				}
				lines = append(lines, labelStyle.Render(label+":"))
				lines = append(lines, input.View())
				lines = append(lines, "")
			}
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			lines = append(lines, helpStyle.Render("Tab: next field • Enter: save • Esc: back"))
			content = strings.Join(lines, "\n")

		case stepInputEnterpriseSubdomain:
			var lines []string
			msgStyle := styles.NewStyle().Foreground(t.Primary())
			lines = append(lines, msgStyle.Render("🏢 Enterprise Portal"))
			lines = append(lines, "")
			helpTextStyle := styles.NewStyle().Foreground(t.TextMuted())
			lines = append(lines, helpTextStyle.Render("Enter your organization's subdomain to login."))
			lines = append(lines, helpTextStyle.Render("Example: if your portal is acme.snow-flow.dev, enter 'acme'"))
			lines = append(lines, "")
			for i, input := range a.inputs {
				label := a.inputLabels[i]
				labelStyle := styles.NewStyle().Foreground(t.TextMuted())
				if i == a.focusedInput {
					labelStyle = labelStyle.Foreground(t.Primary()).Bold(true)
				}
				lines = append(lines, labelStyle.Render(label+":"))
				lines = append(lines, input.View())
			}
			lines = append(lines, "")
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			lines = append(lines, helpStyle.Render("Enter: continue • Esc: back"))
			content = strings.Join(lines, "\n")

		case stepInputEnterpriseCode:
			var lines []string
			msgStyle := styles.NewStyle().Foreground(t.Primary())
			lines = append(lines, msgStyle.Render("🌐 Browser opened for authorization"))
			lines = append(lines, "")
			helpTextStyle := styles.NewStyle().Foreground(t.TextMuted())
			lines = append(lines, helpTextStyle.Render("1. Approve the authorization in your browser"))
			lines = append(lines, helpTextStyle.Render("2. Copy the code shown in the browser"))
			lines = append(lines, helpTextStyle.Render("3. Paste it below and press Enter"))
			lines = append(lines, "")
			for i, input := range a.inputs {
				label := a.inputLabels[i]
				labelStyle := styles.NewStyle().Foreground(t.TextMuted())
				if i == a.focusedInput {
					labelStyle = labelStyle.Foreground(t.Primary()).Bold(true)
				}
				lines = append(lines, labelStyle.Render(label+":"))
				lines = append(lines, input.View())
			}
			lines = append(lines, "")
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			lines = append(lines, helpStyle.Render("Enter: verify code • Esc: cancel"))
			content = strings.Join(lines, "\n")

		case stepInputOAuthCode:
			var lines []string
			msgStyle := styles.NewStyle().Foreground(t.Primary())
			provider := a.findProvider(a.llmProvider)
			providerName := a.llmProvider
			if provider != nil {
				providerName = provider.Name
			}
			lines = append(lines, msgStyle.Render("🌐 Browser opened for "+providerName+" authorization"))
			lines = append(lines, "")
			helpTextStyle := styles.NewStyle().Foreground(t.TextMuted())
			if a.oauthInstructions != "" {
				lines = append(lines, helpTextStyle.Render(a.oauthInstructions))
			} else {
				lines = append(lines, helpTextStyle.Render("1. Complete authorization in your browser"))
				lines = append(lines, helpTextStyle.Render("2. Copy the code shown after approval"))
				lines = append(lines, helpTextStyle.Render("3. Paste it below and press Enter"))
			}
			lines = append(lines, "")
			for i, input := range a.inputs {
				label := a.inputLabels[i]
				labelStyle := styles.NewStyle().Foreground(t.TextMuted())
				if i == a.focusedInput {
					labelStyle = labelStyle.Foreground(t.Primary()).Bold(true)
				}
				lines = append(lines, labelStyle.Render(label+":"))
				lines = append(lines, input.View())
			}
			lines = append(lines, "")
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			lines = append(lines, helpStyle.Render("Enter: submit code • Esc: cancel"))
			content = strings.Join(lines, "\n")

		case stepOAuthPolling:
			msgStyle := styles.NewStyle().Foreground(t.Primary())
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			provider := a.findProvider(a.llmProvider)
			providerName := a.llmProvider
			if provider != nil {
				providerName = provider.Name
			}
			instructions := a.browserMessage
			if instructions == "" {
				instructions = "Complete authorization in your browser"
			}
			content = msgStyle.Render("🌐 "+providerName+" Authorization") + "\n\n" +
				instructions + "\n\n" +
				helpStyle.Render("Waiting for authorization...\nPress Esc to cancel.")

		case stepBrowserAuth:
			msgStyle := styles.NewStyle().Foreground(t.Primary())
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			content = msgStyle.Render(a.browserMessage) + "\n\n" +
				helpStyle.Render("Complete authentication in your browser.\nPress Enter when done, or Esc to cancel.")

		// MID Server LLM Configuration steps
		case stepSelectMidServer, stepSelectRestMessage, stepSelectHttpMethod, stepSelectMidServerModel,
			stepSelectPortalServiceNow:
			content = a.list.View()

		case stepDeployLLMAPI:
			msgStyle := styles.NewStyle().Foreground(t.Primary())
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			content = msgStyle.Render("🚀 Deploying Snow-Flow LLM API") + "\n\n" +
				helpStyle.Render("Creating Scripted REST API and resources in ServiceNow...\nPlease wait.")

		case stepTestMidServer:
			msgStyle := styles.NewStyle().Foreground(t.Primary())
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			content = msgStyle.Render("🧪 Testing MID Server LLM") + "\n\n" +
				helpStyle.Render("Sending test message to LLM via MID Server...\nPlease wait.")
		}
	}

	return a.modal.Render(content, background)
}

func (a *authDialog) Close() tea.Cmd {
	return nil
}

// =====================================================
// MID Server LLM Configuration Setup Functions
// =====================================================

func (a *authDialog) setupMidServerList() {
	var options []authOption
	for _, server := range a.midServers {
		status := "Active"
		if !server.Validated {
			status = "Not Validated"
		}
		options = append(options, authOption{
			value:       server.Name,
			label:       server.Name,
			description: status,
		})
	}
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Select MID Server"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupRestMessageList() {
	var options []authOption
	for _, msg := range a.restMessages {
		methodCount := len(msg.Methods)
		desc := fmt.Sprintf("%d methods", methodCount)
		if msg.Endpoint != "" {
			desc = msg.Endpoint
		}
		options = append(options, authOption{
			value:       msg.Name,
			label:       msg.Name,
			description: desc,
		})
	}
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Select REST Message for LLM"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupHttpMethodList(methods []RestMessageMethod) {
	var options []authOption
	for _, method := range methods {
		options = append(options, authOption{
			value:       method.Name,
			label:       method.Name,
			description: method.HttpMethod,
		})
	}
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Select HTTP Method"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupMidServerModelList() {
	var options []authOption
	for _, model := range a.midServerModels {
		desc := ""
		if model.ContextWindow > 0 {
			desc = fmt.Sprintf("%dk context", model.ContextWindow/1000)
		}
		options = append(options, authOption{
			value:       model.ID,
			label:       model.Name,
			description: desc,
		})
	}
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Select Default Model"), modal.WithMaxWidth(60))
}

func (a *authDialog) setupPortalServiceNowList() {
	var options []authOption
	for _, inst := range a.portalServiceNowInstances {
		desc := inst.EnvironmentType
		if inst.IsDefault {
			desc = desc + " (default)"
		}
		options = append(options, authOption{
			value:       fmt.Sprintf("%d", inst.ID),
			label:       inst.InstanceName,
			description: desc,
		})
	}
	a.setListItems(options)
	a.modal = modal.New(modal.WithTitle("Select ServiceNow Instance"), modal.WithMaxWidth(60))
}

// =====================================================
// MID Server LLM Configuration API Functions
// =====================================================

// authenticateServiceNowForMidServer authenticates with ServiceNow and gets access token
func (a *authDialog) authenticateServiceNowForMidServer() tea.Cmd {
	serverURL := a.serverURL
	instanceURL := a.instanceURL
	clientID := a.clientID
	clientSecret := a.clientSecret
	return func() tea.Msg {
		// First save ServiceNow OAuth via the server
		payload := map[string]string{
			"instance":     instanceURL,
			"clientId":     clientID,
			"clientSecret": clientSecret,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/servicenow/oauth", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return ServiceNowOAuthCompleteMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success     bool   `json:"success"`
			AccessToken string `json:"accessToken"`
			Error       string `json:"error"`
		}
		json.Unmarshal(body, &result)

		if !result.Success {
			return ServiceNowOAuthCompleteMsg{Success: false, Error: result.Error}
		}

		// Return the access token from the server for MID Server API calls
		return ServiceNowOAuthCompleteMsg{Success: true, AccessToken: result.AccessToken}
	}
}

// discoverMidServers calls the server to discover MID Servers
func (a *authDialog) discoverMidServers() tea.Cmd {
	serverURL := a.serverURL
	instanceURL := a.instanceURL
	accessToken := a.snowAccessToken
	return func() tea.Msg {
		payload := map[string]string{
			"instanceUrl": instanceURL,
			"accessToken": accessToken,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/midserver/discover", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return MidServersLoadedMsg{Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success    bool        `json:"success"`
			MidServers []MidServer `json:"midServers"`
			Error      string      `json:"error"`
		}
		json.Unmarshal(body, &result)

		if !result.Success {
			return MidServersLoadedMsg{Error: result.Error}
		}

		return MidServersLoadedMsg{MidServers: result.MidServers}
	}
}

// discoverRestMessages calls the server to discover REST Messages
func (a *authDialog) discoverRestMessages() tea.Cmd {
	serverURL := a.serverURL
	instanceURL := a.instanceURL
	accessToken := a.snowAccessToken
	return func() tea.Msg {
		payload := map[string]string{
			"instanceUrl": instanceURL,
			"accessToken": accessToken,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/midserver/rest-messages", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return RestMessagesLoadedMsg{Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success      bool          `json:"success"`
			RestMessages []RestMessage `json:"restMessages"`
			Error        string        `json:"error"`
		}
		json.Unmarshal(body, &result)

		if !result.Success {
			return RestMessagesLoadedMsg{Error: result.Error}
		}

		return RestMessagesLoadedMsg{RestMessages: result.RestMessages}
	}
}

// discoverMidServerModels calls the server to discover models from LLM endpoint
func (a *authDialog) discoverMidServerModels() tea.Cmd {
	serverURL := a.serverURL
	instanceURL := a.instanceURL
	accessToken := a.snowAccessToken
	restMessage := a.selectedRestMessage
	return func() tea.Msg {
		payload := map[string]string{
			"instanceUrl": instanceURL,
			"accessToken": accessToken,
			"restMessage": restMessage,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/midserver/models", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return MidServerModelsLoadedMsg{Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success bool             `json:"success"`
			Models  []MidServerModel `json:"models"`
			Error   string           `json:"error"`
		}
		json.Unmarshal(body, &result)

		if !result.Success {
			return MidServerModelsLoadedMsg{Error: result.Error}
		}

		return MidServerModelsLoadedMsg{Models: result.Models}
	}
}

// deployLLMAPI calls the server to deploy the Snow-Flow LLM API
func (a *authDialog) deployLLMAPI() tea.Cmd {
	serverURL := a.serverURL
	instanceURL := a.instanceURL
	accessToken := a.snowAccessToken
	restMessage := a.selectedRestMessage
	httpMethod := a.selectedHttpMethod
	model := a.selectedMidServerModel
	return func() tea.Msg {
		payload := map[string]string{
			"instanceUrl":  instanceURL,
			"accessToken":  accessToken,
			"restMessage":  restMessage,
			"httpMethod":   httpMethod,
			"defaultModel": model,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/midserver/deploy-api", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return DeployLLMAPIMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success   bool   `json:"success"`
			Namespace string `json:"namespace"`
			BaseUri   string `json:"baseUri"`
			Error     string `json:"error"`
		}
		json.Unmarshal(body, &result)

		if !result.Success {
			return DeployLLMAPIMsg{Success: false, Error: result.Error}
		}

		return DeployLLMAPIMsg{Success: true, Namespace: result.Namespace, BaseUri: result.BaseUri}
	}
}

// testMidServer calls the server to test LLM connectivity
func (a *authDialog) testMidServer() tea.Cmd {
	serverURL := a.serverURL
	instanceURL := a.instanceURL
	accessToken := a.snowAccessToken
	restMessage := a.selectedRestMessage
	httpMethod := a.selectedHttpMethod
	model := a.selectedMidServerModel
	apiBaseUri := a.deployedApiBaseUri
	return func() tea.Msg {
		payload := map[string]string{
			"instanceUrl": instanceURL,
			"accessToken": accessToken,
			"restMessage": restMessage,
			"httpMethod":  httpMethod,
			"model":       model,
			"apiBaseUri":  apiBaseUri,
		}
		jsonData, _ := json.Marshal(payload)

		resp, err := http.Post(serverURL+"/auth/midserver/test", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return TestMidServerMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var result struct {
			Success  bool   `json:"success"`
			Response string `json:"response"`
			Error    string `json:"error"`
		}
		json.Unmarshal(body, &result)

		if !result.Success {
			return TestMidServerMsg{Success: false, Error: result.Error}
		}

		return TestMidServerMsg{Success: true, Response: result.Response}
	}
}

// showCompleteSetupSummary generates a success toast with complete setup information
func (a *authDialog) showCompleteSetupSummary(llmProviderName string, modelName string) tea.Cmd {
	var parts []string

	// Header
	parts = append(parts, "✅ Complete Setup finished!")

	// User info (if available from enterprise/portal auth)
	if a.completeSetupEmail != "" {
		parts = append(parts, fmt.Sprintf("👤 %s", a.completeSetupEmail))
	}
	if a.completeSetupCompany != "" {
		parts = append(parts, fmt.Sprintf("🏢 %s", a.completeSetupCompany))
	}
	if a.completeSetupPlan != "" && a.completeSetupRole != "" {
		parts = append(parts, fmt.Sprintf("📋 %s (%s)", a.completeSetupPlan, a.completeSetupRole))
	} else if a.completeSetupPlan != "" {
		parts = append(parts, fmt.Sprintf("📋 %s", a.completeSetupPlan))
	}

	// ServiceNow (prefer portal instance name, fallback to manually entered instanceURL)
	serviceNowInfo := a.completeSetupServiceNow
	if serviceNowInfo == "" && a.instanceURL != "" {
		serviceNowInfo = a.instanceURL
	}
	if serviceNowInfo != "" {
		parts = append(parts, fmt.Sprintf("🔧 ServiceNow: %s", serviceNowInfo))
	}

	// LLM Provider + Model
	if modelName != "" {
		parts = append(parts, fmt.Sprintf("🤖 LLM: %s (%s)", llmProviderName, modelName))
	} else {
		parts = append(parts, fmt.Sprintf("🤖 LLM: %s", llmProviderName))
	}

	// Third-party services (if available from enterprise)
	var services []string
	if a.enterpriseCredentials != nil {
		if a.enterpriseCredentials.Jira != nil && a.enterpriseCredentials.Jira.Enabled {
			services = append(services, "Jira")
		}
		if a.enterpriseCredentials.AzureDevOps != nil && a.enterpriseCredentials.AzureDevOps.Enabled {
			services = append(services, "Azure DevOps")
		}
		if a.enterpriseCredentials.Confluence != nil && a.enterpriseCredentials.Confluence.Enabled {
			services = append(services, "Confluence")
		}
	}
	// Also check portal enabled services
	if len(a.portalEnabledServices) > 0 {
		for _, svc := range a.portalEnabledServices {
			// Avoid duplicates
			found := false
			for _, s := range services {
				if s == svc {
					found = true
					break
				}
			}
			if !found {
				services = append(services, svc)
			}
		}
	}
	if len(services) > 0 {
		parts = append(parts, fmt.Sprintf("🔌 Services: %s", strings.Join(services, ", ")))
	}

	// Join with " | " for a compact toast message
	summary := strings.Join(parts, " | ")

	return toast.NewSuccessToast(summary)
}

// NewAuthDialog creates a new auth dialog with the given server URL
func NewAuthDialog(serverURL string) AuthDialog {
	// Use provided serverURL, fallback to env var, then to default
	originalURL := serverURL
	if serverURL == "" {
		serverURL = getServerURL()
		slog.Debug("Auth dialog using fallback server URL",
			"providedURL", originalURL,
			"fallbackURL", serverURL,
			"envVar", os.Getenv("SNOWCODE_SERVER"))
	} else {
		// Strip trailing slash to prevent double slashes in URL construction
		serverURL = strings.TrimSuffix(serverURL, "/")
		slog.Debug("Auth dialog using provided server URL",
			"serverURL", serverURL)
	}
	d := &authDialog{
		step:      stepSelectAuthType,
		serverURL: serverURL,
	}
	d.setupAuthTypeList()
	return d
}

// RunAuthProcessMsg is used to trigger the auth process (kept for compatibility)
type RunAuthProcessMsg struct {
	Cmd      *exec.Cmd
	AuthType string
}

// HandleAuthProcess handles the auth process execution (kept for compatibility)
func HandleAuthProcess(msg RunAuthProcessMsg) tea.Cmd {
	return tea.ExecProcess(msg.Cmd, func(err error) tea.Msg {
		if err != nil {
			return toast.NewErrorToast("Auth failed: " + err.Error())
		}
		return toast.NewSuccessToast("Authentication completed")
	})
}

// Ensure context is used (to avoid unused import)
var _ = context.Background
