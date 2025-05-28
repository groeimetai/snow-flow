package app

import (
	"encoding/json"
	"time"
	
	tea "github.com/charmbracelet/bubbletea"
	"github.com/sst/opencode/internal/message"
	"github.com/sst/opencode/pkg/client"
)

// StorageWriteMsg is sent when a storage.write event is received
type StorageWriteMsg struct {
	Key     string
	Content interface{}
}

// ProcessSSEEvent converts SSE events into TUI messages
func ProcessSSEEvent(event interface{}) tea.Msg {
	switch e := event.(type) {
	case *client.EventStorageWrite:
		return StorageWriteMsg{
			Key:     e.Key,
			Content: e.Content,
		}
	}
	
	// Return the raw event if we don't have a specific handler
	return event
}

// MessageFromStorage converts storage content to internal message format
type MessageData struct {
	ID        string                 `json:"id"`
	Role      string                 `json:"role"`
	Parts     []interface{}          `json:"parts"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// SessionInfoFromStorage converts storage content to session info
type SessionInfoData struct {
	ID      string  `json:"id"`
	Title   string  `json:"title"`
	ShareID *string `json:"shareID,omitempty"`
	Tokens  struct {
		Input     float32 `json:"input"`
		Output    float32 `json:"output"`
		Reasoning float32 `json:"reasoning"`
	} `json:"tokens"`
}

// ConvertStorageMessage converts a storage message to internal message format
func ConvertStorageMessage(data interface{}, sessionID string) (*message.Message, error) {
	// Convert the interface{} to JSON then back to our struct
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	
	var msgData MessageData
	if err := json.Unmarshal(jsonData, &msgData); err != nil {
		return nil, err
	}
	
	// Convert parts
	var parts []message.ContentPart
	for _, part := range msgData.Parts {
		partMap, ok := part.(map[string]interface{})
		if !ok {
			continue
		}
		
		partType, ok := partMap["type"].(string)
		if !ok {
			continue
		}
		
		switch partType {
		case "text":
			if text, ok := partMap["text"].(string); ok {
				parts = append(parts, message.TextContent{Text: text})
			}
		case "tool-invocation":
			if toolInv, ok := partMap["toolInvocation"].(map[string]interface{}); ok {
				// Convert tool invocation to tool call
				toolCall := message.ToolCall{
					ID:   toolInv["toolCallId"].(string),
					Name: toolInv["toolName"].(string),
					Type: "function",
				}
				
				if args, ok := toolInv["args"]; ok {
					argsJSON, _ := json.Marshal(args)
					toolCall.Input = string(argsJSON)
				}
				
				if state, ok := toolInv["state"].(string); ok {
					toolCall.Finished = state == "result"
				}
				
				parts = append(parts, toolCall)
				
				// If there's a result, add it as a tool result
				if result, ok := toolInv["result"]; ok && toolCall.Finished {
					resultStr := ""
					switch r := result.(type) {
					case string:
						resultStr = r
					default:
						resultJSON, _ := json.Marshal(r)
						resultStr = string(resultJSON)
					}
					
					parts = append(parts, message.ToolResult{
						ToolCallID: toolCall.ID,
						Name:       toolCall.Name,
						Content:    resultStr,
					})
				}
			}
		}
	}
	
	// Convert role
	var role message.MessageRole
	switch msgData.Role {
	case "user":
		role = message.User
	case "assistant":
		role = message.Assistant
	case "system":
		role = message.System
	default:
		role = message.MessageRole(msgData.Role)
	}
	
	// Create message
	msg := &message.Message{
		ID:        msgData.ID,
		Role:      role,
		SessionID: sessionID,
		Parts:     parts,
		CreatedAt: time.Now(), // TODO: Get from metadata
		UpdatedAt: time.Now(), // TODO: Get from metadata
	}
	
	// Try to get timestamps from metadata
	if metadata, ok := msgData.Metadata["time"].(map[string]interface{}); ok {
		if created, ok := metadata["created"].(float64); ok {
			msg.CreatedAt = time.Unix(int64(created/1000), 0)
		}
		if completed, ok := metadata["completed"].(float64); ok {
			msg.UpdatedAt = time.Unix(int64(completed/1000), 0)
		}
	}
	
	return msg, nil
}