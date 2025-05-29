package app

import (
	"context"
	"fmt"

	"github.com/sst/opencode/pkg/client"
)

// AgentServiceBridge provides a minimal agent service that sends messages to the API
type AgentServiceBridge struct {
	client *client.ClientWithResponses
}

// NewAgentServiceBridge creates a new agent service bridge
func NewAgentServiceBridge(client *client.ClientWithResponses) *AgentServiceBridge {
	return &AgentServiceBridge{client: client}
}

// Run sends a message to the chat API
func (a *AgentServiceBridge) Run(ctx context.Context, sessionID string, text string, attachments ...Attachment) (string, error) {
	// TODO: Handle attachments when API supports them
	if len(attachments) > 0 {
		// For now, ignore attachments
		// return "", fmt.Errorf("attachments not supported yet")
	}

	part := client.MessagePart{}
	part.FromMessagePartText(client.MessagePartText{
		Type: "text",
		Text: text,
	})
	parts := []client.MessagePart{part}

	go a.client.PostSessionChatWithResponse(ctx, client.PostSessionChatJSONRequestBody{
		SessionID:  sessionID,
		Parts:      parts,
		ProviderID: "anthropic",
		ModelID:    "claude-sonnet-4-20250514",
	})

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
