package pubsub

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

const defaultChannelBufferSize = 100

type Broker[T any] struct {
	subs     map[chan Event[T]]context.CancelFunc
	mu       sync.RWMutex
	isClosed bool
}

func NewBroker[T any]() *Broker[T] {
	return &Broker[T]{
		subs: make(map[chan Event[T]]context.CancelFunc),
	}
}

func (b *Broker[T]) Shutdown() {
	b.mu.Lock()
	if b.isClosed {
		b.mu.Unlock()
		return
	}
	b.isClosed = true

	for ch, cancel := range b.subs {
		cancel()
		close(ch)
		delete(b.subs, ch)
	}
	b.mu.Unlock()
	slog.Debug("PubSub broker shut down", "type", fmt.Sprintf("%T", *new(T)))
}

func (b *Broker[T]) Subscribe(ctx context.Context) <-chan Event[T] {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.isClosed {
		closedCh := make(chan Event[T])
		close(closedCh)
		return closedCh
	}

	subCtx, subCancel := context.WithCancel(ctx)
	subscriberChannel := make(chan Event[T], defaultChannelBufferSize)
	b.subs[subscriberChannel] = subCancel

	go func() {
		<-subCtx.Done()
		b.mu.Lock()
		defer b.mu.Unlock()
		if _, ok := b.subs[subscriberChannel]; ok {
			close(subscriberChannel)
			delete(b.subs, subscriberChannel)
		}
	}()

	return subscriberChannel
}

func (b *Broker[T]) Publish(eventType EventType, payload T) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.isClosed {
		slog.Warn("Attempted to publish on a closed pubsub broker", "type", eventType, "payload_type", fmt.Sprintf("%T", payload))
		return
	}

	event := Event[T]{Type: eventType, Payload: payload}

	for ch := range b.subs {
		// Non-blocking send with a fallback to a goroutine to prevent slow subscribers
		// from blocking the publisher.
		select {
		case ch <- event:
			// Successfully sent
		default:
			// Subscriber channel is full or receiver is slow.
			// Send in a new goroutine to avoid blocking the publisher.
			// This might lead to out-of-order delivery for this specific slow subscriber.
			go func(sChan chan Event[T], ev Event[T]) {
				// Re-check if broker is closed before attempting send in goroutine
				b.mu.RLock()
				isBrokerClosed := b.isClosed
				b.mu.RUnlock()
				if isBrokerClosed {
					return
				}

				select {
				case sChan <- ev:
				case <-time.After(2 * time.Second): // Timeout for slow subscriber
					slog.Warn("PubSub: Dropped event for slow subscriber after timeout", "type", ev.Type)
				}
			}(ch, event)
		}
	}
}

func (b *Broker[T]) GetSubscriberCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subs)
}
