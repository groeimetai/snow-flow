package app

import (
	"context"
	"fmt"
	"sync"

	"log/slog"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/fileutil"
	"github.com/sst/opencode/internal/message"
	"github.com/sst/opencode/internal/status"
	"github.com/sst/opencode/internal/tui/state"
	"github.com/sst/opencode/internal/tui/theme"
	"github.com/sst/opencode/internal/tui/util"
	"github.com/sst/opencode/pkg/client"
)

type App struct {
	Client   *client.ClientWithResponses
	Events   *client.Client
	Session  *client.SessionInfo
	Messages []client.MessageInfo

	MessagesOLD    MessageService
	LogsOLD        any // TODO: Define LogService interface when needed
	HistoryOLD     any // TODO: Define HistoryService interface when needed
	PermissionsOLD any // TODO: Define PermissionService interface when needed
	Status         status.Service

	PrimaryAgentOLD AgentService

	watcherCancelFuncs []context.CancelFunc
	cancelFuncsMutex   sync.Mutex
	watcherWG          sync.WaitGroup

	// UI state
	filepickerOpen       bool
	completionDialogOpen bool
}

func New(ctx context.Context) (*App, error) {
	// Initialize status service (still needed for UI notifications)
	err := status.InitService()
	if err != nil {
		slog.Error("Failed to initialize status service", "error", err)
		return nil, err
	}

	// Initialize file utilities
	fileutil.Init()

	// Create HTTP client
	url := "http://localhost:16713"
	httpClient, err := client.NewClientWithResponses(url)
	if err != nil {
		slog.Error("Failed to create client", "error", err)
		return nil, err
	}
	eventClient, err := client.NewClient(url)
	if err != nil {
		slog.Error("Failed to create event client", "error", err)
		return nil, err
	}

	// Create service bridges
	messageBridge := NewMessageServiceBridge(httpClient)
	agentBridge := NewAgentServiceBridge(httpClient)

	app := &App{
		Client:          httpClient,
		Events:          eventClient,
		Session:         &client.SessionInfo{},
		MessagesOLD:     messageBridge,
		PrimaryAgentOLD: agentBridge,
		Status:          status.GetService(),

		// TODO: These services need API endpoints:
		LogsOLD:        nil, // logging.GetService(),
		HistoryOLD:     nil, // history.GetService(),
		PermissionsOLD: nil, // permission.GetService(),
	}

	// Initialize theme based on configuration
	app.initTheme()

	return app, nil
}

// Create creates a new session
func (a *App) SendChatMessage(ctx context.Context, text string, attachments []message.Attachment) tea.Cmd {
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
		ProviderID: "anthropic",
		ModelID:    "claude-sonnet-4-20250514",
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

	infos := *resp.JSON200

	sessions := make([]client.SessionInfo, len(infos))
	for i, info := range infos {
		sessions[i] = client.SessionInfo{
			Id:    info.Id,
			Title: info.Title,
		}
	}

	return sessions, nil
}

// initTheme sets the application theme based on the configuration
func (app *App) initTheme() {
	cfg := config.Get()
	if cfg == nil || cfg.TUI.Theme == "" {
		return // Use default theme
	}

	// Try to set the theme from config
	err := theme.SetTheme(cfg.TUI.Theme)
	if err != nil {
		slog.Warn("Failed to set theme from config, using default theme", "theme", cfg.TUI.Theme, "error", err)
	} else {
		slog.Debug("Set theme from config", "theme", cfg.TUI.Theme)
	}
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
	// Cancel all watcher goroutines
	app.cancelFuncsMutex.Lock()
	for _, cancel := range app.watcherCancelFuncs {
		cancel()
	}
	app.cancelFuncsMutex.Unlock()
	app.watcherWG.Wait()
}
