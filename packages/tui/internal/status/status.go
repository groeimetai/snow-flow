package status

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/sst/opencode/internal/pubsub"
)

type Level string

const (
	LevelInfo  Level = "info"
	LevelWarn  Level = "warn"
	LevelError Level = "error"
	LevelDebug Level = "debug"
)

type StatusMessage struct {
	Level     Level         `json:"level"`
	Message   string        `json:"message"`
	Timestamp time.Time     `json:"timestamp"`
	Critical  bool          `json:"critical"`
	Duration  time.Duration `json:"duration"`
}

// StatusOption is a function that configures a status message
type StatusOption func(*StatusMessage)

// WithCritical marks a status message as critical, causing it to be displayed immediately
func WithCritical(critical bool) StatusOption {
	return func(msg *StatusMessage) {
		msg.Critical = critical
	}
}

// WithDuration sets a custom display duration for a status message
func WithDuration(duration time.Duration) StatusOption {
	return func(msg *StatusMessage) {
		msg.Duration = duration
	}
}

const (
	EventStatusPublished pubsub.EventType = "status_published"
)

type Service interface {
	pubsub.Subscriber[StatusMessage]

	Info(message string, opts ...StatusOption)
	Warn(message string, opts ...StatusOption)
	Error(message string, opts ...StatusOption)
	Debug(message string, opts ...StatusOption)
}

type service struct {
	broker *pubsub.Broker[StatusMessage]
	mu     sync.RWMutex
}

var globalStatusService *service

func InitService() error {
	if globalStatusService != nil {
		return fmt.Errorf("status service already initialized")
	}
	broker := pubsub.NewBroker[StatusMessage]()
	globalStatusService = &service{
		broker: broker,
	}
	return nil
}

func GetService() Service {
	if globalStatusService == nil {
		panic("status service not initialized. Call status.InitService() at application startup.")
	}
	return globalStatusService
}

func (s *service) Info(message string, opts ...StatusOption) {
	s.publish(LevelInfo, message, opts...)
	slog.Info(message)
}

func (s *service) Warn(message string, opts ...StatusOption) {
	s.publish(LevelWarn, message, opts...)
	slog.Warn(message)
}

func (s *service) Error(message string, opts ...StatusOption) {
	s.publish(LevelError, message, opts...)
	slog.Error(message)
}

func (s *service) Debug(message string, opts ...StatusOption) {
	s.publish(LevelDebug, message, opts...)
	slog.Debug(message)
}

func (s *service) publish(level Level, messageText string, opts ...StatusOption) {
	statusMsg := StatusMessage{
		Level:     level,
		Message:   messageText,
		Timestamp: time.Now(),
	}

	// Apply all options
	for _, opt := range opts {
		opt(&statusMsg)
	}

	s.broker.Publish(EventStatusPublished, statusMsg)
}

func (s *service) Subscribe(ctx context.Context) <-chan pubsub.Event[StatusMessage] {
	return s.broker.Subscribe(ctx)
}

func Info(message string, opts ...StatusOption) {
	GetService().Info(message, opts...)
}

func Warn(message string, opts ...StatusOption) {
	GetService().Warn(message, opts...)
}

func Error(message string, opts ...StatusOption) {
	GetService().Error(message, opts...)
}

func Debug(message string, opts ...StatusOption) {
	GetService().Debug(message, opts...)
}

func Subscribe(ctx context.Context) <-chan pubsub.Event[StatusMessage] {
	return GetService().Subscribe(ctx)
}
