package app

import (
	"context"
	"database/sql"
	"maps"
	"sync"
	"time"

	"log/slog"

	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/fileutil"
	"github.com/sst/opencode/internal/history"
	"github.com/sst/opencode/internal/llm/agent"
	"github.com/sst/opencode/internal/logging"
	"github.com/sst/opencode/internal/lsp"
	"github.com/sst/opencode/internal/message"
	"github.com/sst/opencode/internal/permission"
	"github.com/sst/opencode/internal/session"
	"github.com/sst/opencode/internal/status"
	"github.com/sst/opencode/internal/tui/theme"
)

type App struct {
	CurrentSession *session.Session
	Logs           logging.Service
	Sessions       session.Service
	Messages       message.Service
	History        history.Service
	Permissions    permission.Service
	Status         status.Service

	PrimaryAgent agent.Service

	LSPClients map[string]*lsp.Client

	clientsMutex sync.RWMutex

	watcherCancelFuncs []context.CancelFunc
	cancelFuncsMutex   sync.Mutex
	watcherWG          sync.WaitGroup
	
	// UI state
	filepickerOpen bool
	completionDialogOpen bool
}

func New(ctx context.Context, conn *sql.DB) (*App, error) {
	err := logging.InitService(conn)
	if err != nil {
		slog.Error("Failed to initialize logging service", "error", err)
		return nil, err
	}
	err = session.InitService(conn)
	if err != nil {
		slog.Error("Failed to initialize session service", "error", err)
		return nil, err
	}
	err = message.InitService(conn)
	if err != nil {
		slog.Error("Failed to initialize message service", "error", err)
		return nil, err
	}
	err = history.InitService(conn)
	if err != nil {
		slog.Error("Failed to initialize history service", "error", err)
		return nil, err
	}
	err = permission.InitService()
	if err != nil {
		slog.Error("Failed to initialize permission service", "error", err)
		return nil, err
	}
	err = status.InitService()
	if err != nil {
		slog.Error("Failed to initialize status service", "error", err)
		return nil, err
	}
	fileutil.Init()

	app := &App{
		CurrentSession: &session.Session{},
		Logs:           logging.GetService(),
		Sessions:       session.GetService(),
		Messages:       message.GetService(),
		History:        history.GetService(),
		Permissions:    permission.GetService(),
		Status:         status.GetService(),
		LSPClients:     make(map[string]*lsp.Client),
	}

	// Initialize theme based on configuration
	app.initTheme()

	// Initialize LSP clients in the background
	go app.initLSPClients(ctx)

	app.PrimaryAgent, err = agent.NewAgent(
		config.AgentPrimary,
		app.Sessions,
		app.Messages,
		agent.PrimaryAgentTools(
			app.Permissions,
			app.Sessions,
			app.Messages,
			app.History,
			app.LSPClients,
		),
	)
	if err != nil {
		slog.Error("Failed to create primary agent", "error", err)
		return nil, err
	}

	return app, nil
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
