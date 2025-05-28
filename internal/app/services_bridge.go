package app

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sst/opencode/internal/message"
	"github.com/sst/opencode/internal/pubsub"
	"github.com/sst/opencode/internal/session"
	"github.com/sst/opencode/pkg/client"
)

// SessionServiceBridge adapts the HTTP API to the old session.Service interface
type SessionServiceBridge struct {
	client *client.ClientWithResponses
}

// NewSessionServiceBridge creates a new session service bridge
func NewSessionServiceBridge(client *client.ClientWithResponses) *SessionServiceBridge {
	return &SessionServiceBridge{client: client}
}

// Create creates a new session
func (s *SessionServiceBridge) Create(ctx context.Context, title string) (session.Session, error) {
	resp, err := s.client.PostSessionCreate(ctx)
	if err != nil {
		return session.Session{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return session.Session{}, fmt.Errorf("failed to create session: %d", resp.StatusCode)
	}

	var info client.SessionInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return session.Session{}, err
	}

	// Convert to old session type
	return session.Session{
		ID:        info.Id,
		Title:     info.Title,
		CreatedAt: time.Now(), // API doesn't provide this yet
		UpdatedAt: time.Now(), // API doesn't provide this yet
	}, nil
}

// Get retrieves a session by ID
func (s *SessionServiceBridge) Get(ctx context.Context, id string) (session.Session, error) {
	// TODO: API doesn't have a get by ID endpoint yet
	// For now, list all and find the one we want
	sessions, err := s.List(ctx)
	if err != nil {
		return session.Session{}, err
	}

	for _, sess := range sessions {
		if sess.ID == id {
			return sess, nil
		}
	}

	return session.Session{}, fmt.Errorf("session not found: %s", id)
}

// List retrieves all sessions
func (s *SessionServiceBridge) List(ctx context.Context) ([]session.Session, error) {
	resp, err := s.client.PostSessionList(ctx)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var infos []client.SessionInfo
	if err := json.NewDecoder(resp.Body).Decode(&infos); err != nil {
		return nil, err
	}

	// Convert to old session type
	sessions := make([]session.Session, len(infos))
	for i, info := range infos {
		sessions[i] = session.Session{
			ID:        info.Id,
			Title:     info.Title,
			CreatedAt: time.Now(), // API doesn't provide this yet
			UpdatedAt: time.Now(), // API doesn't provide this yet
		}
	}

	return sessions, nil
}

// Update updates a session - NOT IMPLEMENTED IN API YET
func (s *SessionServiceBridge) Update(ctx context.Context, id, title string) error {
	// TODO: Not implemented in TypeScript API yet
	return fmt.Errorf("session update not implemented in API")
}

// Delete deletes a session - NOT IMPLEMENTED IN API YET
func (s *SessionServiceBridge) Delete(ctx context.Context, id string) error {
	// TODO: Not implemented in TypeScript API yet
	return fmt.Errorf("session delete not implemented in API")
}

// AgentServiceBridge provides a minimal agent service that sends messages to the API
type AgentServiceBridge struct {
	client *client.ClientWithResponses
}

// NewAgentServiceBridge creates a new agent service bridge
func NewAgentServiceBridge(client *client.ClientWithResponses) *AgentServiceBridge {
	return &AgentServiceBridge{client: client}
}

// Run sends a message to the chat API
func (a *AgentServiceBridge) Run(ctx context.Context, sessionID string, text string, attachments ...message.Attachment) (string, error) {
	// TODO: Handle attachments when API supports them
	if len(attachments) > 0 {
		// For now, ignore attachments
		// return "", fmt.Errorf("attachments not supported yet")
	}

	parts := any([]map[string]any{
		{
			"type": "text",
			"text": text,
		},
	})

	resp, err := a.client.PostSessionChat(ctx, client.PostSessionChatJSONRequestBody{
		SessionID: sessionID,
		Parts:     &parts,
	})
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	// The actual response will come through SSE
	// For now, just return success
	return "", nil
}

// Cancel cancels the current generation - NOT IMPLEMENTED IN API YET
func (a *AgentServiceBridge) Cancel(sessionID string) error {
	// TODO: Not implemented in TypeScript API yet
	return nil
}

// IsBusy checks if the agent is busy - NOT IMPLEMENTED IN API YET
func (a *AgentServiceBridge) IsBusy() bool {
	// TODO: Not implemented in TypeScript API yet
	return false
}

// IsSessionBusy checks if the agent is busy for a specific session - NOT IMPLEMENTED IN API YET
func (a *AgentServiceBridge) IsSessionBusy(sessionID string) bool {
	// TODO: Not implemented in TypeScript API yet
	return false
}

// CompactSession compacts a session - NOT IMPLEMENTED IN API YET
func (a *AgentServiceBridge) CompactSession(ctx context.Context, sessionID string, force bool) error {
	// TODO: Not implemented in TypeScript API yet
	return fmt.Errorf("session compaction not implemented in API")
}

// MessageServiceBridge provides a minimal message service that fetches from the API
type MessageServiceBridge struct {
	client *client.ClientWithResponses
	broker *pubsub.Broker[message.Message]
}

// NewMessageServiceBridge creates a new message service bridge
func NewMessageServiceBridge(client *client.ClientWithResponses) *MessageServiceBridge {
	return &MessageServiceBridge{
		client: client,
		broker: pubsub.NewBroker[message.Message](),
	}
}

// GetBySession retrieves messages for a session
func (m *MessageServiceBridge) GetBySession(ctx context.Context, sessionID string) ([]message.Message, error) {
	return m.List(ctx, sessionID)
}

// List retrieves messages for a session
func (m *MessageServiceBridge) List(ctx context.Context, sessionID string) ([]message.Message, error) {
	resp, err := m.client.PostSessionMessages(ctx, client.PostSessionMessagesJSONRequestBody{
		SessionID: sessionID,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// The API returns a different format, we'll need to adapt it
	var rawMessages any
	if err := json.NewDecoder(resp.Body).Decode(&rawMessages); err != nil {
		return nil, err
	}

	// TODO: Convert the API message format to our internal format
	// For now, return empty to avoid compilation errors
	return []message.Message{}, nil
}

// Create creates a new message - NOT NEEDED, handled by chat API
func (m *MessageServiceBridge) Create(ctx context.Context, sessionID string, params message.CreateMessageParams) (message.Message, error) {
	// Messages are created through the chat API
	return message.Message{}, fmt.Errorf("use chat API to send messages")
}

// Update updates a message - NOT IMPLEMENTED IN API YET
func (m *MessageServiceBridge) Update(ctx context.Context, msg message.Message) (message.Message, error) {
	// TODO: Not implemented in TypeScript API yet
	return message.Message{}, fmt.Errorf("message update not implemented in API")
}

// Delete deletes a message - NOT IMPLEMENTED IN API YET
func (m *MessageServiceBridge) Delete(ctx context.Context, id string) error {
	// TODO: Not implemented in TypeScript API yet
	return fmt.Errorf("message delete not implemented in API")
}

// DeleteSessionMessages deletes all messages for a session - NOT IMPLEMENTED IN API YET
func (m *MessageServiceBridge) DeleteSessionMessages(ctx context.Context, sessionID string) error {
	// TODO: Not implemented in TypeScript API yet
	return fmt.Errorf("delete session messages not implemented in API")
}

// Get retrieves a message by ID - NOT IMPLEMENTED IN API YET
func (m *MessageServiceBridge) Get(ctx context.Context, id string) (message.Message, error) {
	// TODO: Not implemented in TypeScript API yet
	return message.Message{}, fmt.Errorf("get message by ID not implemented in API")
}

// ListAfter retrieves messages after a timestamp - NOT IMPLEMENTED IN API YET
func (m *MessageServiceBridge) ListAfter(ctx context.Context, sessionID string, timestamp time.Time) ([]message.Message, error) {
	// TODO: Not implemented in TypeScript API yet
	return []message.Message{}, fmt.Errorf("list messages after timestamp not implemented in API")
}

// Subscribe subscribes to message events
func (m *MessageServiceBridge) Subscribe(ctx context.Context) <-chan pubsub.Event[message.Message] {
	return m.broker.Subscribe(ctx)
}

