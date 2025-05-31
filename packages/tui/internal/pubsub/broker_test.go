package pubsub

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestBrokerSubscribe(t *testing.T) {
	t.Parallel()

	t.Run("with cancellable context", func(t *testing.T) {
		t.Parallel()
		broker := NewBroker[string]()
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		ch := broker.Subscribe(ctx)
		assert.NotNil(t, ch)
		assert.Equal(t, 1, broker.GetSubscriberCount())

		// Cancel the context should remove the subscription
		cancel()
		time.Sleep(10 * time.Millisecond) // Give time for goroutine to process
		assert.Equal(t, 0, broker.GetSubscriberCount())
	})

	t.Run("with background context", func(t *testing.T) {
		t.Parallel()
		broker := NewBroker[string]()

		// Using context.Background() should not leak goroutines
		ch := broker.Subscribe(context.Background())
		assert.NotNil(t, ch)
		assert.Equal(t, 1, broker.GetSubscriberCount())

		// Shutdown should clean up all subscriptions
		broker.Shutdown()
		assert.Equal(t, 0, broker.GetSubscriberCount())
	})
}

func TestBrokerPublish(t *testing.T) {
	t.Parallel()
	broker := NewBroker[string]()
	ctx := t.Context()

	ch := broker.Subscribe(ctx)

	// Publish a message
	broker.Publish(EventTypeCreated, "test message")

	// Verify message is received
	select {
	case event := <-ch:
		assert.Equal(t, EventTypeCreated, event.Type)
		assert.Equal(t, "test message", event.Payload)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("timeout waiting for message")
	}
}

func TestBrokerShutdown(t *testing.T) {
	t.Parallel()
	broker := NewBroker[string]()

	// Create multiple subscribers
	ch1 := broker.Subscribe(context.Background())
	ch2 := broker.Subscribe(context.Background())

	assert.Equal(t, 2, broker.GetSubscriberCount())

	// Shutdown should close all channels and clean up
	broker.Shutdown()

	// Verify channels are closed
	_, ok1 := <-ch1
	_, ok2 := <-ch2
	assert.False(t, ok1, "channel 1 should be closed")
	assert.False(t, ok2, "channel 2 should be closed")

	// Verify subscriber count is reset
	assert.Equal(t, 0, broker.GetSubscriberCount())
}

func TestBrokerConcurrency(t *testing.T) {
	t.Parallel()
	broker := NewBroker[int]()

	// Create a large number of subscribers
	const numSubscribers = 100
	var wg sync.WaitGroup
	wg.Add(numSubscribers)

	// Create a channel to collect received events
	receivedEvents := make(chan int, numSubscribers)

	for i := range numSubscribers {
		go func(id int) {
			defer wg.Done()
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			ch := broker.Subscribe(ctx)

			// Receive one message then cancel
			select {
			case event := <-ch:
				receivedEvents <- event.Payload
			case <-time.After(1 * time.Second):
				t.Errorf("timeout waiting for message %d", id)
			}
			cancel()
		}(i)
	}

	// Give subscribers time to set up
	time.Sleep(10 * time.Millisecond)

	// Publish messages to all subscribers
	for i := range numSubscribers {
		broker.Publish(EventTypeCreated, i)
	}

	// Wait for all subscribers to finish
	wg.Wait()
	close(receivedEvents)

	// Give time for cleanup goroutines to run
	time.Sleep(10 * time.Millisecond)

	// Verify all subscribers are cleaned up
	assert.Equal(t, 0, broker.GetSubscriberCount())

	// Verify we received the expected number of events
	count := 0
	for range receivedEvents {
		count++
	}
	assert.Equal(t, numSubscribers, count)
}
