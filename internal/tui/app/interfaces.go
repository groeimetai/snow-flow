package app

import (
	"context"
	"time"

	"github.com/sst/opencode/internal/message"
	"github.com/sst/opencode/internal/pubsub"
	"github.com/sst/opencode/internal/session"
)

// SessionService defines the interface for session operations
type SessionService interface {
	Create(ctx context.Context, title string) (session.Session, error)
	Get(ctx context.Context, id string) (session.Session, error)
	List(ctx context.Context) ([]session.Session, error)
	Update(ctx context.Context, id, title string) error
	Delete(ctx context.Context, id string) error
}

// MessageService defines the interface for message operations
type MessageService interface {
	pubsub.Subscriber[message.Message]

	GetBySession(ctx context.Context, sessionID string) ([]message.Message, error)
	List(ctx context.Context, sessionID string) ([]message.Message, error)
	Create(ctx context.Context, sessionID string, params message.CreateMessageParams) (message.Message, error)
	Update(ctx context.Context, msg message.Message) (message.Message, error)
	Delete(ctx context.Context, id string) error
	DeleteSessionMessages(ctx context.Context, sessionID string) error
	Get(ctx context.Context, id string) (message.Message, error)
	ListAfter(ctx context.Context, sessionID string, timestamp time.Time) ([]message.Message, error)
}

// AgentService defines the interface for agent operations
type AgentService interface {
	Run(ctx context.Context, sessionID string, text string, attachments ...message.Attachment) (string, error)
	Cancel(sessionID string) error
	IsBusy() bool
	IsSessionBusy(sessionID string) bool
	CompactSession(ctx context.Context, sessionID string, force bool) error
}
