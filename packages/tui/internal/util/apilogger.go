package util

import (
	"context"
	"log/slog"
	"sync"

	opencode "github.com/sst/opencode-sdk-go"
)

// APILogHandler is a slog.Handler that sends logs to the opencode API
type APILogHandler struct {
	client  *opencode.Client
	service string
	level   slog.Level
	attrs   []slog.Attr
	groups  []string
	mu      sync.Mutex
}

// NewAPILogHandler creates a new APILogHandler
func NewAPILogHandler(client *opencode.Client, service string, level slog.Level) *APILogHandler {
	return &APILogHandler{
		client:  client,
		service: service,
		level:   level,
		attrs:   make([]slog.Attr, 0),
		groups:  make([]string, 0),
	}
}

// Enabled reports whether the handler handles records at the given level.
func (h *APILogHandler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= h.level
}

// Handle handles the Record.
func (h *APILogHandler) Handle(ctx context.Context, r slog.Record) error {
	// Convert slog level to API level
	var apiLevel opencode.AppLogParamsLevel
	switch r.Level {
	case slog.LevelDebug, slog.LevelInfo:
		apiLevel = opencode.AppLogParamsLevelInfo
	case slog.LevelWarn:
		apiLevel = opencode.AppLogParamsLevelWarn
	case slog.LevelError:
		apiLevel = opencode.AppLogParamsLevelError
	default:
		apiLevel = opencode.AppLogParamsLevelInfo
	}

	// Build extra fields
	extra := make(map[string]any)

	// Add handler attributes
	h.mu.Lock()
	for _, attr := range h.attrs {
		extra[attr.Key] = attr.Value.Any()
	}
	h.mu.Unlock()

	// Add record attributes
	r.Attrs(func(attr slog.Attr) bool {
		extra[attr.Key] = attr.Value.Any()
		return true
	})

	// Send log to API
	params := opencode.AppLogParams{
		Service: opencode.F(h.service),
		Level:   opencode.F(apiLevel),
		Message: opencode.F(r.Message),
	}

	if len(extra) > 0 {
		params.Extra = opencode.F(extra)
	}

	// Use a goroutine to avoid blocking the logger
	go func() {
		_, err := h.client.App.Log(context.Background(), params)
		if err != nil {
			// Fallback: we can't log the error using slog as it would create a loop
			// TODO: fallback file?
		}
	}()

	return nil
}

// WithAttrs returns a new Handler whose attributes consist of
// both the receiver's attributes and the arguments.
func (h *APILogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	h.mu.Lock()
	defer h.mu.Unlock()

	newHandler := &APILogHandler{
		client:  h.client,
		service: h.service,
		level:   h.level,
		attrs:   make([]slog.Attr, len(h.attrs)+len(attrs)),
		groups:  make([]string, len(h.groups)),
	}

	copy(newHandler.attrs, h.attrs)
	copy(newHandler.attrs[len(h.attrs):], attrs)
	copy(newHandler.groups, h.groups)

	return newHandler
}

// WithGroup returns a new Handler with the given group appended to
// the receiver's existing groups.
func (h *APILogHandler) WithGroup(name string) slog.Handler {
	h.mu.Lock()
	defer h.mu.Unlock()

	newHandler := &APILogHandler{
		client:  h.client,
		service: h.service,
		level:   h.level,
		attrs:   make([]slog.Attr, len(h.attrs)),
		groups:  make([]string, len(h.groups)+1),
	}

	copy(newHandler.attrs, h.attrs)
	copy(newHandler.groups, h.groups)
	newHandler.groups[len(h.groups)] = name

	return newHandler
}
