package pubsub

import "context"

type EventType string

const (
	EventTypeCreated EventType = "created"
	EventTypeUpdated EventType = "updated"
	EventTypeDeleted EventType = "deleted"
)

type Event[T any] struct {
	Type    EventType
	Payload T
}

type Subscriber[T any] interface {
	Subscribe(ctx context.Context) <-chan Event[T]
}

type Publisher[T any] interface {
	Publish(eventType EventType, payload T)
}
