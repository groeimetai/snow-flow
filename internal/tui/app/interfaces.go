package app

import (
	"context"
)

// AgentService defines the interface for agent operations
type AgentService interface {
	Cancel(sessionID string) error
	IsBusy() bool
	IsSessionBusy(sessionID string) bool
	CompactSession(ctx context.Context, sessionID string, force bool) error
}
