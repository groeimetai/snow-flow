package main

import (
	"context"
	"os"
	"os/signal"

	"github.com/sst/opencode/pkg/app"
	"github.com/sst/opencode/pkg/server"
	"golang.org/x/sync/errgroup"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	cwd, _ := os.Getwd()
	app, err := app.New(ctx, cwd)
	if err != nil {
		panic(err)
	}

	server, err := server.New(app)

	var wg errgroup.Group
	wg.Go(func() error {
		defer stop()
		return server.Start(ctx)
	})

	<-ctx.Done()

	wg.Wait()
}
