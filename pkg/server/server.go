package server

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"github.com/sst/opencode/pkg/app"
)

type Server struct {
	app  *app.App
	mux  *http.ServeMux
	http *http.Server
	log  *slog.Logger
}

func New(app *app.App) (*Server, error) {
	result := &Server{
		app: app,
		mux: http.NewServeMux(),
		log: slog.With("service", "server"),
	}
	result.mux.HandleFunc("/rpc", func(w http.ResponseWriter, r *http.Request) {
	})

	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		return nil, err
	}
	port := listener.Addr().(*net.TCPAddr).Port
	listener.Close()
	result.log.Info("listening on port", "port", port)

	result.http = &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: result.mux,
	}

	return result, nil
}

func (s *Server) Start(ctx context.Context) error {
	s.log.Info("starting server")
	go func() {
		<-ctx.Done()
		s.http.Shutdown(context.Background())
	}()
	return s.http.ListenAndServe()
}
