package client

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"strings"
)

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

				var event Event
				if err := json.Unmarshal([]byte(data), &event); err != nil {
					continue
				}

				val, err := event.ValueByDiscriminator()
				if err != nil {
					continue
				}

				select {
				case events <- val:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return events, nil
}
