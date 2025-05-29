package client

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"reflect"
	"strings"
)

var EventMap = map[string]any{
	"storage.write":   EventStorageWrite{},
	"session.updated": EventSessionUpdated{},
	"message.updated": EventMessageUpdated{},
}

type EventMessage struct {
	Type       string          `json:"type"`
	Properties json.RawMessage `json:"properties"`
}

func (c *Client) Event(ctx context.Context) (<-chan any, error) {
	events := make(chan any)
	req, err := http.NewRequestWithContext(ctx, "GET", c.Server+"event", nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}

	go func() {
		defer close(events)
		defer resp.Body.Close()

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "data: ") {
				data := strings.TrimPrefix(line, "data: ")

				var eventMsg EventMessage
				if err := json.Unmarshal([]byte(data), &eventMsg); err != nil {
					continue
				}

				eventTemplate, exists := EventMap[eventMsg.Type]
				if !exists {
					continue
				}

				eventValue := reflect.New(reflect.TypeOf(eventTemplate)).Interface()

				if err := json.Unmarshal(eventMsg.Properties, eventValue); err != nil {
					continue
				}

				select {
				case events <- eventValue:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return events, nil
}
