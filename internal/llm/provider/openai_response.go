package provider


import (
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/responses"
	"github.com/sst/opencode/internal/llm/models"
	"github.com/sst/opencode/internal/llm/tools"
	"github.com/sst/opencode/internal/message"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"log/slog"

	"github.com/openai/openai-go/shared"
	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/status"
)

func (o *openaiClient) convertMessagesToResponseParams(messages []message.Message) responses.ResponseInputParam {
	inputItems := responses.ResponseInputParam{}

	inputItems = append(inputItems, responses.ResponseInputItemUnionParam{
		OfMessage: &responses.EasyInputMessageParam{
			Content: responses.EasyInputMessageContentUnionParam{OfString: openai.String(o.providerOptions.systemMessage)},
			Role:    responses.EasyInputMessageRoleSystem,
		},
	})

	for _, msg := range messages {
		switch msg.Role {
		case message.User:
			inputItemContentList := responses.ResponseInputMessageContentListParam{
				responses.ResponseInputContentUnionParam{
					OfInputText: &responses.ResponseInputTextParam{
						Text: msg.Content().String(),
					},
				},
			}

			for _, binaryContent := range msg.BinaryContent() {
				inputItemContentList = append(inputItemContentList, responses.ResponseInputContentUnionParam{
					OfInputImage: &responses.ResponseInputImageParam{
						ImageURL: openai.String(binaryContent.String(models.ProviderOpenAI)),
					},
				})
			}

			userMsg := responses.ResponseInputItemUnionParam{
				OfInputMessage: &responses.ResponseInputItemMessageParam{
					Content: inputItemContentList,
					Role:    string(responses.ResponseInputMessageItemRoleUser),
				},
			}
			inputItems = append(inputItems, userMsg)

		case message.Assistant:
			if msg.Content().String() != "" {
				assistantMsg := responses.ResponseInputItemUnionParam{
					OfOutputMessage: &responses.ResponseOutputMessageParam{
						Content: []responses.ResponseOutputMessageContentUnionParam{{
							OfOutputText: &responses.ResponseOutputTextParam{
								Text: msg.Content().String(),
							},
						}},
					},
				}
				inputItems = append(inputItems, assistantMsg)
			}

			if len(msg.ToolCalls()) > 0 {
				for _, call := range msg.ToolCalls() {
					toolMsg := responses.ResponseInputItemUnionParam{
						OfFunctionCall: &responses.ResponseFunctionToolCallParam{
							CallID:    call.ID,
							Name:      call.Name,
							Arguments: call.Input,
						},
					}
					inputItems = append(inputItems, toolMsg)
				}
			}

		case message.Tool:
			for _, result := range msg.ToolResults() {
				toolMsg := responses.ResponseInputItemUnionParam{
					OfFunctionCallOutput: &responses.ResponseInputItemFunctionCallOutputParam{
						Output: result.Content,
						CallID: result.ToolCallID,
					},
				}
				inputItems = append(inputItems, toolMsg)
			}
		}
	}

	return inputItems
}

func (o *openaiClient) convertToResponseTools(tools []tools.BaseTool) []responses.ToolUnionParam {
	outputTools := make([]responses.ToolUnionParam, len(tools))

	for i, tool := range tools {
		info := tool.Info()
		outputTools[i] = responses.ToolUnionParam{
			OfFunction: &responses.FunctionToolParam{
				Name:        info.Name,
				Description: openai.String(info.Description),
				Parameters: map[string]any{
					"type":       "object",
					"properties": info.Parameters,
					"required":   info.Required,
				},
			},
		}
	}

	return outputTools
}


func (o *openaiClient) preparedResponseParams(input responses.ResponseInputParam, tools []responses.ToolUnionParam) responses.ResponseNewParams {
	params := responses.ResponseNewParams{
		Model: shared.ResponsesModel(o.providerOptions.model.APIModel),
		Input: responses.ResponseNewParamsInputUnion{OfInputItemList: input},
		Tools: tools,
	}

	params.MaxOutputTokens = openai.Int(o.providerOptions.maxTokens)

	if o.providerOptions.model.CanReason == true {
		switch o.options.reasoningEffort {
		case "low":
			params.Reasoning.Effort = shared.ReasoningEffortLow
		case "medium":
			params.Reasoning.Effort = shared.ReasoningEffortMedium
		case "high":
			params.Reasoning.Effort = shared.ReasoningEffortHigh
		default:
			params.Reasoning.Effort = shared.ReasoningEffortMedium
		}
	}

	if o.providerOptions.model.Provider == models.ProviderOpenRouter {
		params.WithExtraFields(map[string]any{
			"provider": map[string]any{
				"require_parameters": true,
			},
		})
	}

	return params
}

func (o *openaiClient) sendResponseMessages(ctx context.Context, messages []message.Message, tools []tools.BaseTool) (response *ProviderResponse, err error) {
	params := o.preparedResponseParams(o.convertMessagesToResponseParams(messages), o.convertToResponseTools(tools))
	cfg := config.Get()
	if cfg.Debug {
		jsonData, _ := json.Marshal(params)
		slog.Debug("Prepared messages", "messages", string(jsonData))
	}
	attempts := 0
	for {
		attempts++
		openaiResponse, err := o.client.Responses.New(
			ctx,
			params,
		)
		// If there is an error we are going to see if we can retry the call
		if err != nil {
			retry, after, retryErr := o.shouldRetry(attempts, err)
			duration := time.Duration(after) * time.Millisecond
			if retryErr != nil {
				return nil, retryErr
			}
			if retry {
				status.Warn(fmt.Sprintf("Retrying due to rate limit... attempt %d of %d", attempts, maxRetries), status.WithDuration(duration))
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(duration):
					continue
				}
			}
			return nil, retryErr
		}

		content := ""
		if openaiResponse.OutputText() != "" {
			content = openaiResponse.OutputText()
		}

		toolCalls := o.responseToolCalls(*openaiResponse)
		finishReason := o.finishReason("stop")

		if len(toolCalls) > 0 {
			finishReason = message.FinishReasonToolUse
		}

		return &ProviderResponse{
			Content:      content,
			ToolCalls:    toolCalls,
			Usage:        o.responseUsage(*openaiResponse),
			FinishReason: finishReason,
		}, nil
	}
}

func (o *openaiClient) streamResponseMessages(ctx context.Context, messages []message.Message, tools []tools.BaseTool) <-chan ProviderEvent {
	eventChan := make(chan ProviderEvent)

	params := o.preparedResponseParams(o.convertMessagesToResponseParams(messages), o.convertToResponseTools(tools))

	cfg := config.Get()
	if cfg.Debug {
		jsonData, _ := json.Marshal(params)
		slog.Debug("Prepared messages", "messages", string(jsonData))
	}

	attempts := 0

	go func() {
		for {
			attempts++
			stream := o.client.Responses.NewStreaming(ctx, params)
			outputText := ""
			currentToolCallID := ""
			for stream.Next() {
				event := stream.Current()

				switch event := event.AsAny().(type) {
				case responses.ResponseCompletedEvent:
					toolCalls := o.responseToolCalls(event.Response)
					finishReason := o.finishReason("stop")

					if len(toolCalls) > 0 {
						finishReason = message.FinishReasonToolUse
					}

					eventChan <- ProviderEvent{
						Type: EventComplete,
						Response: &ProviderResponse{
							Content:      outputText,
							ToolCalls:    toolCalls,
							Usage:        o.responseUsage(event.Response),
							FinishReason: finishReason,
						},
					}
					close(eventChan)
					return

				case responses.ResponseTextDeltaEvent:
					outputText += event.Delta
					eventChan <- ProviderEvent{
						Type:    EventContentDelta,
						Content: event.Delta,
					}

				case responses.ResponseTextDoneEvent:
					eventChan <- ProviderEvent{
						Type:    EventContentStop,
						Content: outputText,
					}
					close(eventChan)
					return

				case responses.ResponseOutputItemAddedEvent:
					if event.Item.Type == "function_call" {
						currentToolCallID = event.Item.ID
						eventChan <- ProviderEvent{
							Type: EventToolUseStart,
							ToolCall: &message.ToolCall{
								ID:       event.Item.ID,
								Name:     event.Item.Name,
								Finished: false,
							},
						}
					}

				case responses.ResponseFunctionCallArgumentsDeltaEvent:
					if event.ItemID == currentToolCallID {
						eventChan <- ProviderEvent{
							Type: EventToolUseDelta,
							ToolCall: &message.ToolCall{
								ID:       currentToolCallID,
								Finished: false,
								Input:    event.Delta,
							},
						}
					}

				case responses.ResponseFunctionCallArgumentsDoneEvent:
					if event.ItemID == currentToolCallID {
						eventChan <- ProviderEvent{
							Type: EventToolUseStop,
							ToolCall: &message.ToolCall{
								ID:    currentToolCallID,
								Input: event.Arguments,
							},
						}
						currentToolCallID = ""
					}

				case responses.ResponseOutputItemDoneEvent:
					if event.Item.Type == "function_call" {
						eventChan <- ProviderEvent{
							Type: EventToolUseStop,
							ToolCall: &message.ToolCall{
								ID:       event.Item.ID,
								Name:     event.Item.Name,
								Input:    event.Item.Arguments,
								Finished: true,
							},
						}
						currentToolCallID = ""
					}

				}
			}

			err := stream.Err()
			if err == nil || errors.Is(err, io.EOF) {
				close(eventChan)
				return
			}

			// If there is an error we are going to see if we can retry the call
			retry, after, retryErr := o.shouldRetry(attempts, err)
			duration := time.Duration(after) * time.Millisecond
			if retryErr != nil {
				eventChan <- ProviderEvent{Type: EventError, Error: retryErr}
				close(eventChan)
				return
			}
			if retry {
				status.Warn(fmt.Sprintf("Retrying due to rate limit... attempt %d of %d", attempts, maxRetries), status.WithDuration(duration))
				select {
				case <-ctx.Done():
					// context cancelled
					if ctx.Err() == nil {
						eventChan <- ProviderEvent{Type: EventError, Error: ctx.Err()}
					}
					close(eventChan)
					return
				case <-time.After(duration):
					continue
				}
			}
			eventChan <- ProviderEvent{Type: EventError, Error: retryErr}
			close(eventChan)
			return
		}
	}()

	return eventChan
}


func (o *openaiClient) responseToolCalls(response responses.Response) []message.ToolCall {
	var toolCalls []message.ToolCall

	for _, output := range response.Output {
		if output.Type == "function_call" {
			call := output.AsFunctionCall()
			toolCall := message.ToolCall{
				ID:       call.ID,
				Name:     call.Name,
				Input:    call.Arguments,
				Type:     "function",
				Finished: true,
			}
			toolCalls = append(toolCalls, toolCall)
		}
	}

	return toolCalls
}

func (o *openaiClient) responseUsage(response responses.Response) TokenUsage {
	cachedTokens := response.Usage.InputTokensDetails.CachedTokens
	inputTokens := response.Usage.InputTokens - cachedTokens

	return TokenUsage{
		InputTokens:         inputTokens,
		OutputTokens:        response.Usage.OutputTokens,
		CacheCreationTokens: 0, // OpenAI doesn't provide this directly
		CacheReadTokens:     cachedTokens,
	}
}
