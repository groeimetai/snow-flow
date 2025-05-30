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
