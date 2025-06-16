package main

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/tui"
	"github.com/sst/opencode/pkg/client"
)

var Version = "dev"

func main() {
	url := os.Getenv("OPENCODE_SERVER")
	httpClient, err := client.NewClientWithResponses(url)
	if err != nil {
		slog.Error("Failed to create client", "error", err)
		os.Exit(1)
	}

	// Create main context for the application
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	version := Version
	if version != "dev" && !strings.HasPrefix(Version, "v") {
		version = "v" + Version
	}
	app_, err := app.New(ctx, version, httpClient)
	if err != nil {
		panic(err)
	}

	program := tea.NewProgram(
		tui.NewModel(app_),
		tea.WithAltScreen(),
		tea.WithKeyboardEnhancements(),
		// tea.WithMouseCellMotion(),
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

	paths, err := httpClient.PostPathGetWithResponse(context.Background())
	if err != nil {
		panic(err)
	}
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

	// Run the TUI
	result, err := program.Run()
	if err != nil {
		slog.Error("TUI error", "error", err)
		// return fmt.Errorf("TUI error: %v", err)
	}

	slog.Info("TUI exited", "result", result)
}
