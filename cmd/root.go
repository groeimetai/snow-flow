package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"log/slog"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
	"github.com/spf13/cobra"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/logging"
	"github.com/sst/opencode/internal/lsp/discovery"
	"github.com/sst/opencode/internal/pubsub"
	"github.com/sst/opencode/internal/tui"
	"github.com/sst/opencode/internal/version"
)

type SessionIDHandler struct {
	slog.Handler
	app *app.App
}

func (h *SessionIDHandler) Handle(ctx context.Context, r slog.Record) error {
	if h.app != nil {
		sessionID := h.app.CurrentSession.ID
		if sessionID != "" {
			r.AddAttrs(slog.String("session_id", sessionID))
		}
	}
	return h.Handler.Handle(ctx, r)
}

func (h *SessionIDHandler) WithApp(app *app.App) *SessionIDHandler {
	h.app = app
	return h
}

var rootCmd = &cobra.Command{
	Use:   "OpenCode",
	Short: "A terminal AI assistant for software development",
	Long: `OpenCode is a powerful terminal-based AI assistant that helps with software development tasks.
It provides an interactive chat interface with AI capabilities, code analysis, and LSP integration
to assist developers in writing, debugging, and understanding code directly from the terminal.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// If the help flag is set, show the help message
		if cmd.Flag("help").Changed {
			cmd.Help()
			return nil
		}
		if cmd.Flag("version").Changed {
			fmt.Println(version.Version)
			return nil
		}

		// Setup logging
		lvl := new(slog.LevelVar)
		textHandler := slog.NewTextHandler(logging.NewSlogWriter(), &slog.HandlerOptions{Level: lvl})
		sessionAwareHandler := &SessionIDHandler{Handler: textHandler}
		logger := slog.New(sessionAwareHandler)
		slog.SetDefault(logger)

		// Load the config
		debug, _ := cmd.Flags().GetBool("debug")
		cwd, _ := cmd.Flags().GetString("cwd")
		if cwd != "" {
			err := os.Chdir(cwd)
			if err != nil {
				return fmt.Errorf("failed to change directory: %v", err)
			}
		}
		if cwd == "" {
			c, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("failed to get current working directory: %v", err)
			}
			cwd = c
		}
		_, err := config.Load(cwd, debug, lvl)
		if err != nil {
			return err
		}

		// Run LSP auto-discovery
		if err := discovery.IntegrateLSPServers(cwd); err != nil {
			slog.Warn("Failed to auto-discover LSP servers", "error", err)
			// Continue anyway, this is not a fatal error
		}

		// Create main context for the application
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		app, err := app.New(ctx)
		if err != nil {
			slog.Error("Failed to create app", "error", err)
			return err
		}
		sessionAwareHandler.WithApp(app)

		// Set up the TUI
		zone.NewGlobal()
		program := tea.NewProgram(
			tui.New(app),
			tea.WithAltScreen(),
		)

		// Setup the subscriptions, this will send services events to the TUI
		ch, cancelSubs := setupSubscriptions(app, ctx)

		// Create a context for the TUI message handler
		tuiCtx, tuiCancel := context.WithCancel(ctx)
		var tuiWg sync.WaitGroup
		tuiWg.Add(1)

		// Set up message handling for the TUI
		go func() {
			defer tuiWg.Done()
			defer logging.RecoverPanic("TUI-message-handler", func() {
				attemptTUIRecovery(program)
			})

			for {
				select {
				case <-tuiCtx.Done():
					slog.Info("TUI message handler shutting down")
					return
				case msg, ok := <-ch:
					if !ok {
						slog.Info("TUI message channel closed")
						return
					}
					program.Send(msg)
				}
			}
		}()

		evts, err := app.Client.Event(ctx)
		if err != nil {
			slog.Error("Failed to subscribe to events", "error", err)
			return err
		}

		go func() {
			for item := range evts {
				program.Send(item)
			}
		}()

		// Cleanup function for when the program exits
		cleanup := func() {
			// Cancel subscriptions first
			cancelSubs()

			// Then shutdown the app
			app.Shutdown()

			// Then cancel TUI message handler
			tuiCancel()

			// Wait for TUI message handler to finish
			tuiWg.Wait()

			slog.Info("All goroutines cleaned up")
		}

		// Run the TUI
		result, err := program.Run()
		cleanup()

		if err != nil {
			slog.Error("TUI error", "error", err)
			return fmt.Errorf("TUI error: %v", err)
		}

		slog.Info("TUI exited", "result", result)
		return nil
	},
}

// attemptTUIRecovery tries to recover the TUI after a panic
func attemptTUIRecovery(program *tea.Program) {
	slog.Info("Attempting to recover TUI after panic")

	// We could try to restart the TUI or gracefully exit
	// For now, we'll just quit the program to avoid further issues
	program.Quit()
}

func setupSubscriber[T any](
	ctx context.Context,
	wg *sync.WaitGroup,
	name string,
	subscriber func(context.Context) <-chan pubsub.Event[T],
	outputCh chan<- tea.Msg,
) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer logging.RecoverPanic(fmt.Sprintf("subscription-%s", name), nil)

		subCh := subscriber(ctx)
		if subCh == nil {
			slog.Warn("subscription channel is nil", "name", name)
			return
		}

		for {
			select {
			case event, ok := <-subCh:
				if !ok {
					slog.Info("subscription channel closed", "name", name)
					return
				}

				var msg tea.Msg = event

				select {
				case outputCh <- msg:
				case <-time.After(2 * time.Second):
					slog.Warn("message dropped due to slow consumer", "name", name)
				case <-ctx.Done():
					slog.Info("subscription cancelled", "name", name)
					return
				}
			case <-ctx.Done():
				slog.Info("subscription cancelled", "name", name)
				return
			}
		}
	}()
}

func setupSubscriptions(app *app.App, parentCtx context.Context) (chan tea.Msg, func()) {
	ch := make(chan tea.Msg, 100)

	wg := sync.WaitGroup{}
	ctx, cancel := context.WithCancel(parentCtx) // Inherit from parent context

	// setupSubscriber(ctx, &wg, "logging", app.Logs.Subscribe, ch)
	// setupSubscriber(ctx, &wg, "sessions", app.Sessions.Subscribe, ch)
	// setupSubscriber(ctx, &wg, "messages", app.Messages.Subscribe, ch)
	// setupSubscriber(ctx, &wg, "permissions", app.Permissions.Subscribe, ch)
	setupSubscriber(ctx, &wg, "status", app.Status.Subscribe, ch)

	cleanupFunc := func() {
		slog.Info("Cancelling all subscriptions")
		cancel() // Signal all goroutines to stop

		waitCh := make(chan struct{})
		go func() {
			defer logging.RecoverPanic("subscription-cleanup", nil)
			wg.Wait()
			close(waitCh)
		}()

		select {
		case <-waitCh:
			slog.Info("All subscription goroutines completed successfully")
			close(ch) // Only close after all writers are confirmed done
		case <-time.After(5 * time.Second):
			slog.Warn("Timed out waiting for some subscription goroutines to complete")
			close(ch)
		}
	}
	return ch, cleanupFunc
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

// checkStdinPipe checks if there's data being piped into stdin
func checkStdinPipe() (string, bool) {
	// Check if stdin is not a terminal (i.e., it's being piped)
	stat, _ := os.Stdin.Stat()
	if (stat.Mode() & os.ModeCharDevice) == 0 {
		// Read all data from stdin
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return "", false
		}

		// If we got data, return it
		if len(data) > 0 {
			return string(data), true
		}
	}
	return "", false
}

func init() {
	rootCmd.Flags().BoolP("help", "h", false, "Help")
	rootCmd.Flags().BoolP("version", "v", false, "Version")
	rootCmd.Flags().BoolP("debug", "d", false, "Debug")
	rootCmd.Flags().StringP("cwd", "c", "", "Current working directory")
	rootCmd.Flags().StringP("prompt", "p", "", "Run a single prompt in non-interactive mode")
	rootCmd.Flags().StringP("output-format", "f", "text", "Output format for non-interactive mode (text, json)")
	rootCmd.Flags().BoolP("quiet", "q", false, "Hide spinner in non-interactive mode")
	rootCmd.Flags().BoolP("verbose", "", false, "Display logs to stderr in non-interactive mode")
	rootCmd.Flags().StringSlice("allowedTools", nil, "Restrict the agent to only use the specified tools in non-interactive mode (comma-separated list)")
	rootCmd.Flags().StringSlice("excludedTools", nil, "Prevent the agent from using the specified tools in non-interactive mode (comma-separated list)")

	// Make allowedTools and excludedTools mutually exclusive
	rootCmd.MarkFlagsMutuallyExclusive("allowedTools", "excludedTools")

	// Make quiet and verbose mutually exclusive
	rootCmd.MarkFlagsMutuallyExclusive("quiet", "verbose")
}
