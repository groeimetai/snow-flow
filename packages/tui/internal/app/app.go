package app

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"

	"log/slog"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/fileutil"
	"github.com/sst/opencode/internal/state"
	"github.com/sst/opencode/internal/status"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
	"github.com/sst/opencode/pkg/client"
)

type App struct {
	ConfigPath string
	Config     *config.Config
	Info       *client.AppInfo
	Client     *client.ClientWithResponses
	Provider   *client.ProviderInfo
	Model      *client.ProviderModel
	Session    *client.SessionInfo
	Messages   []client.MessageInfo
	Status     status.Service

	// UI state
	filepickerOpen       bool
	completionDialogOpen bool
}

func New(ctx context.Context, httpClient *client.ClientWithResponses) (*App, error) {
	err := status.InitService()
	if err != nil {
		slog.Error("Failed to initialize status service", "error", err)
		return nil, err
	}

	appInfoResponse, _ := httpClient.PostAppInfoWithResponse(ctx)
	appInfo := appInfoResponse.JSON200
	providersResponse, _ := httpClient.PostProviderListWithResponse(ctx)
	providers := []client.ProviderInfo{}
	var defaultProvider *client.ProviderInfo
	var defaultModel *client.ProviderModel

	for _, provider := range *providersResponse.JSON200 {
		if provider.Id == "anthropic" {
			defaultProvider = &provider

			for _, model := range provider.Models {
				if model.Id == "claude-sonnet-4-20250514" {
					defaultModel = &model
				}
			}
		}
		providers = append(providers, provider)
	}
	if len(providers) == 0 {
		return nil, fmt.Errorf("no providers found")
	}
	if defaultProvider == nil {
		defaultProvider = &providers[0]
	}
	if defaultModel == nil {
		defaultModel = &defaultProvider.Models[0]
	}

	appConfigPath := filepath.Join(appInfo.Path.Config, "tui.toml")
	appConfig, err := config.LoadConfig(appConfigPath)
	if err != nil {
		slog.Info("No TUI config found, using default values", "error", err)
		appConfig = config.NewConfig("opencode", defaultProvider.Id, defaultModel.Id)
		config.SaveConfig(appConfigPath, appConfig)
	}

	var currentProvider *client.ProviderInfo
	var currentModel *client.ProviderModel
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
		Info:       appInfo,
		Client:     httpClient,
		Provider:   currentProvider,
		Model:      currentModel,
		Session:    &client.SessionInfo{},
		Messages:   []client.MessageInfo{},
		Status:     status.GetService(),
	}

	theme.SetTheme(appConfig.Theme)
	fileutil.Init()

	return app, nil
}

type Attachment struct {
	FilePath string
	FileName string
	MimeType string
	Content  []byte
}

func (a *App) SaveConfig() {
	config.SaveConfig(a.ConfigPath, a.Config)
}

// Create creates a new session
func (a *App) SendChatMessage(ctx context.Context, text string, attachments []Attachment) tea.Cmd {
	var cmds []tea.Cmd
	if a.Session.Id == "" {
		resp, err := a.Client.PostSessionCreateWithResponse(ctx)
		if err != nil {
			status.Error(err.Error())
			return nil
		}
		if resp.StatusCode() != 200 {
			status.Error(fmt.Sprintf("failed to create session: %d", resp.StatusCode()))
			return nil
		}

		info := resp.JSON200
		a.Session = info

		cmds = append(cmds, util.CmdHandler(state.SessionSelectedMsg(info)))
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

	go a.Client.PostSessionChatWithResponse(ctx, client.PostSessionChatJSONRequestBody{
		SessionID:  a.Session.Id,
		Parts:      parts,
		ProviderID: a.Provider.Id,
		ModelID:    a.Model.Id,
	})

	// The actual response will come through SSE
	// For now, just return success
	return tea.Batch(cmds...)
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
	return providers, nil
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
