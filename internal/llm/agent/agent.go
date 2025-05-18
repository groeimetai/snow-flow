package agent

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/llm/models"
	"github.com/sst/opencode/internal/llm/prompt"
	"github.com/sst/opencode/internal/llm/provider"
	"github.com/sst/opencode/internal/llm/tools"
	"github.com/sst/opencode/internal/logging"
	"github.com/sst/opencode/internal/message"
	"github.com/sst/opencode/internal/permission"
	"github.com/sst/opencode/internal/session"
	"github.com/sst/opencode/internal/status"
)

// Common errors
var (
	ErrRequestCancelled = errors.New("request cancelled by user")
	ErrSessionBusy      = errors.New("session is currently processing another request")
)

type AgentEvent struct {
	message message.Message
	err     error
}

func (e *AgentEvent) Err() error {
	return e.err
}

func (e *AgentEvent) Response() message.Message {
	return e.message
}

type Service interface {
	Run(ctx context.Context, sessionID string, content string, attachments ...message.Attachment) (<-chan AgentEvent, error)
	Cancel(sessionID string)
	IsSessionBusy(sessionID string) bool
	IsBusy() bool
	Update(agentName config.AgentName, modelID models.ModelID) (models.Model, error)
	CompactSession(ctx context.Context, sessionID string, force bool) error
	GetUsage(ctx context.Context, sessionID string) (*int64, error)
	EstimateContextWindowUsage(ctx context.Context, sessionID string) (float64, bool, error)
}

type agent struct {
	sessions session.Service
	messages message.Service

	tools    []tools.BaseTool
	provider provider.Provider

	titleProvider provider.Provider

	activeRequests sync.Map
}

func NewAgent(
	agentName config.AgentName,
	sessions session.Service,
	messages message.Service,
	agentTools []tools.BaseTool,
) (Service, error) {
	agentProvider, err := createAgentProvider(agentName)
	if err != nil {
		return nil, err
	}
	var titleProvider provider.Provider
	// Only generate titles for the primary agent
	if agentName == config.AgentPrimary {
		titleProvider, err = createAgentProvider(config.AgentTitle)
		if err != nil {
			return nil, err
		}
	}

	agent := &agent{
		provider:       agentProvider,
		messages:       messages,
		sessions:       sessions,
		tools:          agentTools,
		titleProvider:  titleProvider,
		activeRequests: sync.Map{},
	}

	return agent, nil
}

func (a *agent) Cancel(sessionID string) {
	if cancelFunc, exists := a.activeRequests.LoadAndDelete(sessionID); exists {
		if cancel, ok := cancelFunc.(context.CancelFunc); ok {
			status.Info(fmt.Sprintf("Request cancellation initiated for session: %s", sessionID))
			cancel()
		}
	}
}

func (a *agent) IsBusy() bool {
	busy := false
	a.activeRequests.Range(func(key, value interface{}) bool {
		if cancelFunc, ok := value.(context.CancelFunc); ok {
			if cancelFunc != nil {
				busy = true
				return false // Stop iterating
			}
		}
		return true // Continue iterating
	})
	return busy
}

func (a *agent) IsSessionBusy(sessionID string) bool {
	_, busy := a.activeRequests.Load(sessionID)
	return busy
}

func (a *agent) generateTitle(ctx context.Context, sessionID string, content string) error {
	if content == "" {
		return nil
	}
	if a.titleProvider == nil {
		return nil
	}
	session, err := a.sessions.Get(ctx, sessionID)
	if err != nil {
		return err
	}
	parts := []message.ContentPart{message.TextContent{Text: content}}
	response, err := a.titleProvider.SendMessages(
		ctx,
		[]message.Message{
			{
				Role:  message.User,
				Parts: parts,
			},
		},
		make([]tools.BaseTool, 0),
	)
	if err != nil {
		return err
	}

	title := strings.TrimSpace(strings.ReplaceAll(response.Content, "\n", " "))
	if title == "" {
		return nil
	}

	session.Title = title
	_, err = a.sessions.Update(ctx, session)
	return err
}

func (a *agent) err(err error) AgentEvent {
	return AgentEvent{
		err: err,
	}
}

func (a *agent) Run(ctx context.Context, sessionID string, content string, attachments ...message.Attachment) (<-chan AgentEvent, error) {
	if !a.provider.Model().SupportsAttachments && attachments != nil {
		attachments = nil
	}
	events := make(chan AgentEvent)
	if a.IsSessionBusy(sessionID) {
		return nil, ErrSessionBusy
	}

	genCtx, cancel := context.WithCancel(ctx)

	a.activeRequests.Store(sessionID, cancel)
	go func() {
		slog.Debug("Request started", "sessionID", sessionID)
		defer logging.RecoverPanic("agent.Run", func() {
			events <- a.err(fmt.Errorf("panic while running the agent"))
		})
		var attachmentParts []message.ContentPart
		for _, attachment := range attachments {
			attachmentParts = append(attachmentParts, message.BinaryContent{Path: attachment.FilePath, MIMEType: attachment.MimeType, Data: attachment.Content})
		}
		result := a.processGeneration(genCtx, sessionID, content, attachmentParts)
		if result.Err() != nil && !errors.Is(result.Err(), ErrRequestCancelled) && !errors.Is(result.Err(), context.Canceled) {
			status.Error(result.Err().Error())
		}
		slog.Debug("Request completed", "sessionID", sessionID)
		a.activeRequests.Delete(sessionID)
		cancel()
		events <- result
		close(events)
	}()

	return events, nil
}

func (a *agent) prepareMessageHistory(ctx context.Context, sessionID string) (session.Session, []message.Message, error) {
	currentSession, err := a.sessions.Get(ctx, sessionID)
	if err != nil {
		return currentSession, nil, fmt.Errorf("failed to get session: %w", err)
	}

	var sessionMessages []message.Message
	if currentSession.Summary != "" && !currentSession.SummarizedAt.IsZero() {
		// If summary exists, only fetch messages after the summarization timestamp
		sessionMessages, err = a.messages.ListAfter(ctx, sessionID, currentSession.SummarizedAt)
		if err != nil {
			return currentSession, nil, fmt.Errorf("failed to list messages after summary: %w", err)
		}
	} else {
		// If no summary, fetch all messages
		sessionMessages, err = a.messages.List(ctx, sessionID)
		if err != nil {
			return currentSession, nil, fmt.Errorf("failed to list messages: %w", err)
		}
	}

	var messages []message.Message
	if currentSession.Summary != "" && !currentSession.SummarizedAt.IsZero() {
		// If summary exists, create a temporary message for the summary
		summaryMessage := message.Message{
			Role: message.Assistant,
			Parts: []message.ContentPart{
				message.TextContent{Text: currentSession.Summary},
			},
		}
		// Start with the summary, then add messages after the summary timestamp
		messages = append([]message.Message{summaryMessage}, sessionMessages...)
	} else {
		// If no summary, just use all messages
		messages = sessionMessages
	}

	return currentSession, messages, nil
}

func (a *agent) triggerTitleGeneration(sessionID string, content string) {
	go func() {
		defer logging.RecoverPanic("agent.Run", func() {
			status.Error("panic while generating title")
		})
		titleErr := a.generateTitle(context.Background(), sessionID, content)
		if titleErr != nil {
			status.Error(fmt.Sprintf("failed to generate title: %v", titleErr))
		}
	}()
}

func (a *agent) processGeneration(ctx context.Context, sessionID, content string, attachmentParts []message.ContentPart) AgentEvent {
	currentSession, sessionMessages, err := a.prepareMessageHistory(ctx, sessionID)
	if err != nil {
		return a.err(err)
	}

	// If this is a new session, start title generation asynchronously
	if len(sessionMessages) == 0 && currentSession.Summary == "" {
		a.triggerTitleGeneration(sessionID, content)
	}

	userMsg, err := a.createUserMessage(ctx, sessionID, content, attachmentParts)
	if err != nil {
		return a.err(fmt.Errorf("failed to create user message: %w", err))
	}

	messages := append(sessionMessages, userMsg)

	for {
		// Check for cancellation before each iteration
		select {
		case <-ctx.Done():
			return a.err(ctx.Err())
		default:
			// Continue processing
		}

		// Check if auto-compaction is needed before calling the provider
		usagePercentage, needsCompaction, errEstimate := a.EstimateContextWindowUsage(ctx, sessionID)
		if errEstimate != nil {
			slog.Warn("Failed to estimate context window usage for auto-compaction", "error", errEstimate, "sessionID", sessionID)
		} else if needsCompaction {
			status.Info(fmt.Sprintf("Context window usage is at %.2f%%. Auto-compacting conversation...", usagePercentage))

			// Run compaction synchronously
			compactCtx, cancelCompact := context.WithTimeout(ctx, 30*time.Second) // Use appropriate context
			errCompact := a.CompactSession(compactCtx, sessionID, true)
			cancelCompact()

			if errCompact != nil {
				status.Warn(fmt.Sprintf("Auto-compaction failed: %v. Context window usage may continue to grow.", errCompact))
			} else {
				status.Info("Auto-compaction completed successfully.")
				// After compaction, message history needs to be re-prepared.
				// The 'messages' slice needs to be updated with the new summary and subsequent messages,
				// ensuring the latest user message is correctly appended.
				_, sessionMessagesFromCompact, errPrepare := a.prepareMessageHistory(ctx, sessionID)
				if errPrepare != nil {
					return a.err(fmt.Errorf("failed to re-prepare message history after compaction: %w", errPrepare))
				}
				messages = sessionMessagesFromCompact

				// Ensure the user message that triggered this cycle is the last one.
				// 'userMsg' was created before this loop using a.createUserMessage.
				// It should be appended to the 'messages' slice if it's not already the last element.
				if len(messages) == 0 || (len(messages) > 0 && messages[len(messages)-1].ID != userMsg.ID) {
					messages = append(messages, userMsg)
				}
			}
		}

		agentMessage, toolResults, err := a.streamAndHandleEvents(ctx, sessionID, messages)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				agentMessage.AddFinish(message.FinishReasonCanceled)
				a.messages.Update(context.Background(), agentMessage)
				return a.err(ErrRequestCancelled)
			}
			return a.err(fmt.Errorf("failed to process events: %w", err))
		}
		slog.Info("Result", "message", agentMessage.FinishReason(), "toolResults", toolResults)
		if (agentMessage.FinishReason() == message.FinishReasonToolUse) && toolResults != nil {
			// We are not done, we need to respond with the tool response
			messages = append(messages, agentMessage, *toolResults)
			continue
		}
		return AgentEvent{
			message: agentMessage,
		}
	}
}

func (a *agent) createUserMessage(ctx context.Context, sessionID, content string, attachmentParts []message.ContentPart) (message.Message, error) {
	parts := []message.ContentPart{message.TextContent{Text: content}}
	parts = append(parts, attachmentParts...)
	return a.messages.Create(ctx, sessionID, message.CreateMessageParams{
		Role:  message.User,
		Parts: parts,
	})
}

func (a *agent) createToolResponseMessage(ctx context.Context, sessionID string, toolResults []message.ToolResult) (*message.Message, error) {
	if len(toolResults) == 0 {
		return nil, nil
	}

	parts := make([]message.ContentPart, 0, len(toolResults))
	for _, tr := range toolResults {
		parts = append(parts, tr)
	}

	msg, err := a.messages.Create(ctx, sessionID, message.CreateMessageParams{
		Role:  message.Tool,
		Parts: parts,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create tool response message: %w", err)
	}

	return &msg, nil
}

func (a *agent) streamAndHandleEvents(ctx context.Context, sessionID string, msgHistory []message.Message) (message.Message, *message.Message, error) {
	eventChan := a.provider.StreamResponse(ctx, msgHistory, a.tools)

	assistantMsg, err := a.messages.Create(ctx, sessionID, message.CreateMessageParams{
		Role:  message.Assistant,
		Parts: []message.ContentPart{},
		Model: a.provider.Model().ID,
	})
	if err != nil {
		return assistantMsg, nil, fmt.Errorf("failed to create assistant message: %w", err)
	}

	// Add the session and message ID into the context if needed by tools.
	ctx = context.WithValue(ctx, tools.MessageIDContextKey, assistantMsg.ID)
	ctx = context.WithValue(ctx, tools.SessionIDContextKey, sessionID)

	// Process each event in the stream.
	for event := range eventChan {
		if processErr := a.processEvent(ctx, sessionID, &assistantMsg, event); processErr != nil {
			a.finishMessage(ctx, &assistantMsg, message.FinishReasonCanceled)
			return assistantMsg, nil, processErr
		}
		if ctx.Err() != nil {
			a.finishMessage(context.Background(), &assistantMsg, message.FinishReasonCanceled)
			return assistantMsg, nil, ctx.Err()
		}
	}

	// If the assistant wants to use tools, execute them
	if assistantMsg.FinishReason() == message.FinishReasonToolUse {
		toolCalls := assistantMsg.ToolCalls()
		if len(toolCalls) > 0 {
			toolResults, err := a.executeToolCalls(ctx, toolCalls)
			if err != nil {
				if errors.Is(err, context.Canceled) {
					a.finishMessage(context.Background(), &assistantMsg, message.FinishReasonCanceled)
				}
				return assistantMsg, nil, err
			}

			// Create a message with the tool results
			toolResponseMsg, err := a.createToolResponseMessage(ctx, sessionID, toolResults)
			if err != nil {
				return assistantMsg, nil, err
			}

			return assistantMsg, toolResponseMsg, nil
		}
	}

	return assistantMsg, nil, nil
}

func (a *agent) executeToolCalls(ctx context.Context, toolCalls []message.ToolCall) ([]message.ToolResult, error) {
	toolResults := make([]message.ToolResult, len(toolCalls))

	for i, toolCall := range toolCalls {
		select {
		case <-ctx.Done():
			// Make all future tool calls cancelled
			for j := i; j < len(toolCalls); j++ {
				toolResults[j] = message.ToolResult{
					ToolCallID: toolCalls[j].ID,
					Content:    "Tool execution canceled by user",
					IsError:    true,
				}
			}
			return toolResults, ctx.Err()
		default:
			// Continue processing
			var tool tools.BaseTool
			for _, availableTools := range a.tools {
				if availableTools.Info().Name == toolCall.Name {
					tool = availableTools
				}
			}

			// Tool not found
			if tool == nil {
				toolResults[i] = message.ToolResult{
					ToolCallID: toolCall.ID,
					Content:    fmt.Sprintf("Tool not found: %s", toolCall.Name),
					IsError:    true,
				}
				continue
			}

			toolResult, toolErr := tool.Run(ctx, tools.ToolCall{
				ID:    toolCall.ID,
				Name:  toolCall.Name,
				Input: toolCall.Input,
			})

			if toolErr != nil {
				if errors.Is(toolErr, permission.ErrorPermissionDenied) {
					toolResults[i] = message.ToolResult{
						ToolCallID: toolCall.ID,
						Content:    "Permission denied",
						IsError:    true,
					}
					// Cancel all remaining tool calls if permission is denied
					for j := i + 1; j < len(toolCalls); j++ {
						toolResults[j] = message.ToolResult{
							ToolCallID: toolCalls[j].ID,
							Content:    "Tool execution canceled by user",
							IsError:    true,
						}
					}
					return toolResults, nil
				}

				// Handle other errors
				toolResults[i] = message.ToolResult{
					ToolCallID: toolCall.ID,
					Content:    toolErr.Error(),
					IsError:    true,
				}
				continue
			}

			toolResults[i] = message.ToolResult{
				ToolCallID: toolCall.ID,
				Content:    toolResult.Content,
				Metadata:   toolResult.Metadata,
				IsError:    toolResult.IsError,
			}
		}
	}

	return toolResults, nil
}

func (a *agent) finishMessage(ctx context.Context, msg *message.Message, finishReson message.FinishReason) {
	msg.AddFinish(finishReson)
	_, _ = a.messages.Update(ctx, *msg)
}

func (a *agent) processEvent(ctx context.Context, sessionID string, assistantMsg *message.Message, event provider.ProviderEvent) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		// Continue processing
	}

	switch event.Type {
	case provider.EventThinkingDelta:
		assistantMsg.AppendReasoningContent(event.Content)
		_, err := a.messages.Update(ctx, *assistantMsg)
		return err
	case provider.EventContentDelta:
		assistantMsg.AppendContent(event.Content)
		_, err := a.messages.Update(ctx, *assistantMsg)
		return err
	case provider.EventToolUseStart:
		assistantMsg.AddToolCall(*event.ToolCall)
		_, err := a.messages.Update(ctx, *assistantMsg)
		return err
	case provider.EventToolUseStop:
		assistantMsg.FinishToolCall(event.ToolCall.ID)
		_, err := a.messages.Update(ctx, *assistantMsg)
		return err
	case provider.EventError:
		if errors.Is(event.Error, context.Canceled) {
			status.Info(fmt.Sprintf("Event processing canceled for session: %s", sessionID))
			return context.Canceled
		}
		status.Error(event.Error.Error())
		return event.Error
	case provider.EventComplete:
		assistantMsg.SetToolCalls(event.Response.ToolCalls)
		assistantMsg.AddFinish(event.Response.FinishReason)
		if _, err := a.messages.Update(ctx, *assistantMsg); err != nil {
			return fmt.Errorf("failed to update message: %w", err)
		}
		return a.TrackUsage(ctx, sessionID, a.provider.Model(), event.Response.Usage)
	}

	return nil
}

func (a *agent) GetUsage(ctx context.Context, sessionID string) (*int64, error) {
	session, err := a.sessions.Get(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	usage := session.PromptTokens + session.CompletionTokens
	return &usage, nil
}

func (a *agent) EstimateContextWindowUsage(ctx context.Context, sessionID string) (float64, bool, error) {
	session, err := a.sessions.Get(ctx, sessionID)
	if err != nil {
		return 0, false, fmt.Errorf("failed to get session: %w", err)
	}

	// Get the model's context window size
	model := a.provider.Model()
	contextWindow := model.ContextWindow
	if contextWindow <= 0 {
		// Default to a reasonable size if not specified
		contextWindow = 100000
	}

	// Calculate current token usage
	currentTokens := session.PromptTokens + session.CompletionTokens

	// Get the max tokens setting for the agent
	maxTokens := a.provider.MaxTokens()

	// Calculate percentage of context window used
	usagePercentage := float64(currentTokens) / float64(contextWindow)

	// Check if we need to auto-compact
	// Auto-compact when:
	// 1. Usage exceeds 90% of context window, OR
	// 2. Current usage + maxTokens would exceed 100% of context window
	needsCompaction := usagePercentage >= 0.9 ||
		float64(currentTokens+maxTokens) > float64(contextWindow)

	return usagePercentage * 100, needsCompaction, nil
}

func (a *agent) TrackUsage(ctx context.Context, sessionID string, model models.Model, usage provider.TokenUsage) error {
	sess, err := a.sessions.Get(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}

	cost := model.CostPer1MInCached/1e6*float64(usage.CacheCreationTokens) +
		model.CostPer1MOutCached/1e6*float64(usage.CacheReadTokens) +
		model.CostPer1MIn/1e6*float64(usage.InputTokens) +
		model.CostPer1MOut/1e6*float64(usage.OutputTokens)

	sess.Cost += cost
	sess.CompletionTokens = usage.OutputTokens + usage.CacheReadTokens
	sess.PromptTokens = usage.InputTokens + usage.CacheCreationTokens

	_, err = a.sessions.Update(ctx, sess)
	if err != nil {
		return fmt.Errorf("failed to save session: %w", err)
	}
	return nil
}

func (a *agent) Update(agentName config.AgentName, modelID models.ModelID) (models.Model, error) {
	if a.IsBusy() {
		return models.Model{}, fmt.Errorf("cannot change model while processing requests")
	}

	if err := config.UpdateAgentModel(agentName, modelID); err != nil {
		return models.Model{}, fmt.Errorf("failed to update config: %w", err)
	}

	provider, err := createAgentProvider(agentName)
	if err != nil {
		return models.Model{}, fmt.Errorf("failed to create provider for model %s: %w", modelID, err)
	}

	a.provider = provider

	return a.provider.Model(), nil
}

func (a *agent) CompactSession(ctx context.Context, sessionID string, force bool) error {
	// Check if the session is busy
	if a.IsSessionBusy(sessionID) && !force {
		return ErrSessionBusy
	}

	// Create a cancellable context
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Mark the session as busy during compaction
	compactionCancelFunc := func() {}
	a.activeRequests.Store(sessionID+"-compact", compactionCancelFunc)
	defer a.activeRequests.Delete(sessionID + "-compact")

	// Fetch the session
	session, err := a.sessions.Get(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}

	// Fetch all messages for the session
	sessionMessages, err := a.messages.List(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to list messages: %w", err)
	}

	var existingSummary string
	if session.Summary != "" && !session.SummarizedAt.IsZero() {
		// Filter messages that were created after the last summarization
		var newMessages []message.Message
		for _, msg := range sessionMessages {
			if msg.CreatedAt.After(session.SummarizedAt) {
				newMessages = append(newMessages, msg)
			}
		}
		sessionMessages = newMessages
		existingSummary = session.Summary
	}

	// If there are no messages to summarize and no existing summary, return early
	if len(sessionMessages) == 0 && existingSummary == "" {
		return nil
	}

	messages := []message.Message{
		message.Message{
			Role: message.System,
			Parts: []message.ContentPart{
				message.TextContent{
					Text: `You are a helpful AI assistant tasked with summarizing conversations.

When asked to summarize, provide a detailed but concise summary of the conversation. 
Focus on information that would be helpful for continuing the conversation, including:
- What was done
- What is currently being worked on
- Which files are being modified
- What needs to be done next

Your summary should be comprehensive enough to provide context but concise enough to be quickly understood.`,
				},
			},
		},
	}

	// If there's an existing summary, include it
	if existingSummary != "" {
		messages = append(messages, message.Message{
			Role: message.Assistant,
			Parts: []message.ContentPart{
				message.TextContent{
					Text: existingSummary,
				},
			},
		})
	}

	// Add all messages since the last summarized message
	messages = append(messages, sessionMessages...)

	// Add a final user message requesting the summary
	messages = append(messages, message.Message{
		Role: message.User,
		Parts: []message.ContentPart{
			message.TextContent{
				Text: "Provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next.",
			},
		},
	})

	// Call provider to get the summary
	response, err := a.provider.SendMessages(ctx, messages, a.tools)
	if err != nil {
		return fmt.Errorf("failed to get summary from the assistant: %w", err)
	}

	// Extract the summary text
	summaryText := strings.TrimSpace(response.Content)
	if summaryText == "" {
		return fmt.Errorf("received empty summary from the assistant")
	}

	// Update the session with the new summary
	session.Summary = summaryText
	session.SummarizedAt = time.Now()

	// Save the updated session
	_, err = a.sessions.Update(ctx, session)
	if err != nil {
		return fmt.Errorf("failed to save session with summary: %w", err)
	}

	// Track token usage
	err = a.TrackUsage(ctx, sessionID, a.provider.Model(), response.Usage)
	if err != nil {
		return fmt.Errorf("failed to track usage: %w", err)
	}

	return nil
}

func createAgentProvider(agentName config.AgentName) (provider.Provider, error) {
	cfg := config.Get()
	agentConfig, ok := cfg.Agents[agentName]
	if !ok {
		return nil, fmt.Errorf("agent %s not found", agentName)
	}
	model, ok := models.SupportedModels[agentConfig.Model]
	if !ok {
		return nil, fmt.Errorf("model %s not supported", agentConfig.Model)
	}

	providerCfg, ok := cfg.Providers[model.Provider]
	if !ok {
		return nil, fmt.Errorf("provider %s not supported", model.Provider)
	}
	if providerCfg.Disabled {
		return nil, fmt.Errorf("provider %s is not enabled", model.Provider)
	}
	maxTokens := model.DefaultMaxTokens
	if agentConfig.MaxTokens > 0 {
		maxTokens = agentConfig.MaxTokens
	}
	opts := []provider.ProviderClientOption{
		provider.WithAPIKey(providerCfg.APIKey),
		provider.WithModel(model),
		provider.WithSystemMessage(prompt.GetAgentPrompt(agentName, model.Provider)),
		provider.WithMaxTokens(maxTokens),
	}
	if model.Provider == models.ProviderOpenAI && model.CanReason {
		opts = append(
			opts,
			provider.WithOpenAIOptions(
				provider.WithReasoningEffort(agentConfig.ReasoningEffort),
			),
		)
	} else if model.Provider == models.ProviderAnthropic && model.CanReason && agentName == config.AgentPrimary {
		opts = append(
			opts,
			provider.WithAnthropicOptions(
				provider.WithAnthropicShouldThinkFn(provider.DefaultShouldThinkFn),
			),
		)
	}
	agentProvider, err := provider.NewProvider(
		model.Provider,
		opts...,
	)
	if err != nil {
		return nil, fmt.Errorf("could not create provider: %v", err)
	}

	return agentProvider, nil
}
