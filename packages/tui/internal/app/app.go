package app

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"

	"log/slog"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/state"
	"github.com/sst/opencode/internal/status"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
	"github.com/sst/opencode/pkg/client"
)

type App struct {
	ConfigPath string
	Config     *config.Config
	Client     *client.ClientWithResponses
	Provider   *client.ProviderInfo
	Model      *client.ModelInfo
	Session    *client.SessionInfo
	Messages   []client.MessageInfo
	Status     status.Service

	// UI state
	filepickerOpen       bool
	completionDialogOpen bool
}

type AppInfo struct {
	client.AppInfo
	Version string
}

var Info AppInfo

func New(ctx context.Context, version string, httpClient *client.ClientWithResponses) (*App, error) {
	err := status.InitService()
	if err != nil {
		slog.Error("Failed to initialize status service", "error", err)
		return nil, err
	}

	appInfoResponse, _ := httpClient.PostAppInfoWithResponse(ctx)
	appInfo := appInfoResponse.JSON200
	Info = AppInfo{Version: version}
	Info.Git = appInfo.Git
	Info.Path = appInfo.Path
	Info.Time = appInfo.Time
	Info.User = appInfo.User

	providersResponse, err := httpClient.PostProviderListWithResponse(ctx)
	if err != nil {
		return nil, err
	}
	providers := []client.ProviderInfo{}
	var defaultProvider *client.ProviderInfo
	var defaultModel *client.ModelInfo

	var anthropic *client.ProviderInfo
	for _, provider := range providersResponse.JSON200.Providers {
		if provider.Id == "anthropic" {
			anthropic = &provider
		}
	}

	// default to anthropic if available
	if anthropic != nil {
		defaultProvider = anthropic
		defaultModel = getDefaultModel(providersResponse, *anthropic)
	}

	for _, provider := range providersResponse.JSON200.Providers {
		if defaultProvider == nil || defaultModel == nil {
			defaultProvider = &provider
			defaultModel = getDefaultModel(providersResponse, provider)
		}
		providers = append(providers, provider)
	}
	if len(providers) == 0 {
		return nil, fmt.Errorf("no providers found")
	}

	appConfigPath := filepath.Join(Info.Path.Config, "tui.toml")
	appConfig, err := config.LoadConfig(appConfigPath)
	if err != nil {
		slog.Info("No TUI config found, using default values", "error", err)
		appConfig = config.NewConfig("opencode", defaultProvider.Id, defaultModel.Id)
		config.SaveConfig(appConfigPath, appConfig)
	}

	var currentProvider *client.ProviderInfo
	var currentModel *client.ModelInfo
	for _, provider := range providers {
		if provider.Id == appConfig.Provider {
			currentProvider = &provider

			for _, model := range provider.Models {
				if model.Id == appConfig.Model {
					currentModel = &model
				}
			}
		}
	}

	app := &App{
		ConfigPath: appConfigPath,
		Config:     appConfig,
		Client:     httpClient,
		Provider:   currentProvider,
		Model:      currentModel,
		Session:    &client.SessionInfo{},
		Messages:   []client.MessageInfo{},
		Status:     status.GetService(),
	}

	theme.SetTheme(appConfig.Theme)

	return app, nil
}

func getDefaultModel(response *client.PostProviderListResponse, provider client.ProviderInfo) *client.ModelInfo {
	if match, ok := response.JSON200.Default[provider.Id]; ok {
		model := provider.Models[match]
		return &model
	} else {
		for _, model := range provider.Models {
			return &model
		}
	}
	return nil
}

type Attachment struct {
	FilePath string
	FileName string
	MimeType string
	Content  []byte
}

func (a *App) IsBusy() bool {
	if len(a.Messages) == 0 {
		return false
	}

	lastMessage := a.Messages[len(a.Messages)-1]
	return lastMessage.Metadata.Time.Completed == nil
}

func (a *App) SaveConfig() {
	config.SaveConfig(a.ConfigPath, a.Config)
}

func (a *App) InitializeProject(ctx context.Context) tea.Cmd {
	cmds := []tea.Cmd{}

	session, err := a.CreateSession(ctx)
	if err != nil {
		status.Error(err.Error())
		return nil
	}

	a.Session = session
	cmds = append(cmds, util.CmdHandler(state.SessionSelectedMsg(session)))

	go func() {
		// TODO: Handle no provider or model setup, yet
		response, err := a.Client.PostSessionInitialize(ctx, client.PostSessionInitializeJSONRequestBody{
			SessionID:  a.Session.Id,
			ProviderID: a.Provider.Id,
			ModelID:    a.Model.Id,
		})
		if err != nil {
			status.Error(err.Error())
		}
		if response != nil && response.StatusCode != 200 {
			status.Error(fmt.Sprintf("failed to initialize project: %d", response.StatusCode))
		}
	}()

	return tea.Batch(cmds...)
}

func (a *App) MarkProjectInitialized(ctx context.Context) error {
	response, err := a.Client.PostAppInitialize(ctx)
	if err != nil {
		slog.Error("Failed to mark project as initialized", "error", err)
		return err
	}
	if response != nil && response.StatusCode != 200 {
		return fmt.Errorf("failed to initialize project: %d", response.StatusCode)
	}
	return nil
}

func (a *App) CreateSession(ctx context.Context) (*client.SessionInfo, error) {
	resp, err := a.Client.PostSessionCreateWithResponse(ctx)
	if err != nil {
		return nil, err
	}
	if resp != nil && resp.StatusCode() != 200 {
		return nil, fmt.Errorf("failed to create session: %d", resp.StatusCode())
	}
	session := resp.JSON200
	return session, nil
}

func (a *App) SendChatMessage(ctx context.Context, text string, attachments []Attachment) tea.Cmd {
	var cmds []tea.Cmd
	if a.Session.Id == "" {
		session, err := a.CreateSession(ctx)
		if err != nil {
			status.Error(err.Error())
			return nil
		}
		a.Session = session
		cmds = append(cmds, util.CmdHandler(state.SessionSelectedMsg(session)))
	}

	// TODO: Handle attachments when API supports them
	if len(attachments) > 0 {
		// For now, ignore attachments
		// return "", fmt.Errorf("attachments not supported yet")
	}

	part := client.MessagePart{}
	part.FromMessagePartText(client.MessagePartText{
		Type: "text",
		Text: text,
	})
	parts := []client.MessagePart{part}

	go func() {
		response, err := a.Client.PostSessionChat(ctx, client.PostSessionChatJSONRequestBody{
			SessionID:  a.Session.Id,
			Parts:      parts,
			ProviderID: a.Provider.Id,
			ModelID:    a.Model.Id,
		})
		if err != nil {
			slog.Error("Failed to send message", "error", err)
			status.Error(err.Error())
		}
		if response != nil && response.StatusCode != 200 {
			slog.Error("Failed to send message", "error", fmt.Sprintf("failed to send message: %d", response.StatusCode))
			status.Error(fmt.Sprintf("failed to send message: %d", response.StatusCode))
		}
	}()

	// The actual response will come through SSE
	// For now, just return success
	return tea.Batch(cmds...)
}

func (a *App) Cancel(ctx context.Context, sessionID string) error {
	response, err := a.Client.PostSessionAbort(ctx, client.PostSessionAbortJSONRequestBody{
		SessionID: sessionID,
	})
	if err != nil {
		slog.Error("Failed to cancel session", "error", err)
		status.Error(err.Error())
		return err
	}
	if response != nil && response.StatusCode != 200 {
		slog.Error("Failed to cancel session", "error", fmt.Sprintf("failed to cancel session: %d", response.StatusCode))
		status.Error(fmt.Sprintf("failed to cancel session: %d", response.StatusCode))
		return fmt.Errorf("failed to cancel session: %d", response.StatusCode)
	}
	return nil
}

func (a *App) ListSessions(ctx context.Context) ([]client.SessionInfo, error) {
	resp, err := a.Client.PostSessionListWithResponse(ctx)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("failed to list sessions: %d", resp.StatusCode())
	}
	if resp.JSON200 == nil {
		return []client.SessionInfo{}, nil
	}
	sessions := *resp.JSON200

	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].Time.Created-sessions[j].Time.Created > 0
	})

	return sessions, nil
}

func (a *App) ListMessages(ctx context.Context, sessionId string) ([]client.MessageInfo, error) {
	resp, err := a.Client.PostSessionMessagesWithResponse(ctx, client.PostSessionMessagesJSONRequestBody{SessionID: sessionId})
	if err != nil {
		return nil, err
	}
	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("failed to list messages: %d", resp.StatusCode())
	}
	if resp.JSON200 == nil {
		return []client.MessageInfo{}, nil
	}
	messages := *resp.JSON200
	return messages, nil
}

func (a *App) ListProviders(ctx context.Context) ([]client.ProviderInfo, error) {
	resp, err := a.Client.PostProviderListWithResponse(ctx)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("failed to list sessions: %d", resp.StatusCode())
	}
	if resp.JSON200 == nil {
		return []client.ProviderInfo{}, nil
	}

	providers := *resp.JSON200
	return providers.Providers, nil
}

// IsFilepickerOpen returns whether the filepicker is currently open
func (app *App) IsFilepickerOpen() bool {
	return app.filepickerOpen
}

// SetFilepickerOpen sets the state of the filepicker
func (app *App) SetFilepickerOpen(open bool) {
	app.filepickerOpen = open
}

// IsCompletionDialogOpen returns whether the completion dialog is currently open
func (app *App) IsCompletionDialogOpen() bool {
	return app.completionDialogOpen
}

// SetCompletionDialogOpen sets the state of the completion dialog
func (app *App) SetCompletionDialogOpen(open bool) {
	app.completionDialogOpen = open
}

// Shutdown performs a clean shutdown of the application
func (app *App) Shutdown() {
	// TODO: cleanup?
}
