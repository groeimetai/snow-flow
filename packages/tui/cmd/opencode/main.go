package main

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/pubsub"
	"github.com/sst/opencode/internal/tui"
	"github.com/sst/opencode/pkg/client"
)

func main() {
	url := os.Getenv("OPENCODE_SERVER")
	httpClient, err := client.NewClientWithResponses(url)
	if err != nil {
		slog.Error("Failed to create client", "error", err)
		os.Exit(1)
	}
	paths, _ := httpClient.PostPathGetWithResponse(context.Background())
	logfile := filepath.Join(paths.JSON200.Data, "log", "tui.log")

	if _, err := os.Stat(filepath.Dir(logfile)); os.IsNotExist(err) {
		err := os.MkdirAll(filepath.Dir(logfile), 0755)
		if err != nil {
			slog.Error("Failed to create log directory", "error", err)
			os.Exit(1)
		}
	}
	file, err := os.Create(logfile)
	if err != nil {
		slog.Error("Failed to create log file", "error", err)
		os.Exit(1)
	}
	defer file.Close()
	logger := slog.New(slog.NewTextHandler(file, &slog.HandlerOptions{Level: slog.LevelDebug}))
	slog.SetDefault(logger)

	// Create main context for the application
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	app_, err := app.New(ctx, httpClient)
	if err != nil {
		slog.Error("Failed to create app", "error", err)
		// return err
	}

	// Set up the TUI
	zone.NewGlobal()
	program := tea.NewProgram(
		tui.NewModel(app_),
		tea.WithAltScreen(),
	)

	eventClient, err := client.NewClient(url)
	if err != nil {
		slog.Error("Failed to create event client", "error", err)
		os.Exit(1)
	}

	evts, err := eventClient.Event(ctx)
	if err != nil {
		slog.Error("Failed to subscribe to events", "error", err)
		os.Exit(1)
	}

	go func() {
		for item := range evts {
			program.Send(item)
		}
	}()

	// Setup the subscriptions, this will send services events to the TUI
	ch, cancelSubs := setupSubscriptions(app_, ctx)

	// Create a context for the TUI message handler
	tuiCtx, tuiCancel := context.WithCancel(ctx)
	var tuiWg sync.WaitGroup
	tuiWg.Add(1)

	// Set up message handling for the TUI
	go func() {
		defer tuiWg.Done()
		// defer logging.RecoverPanic("TUI-message-handler", func() {
		// 	attemptTUIRecovery(program)
		// })

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

	// Cleanup function for when the program exits
	cleanup := func() {
		// Cancel subscriptions first
		cancelSubs()

		// Then shutdown the app
		app_.Shutdown()

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
		// return fmt.Errorf("TUI error: %v", err)
	}

	slog.Info("TUI exited", "result", result)
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
		// defer logging.RecoverPanic(fmt.Sprintf("subscription-%s", name), nil)

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

	setupSubscriber(ctx, &wg, "status", app.Status.Subscribe, ch)

	cleanupFunc := func() {
		slog.Info("Cancelling all subscriptions")
		cancel() // Signal all goroutines to stop

		waitCh := make(chan struct{})
		go func() {
			// defer logging.RecoverPanic("subscription-cleanup", nil)
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
