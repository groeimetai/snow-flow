package state

import (
	"github.com/sst/opencode/pkg/client"
)

type SessionSelectedMsg = *client.SessionInfo
type ModelSelectedMsg struct {
	Provider client.ProviderInfo
	Model    client.ModelInfo
}

type SessionClearedMsg struct{}
type CompactSessionMsg struct{}

// TODO: remove
type StateUpdatedMsg struct {
	State map[string]any
}
