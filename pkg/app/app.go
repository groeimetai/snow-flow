package app

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/sst/opencode/pkg/app/paths"
)

type App struct {
	ctx       context.Context
	directory string
	config    *Config
	storage   *Storage
}

func New(ctx context.Context, directory string) (*App, error) {
	var err error
	app := &App{
		directory: directory,
		ctx:       ctx,
	}

	data := paths.Data(directory)
	if err := os.MkdirAll(data, 0755); err != nil {
		return nil, err
	}

	err = os.MkdirAll(paths.Log(directory), 0755)
	if err != nil {
		return nil, err
	}
	logFile, err := os.Create(filepath.Join(paths.Log(directory), "opencode.log"))
	if err != nil {
		return nil, err
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(logFile, &slog.HandlerOptions{})))
	slog.Info("log created")

	app.config, err = initConfig(directory)
	if err != nil {
		return nil, err
	}

	app.storage, err = initStorage(app)
	if err != nil {
		return nil, err
	}

	return app, nil
}
