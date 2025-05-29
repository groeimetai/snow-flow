package app

import (
	"context"
	"maps"
	"sync"
	"time"

	"log/slog"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/fileutil"
	"github.com/sst/opencode/internal/lsp"
	"github.com/sst/opencode/internal/message"
	"github.com/sst/opencode/internal/session"
	"github.com/sst/opencode/internal/status"
	"github.com/sst/opencode/internal/tui/state"
	"github.com/sst/opencode/internal/tui/theme"
	"github.com/sst/opencode/internal/tui/util"
	"github.com/sst/opencode/pkg/client"
)

type App struct {
	State map[string]any

	CurrentSession *session.Session
	Logs           any // TODO: Define LogService interface when needed
	Sessions       SessionService
	Messages       MessageService
	History        any // TODO: Define HistoryService interface when needed
	Permissions    any // TODO: Define PermissionService interface when needed
	Status         status.Service
	Client         *client.ClientWithResponses
	Events         *client.Client

	PrimaryAgent AgentService

	LSPClients map[string]*lsp.Client

	clientsMutex sync.RWMutex

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
	sessionBridge := NewSessionServiceBridge(httpClient)
	messageBridge := NewMessageServiceBridge(httpClient)
	agentBridge := NewAgentServiceBridge(httpClient)

	app := &App{
		State:          make(map[string]any),
		Client:         httpClient,
		Events:         eventClient,
		CurrentSession: &session.Session{},
		Sessions:       sessionBridge,
		Messages:       messageBridge,
		PrimaryAgent:   agentBridge,
		Status:         status.GetService(),
		LSPClients:     make(map[string]*lsp.Client),

		// TODO: These services need API endpoints:
		Logs:        nil, // logging.GetService(),
		History:     nil, // history.GetService(),
		Permissions: nil, // permission.GetService(),
	}

	// Initialize theme based on configuration
	app.initTheme()

	return app, nil
}

// Create creates a new session
func (a *App) SendChatMessage(ctx context.Context, text string, attachments []message.Attachment) tea.Cmd {
	var cmds []tea.Cmd
	if a.CurrentSession.ID == "" {
		resp, err := a.Client.PostSessionCreateWithResponse(ctx)
		if err != nil {
			// return session.Session{}, err
		}
		if resp.StatusCode() != 200 {
			// return session.Session{}, fmt.Errorf("failed to create session: %d", resp.StatusCode())
		}
		info := resp.JSON200

		// Convert to old session type
		newSession := session.Session{
			ID:        info.Id,
			Title:     info.Title,
			CreatedAt: time.Now(), // API doesn't provide this yet
			UpdatedAt: time.Now(), // API doesn't provide this yet
		}

		if err != nil {
			status.Error(err.Error())
			return nil
		}

		a.CurrentSession = &newSession

		cmds = append(cmds, util.CmdHandler(state.SessionSelectedMsg(&newSession)))
	}

	// TODO: Handle attachments when API supports them
	if len(attachments) > 0 {
		// For now, ignore attachments
		// return "", fmt.Errorf("attachments not supported yet")
	}

	part := client.SessionMessagePart{}
	part.FromSessionMessagePartText(client.SessionMessagePartText{
		Type: "text",
		Text: text,
	})
	parts := []client.SessionMessagePart{part}

	go a.Client.PostSessionChatWithResponse(ctx, client.PostSessionChatJSONRequestBody{
		SessionID:  a.CurrentSession.ID,
		Parts:      parts,
		ProviderID: "anthropic",
		ModelID:    "claude-sonnet-4-20250514",
	})

	// The actual response will come through SSE
	// For now, just return success

	return tea.Batch(cmds...)
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

	// Perform additional cleanup for LSP clients
	app.clientsMutex.RLock()
	clients := make(map[string]*lsp.Client, len(app.LSPClients))
	maps.Copy(clients, app.LSPClients)
	app.clientsMutex.RUnlock()

	for name, client := range clients {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := client.Shutdown(shutdownCtx); err != nil {
			slog.Error("Failed to shutdown LSP client", "name", name, "error", err)
		}
		cancel()
	}
}
