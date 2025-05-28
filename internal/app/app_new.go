package app

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"log/slog"

	"github.com/sst/opencode/pkg/client"
)

// AppNew is the new app structure that uses the TypeScript backend
type AppNew struct {
	Client         *client.Client
	CurrentSession *client.SessionInfo
	
	// Event handling
	eventCtx       context.Context
	eventCancel    context.CancelFunc
	eventChan      <-chan any
	
	// UI state
	filepickerOpen       bool
	completionDialogOpen bool
	
	// Mutex for thread-safe operations
	mu sync.RWMutex
}

// NewApp creates a new app instance connected to the TypeScript backend
func NewApp(ctx context.Context) (*AppNew, error) {
	httpClient, err := client.NewClient("http://localhost:16713")
	if err != nil {
		slog.Error("Failed to create client", "error", err)
		return nil, err
	}

	app := &AppNew{
		Client: httpClient,
	}

	// Start event listener
	if err := app.startEventListener(ctx); err != nil {
		return nil, err
	}

	return app, nil
}

// startEventListener connects to the SSE endpoint and processes events
func (a *AppNew) startEventListener(ctx context.Context) error {
	a.eventCtx, a.eventCancel = context.WithCancel(ctx)
	
	eventChan, err := a.Client.Event(a.eventCtx)
	if err != nil {
		return err
	}
	
	a.eventChan = eventChan
	
	// Start processing events in background
	go a.processEvents()
	
	return nil
}

// processEvents handles incoming SSE events
func (a *AppNew) processEvents() {
	for event := range a.eventChan {
		switch e := event.(type) {
		case *client.EventStorageWrite:
			// Handle storage write events
			slog.Debug("Storage write event", "key", e.Key)
			// TODO: Update local state based on storage events
		default:
			slog.Debug("Unknown event type", "event", e)
		}
	}
}

// CreateSession creates a new session via the API
func (a *AppNew) CreateSession(ctx context.Context) error {
	resp, err := a.Client.PostSessionCreate(ctx)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("failed to create session: %d", resp.StatusCode)
	}

	var session client.SessionInfo
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return err
	}

	a.mu.Lock()
	a.CurrentSession = &session
	a.mu.Unlock()

	return nil
}

// SendMessage sends a message to the current session
func (a *AppNew) SendMessage(ctx context.Context, text string) error {
	if a.CurrentSession == nil {
		if err := a.CreateSession(ctx); err != nil {
			return err
		}
	}

	a.mu.RLock()
	sessionID := a.CurrentSession.Id
	a.mu.RUnlock()

	parts := interface{}([]map[string]interface{}{
		{
			"type": "text",
			"text": text,
		},
	})

	resp, err := a.Client.PostSessionChat(ctx, client.PostSessionChatJSONRequestBody{
		SessionID: sessionID,
		Parts:     &parts,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// The response will be streamed via SSE
	return nil
}

// GetSessions retrieves all sessions
func (a *AppNew) GetSessions(ctx context.Context) ([]client.SessionInfo, error) {
	resp, err := a.Client.PostSessionList(ctx)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var sessions []client.SessionInfo
	if err := json.NewDecoder(resp.Body).Decode(&sessions); err != nil {
		return nil, err
	}

	return sessions, nil
}

// GetMessages retrieves messages for a session
func (a *AppNew) GetMessages(ctx context.Context, sessionID string) (interface{}, error) {
	resp, err := a.Client.PostSessionMessages(ctx, client.PostSessionMessagesJSONRequestBody{
		SessionID: sessionID,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var messages interface{}
	if err := json.NewDecoder(resp.Body).Decode(&messages); err != nil {
		return nil, err
	}

	return messages, nil
}

// Close shuts down the app and its connections
func (a *AppNew) Close() {
	if a.eventCancel != nil {
		a.eventCancel()
	}
}

// UI state methods
func (a *AppNew) SetFilepickerOpen(open bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.filepickerOpen = open
}

func (a *AppNew) IsFilepickerOpen() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.filepickerOpen
}

func (a *AppNew) SetCompletionDialogOpen(open bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.completionDialogOpen = open
}

func (a *AppNew) IsCompletionDialogOpen() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.completionDialogOpen
}