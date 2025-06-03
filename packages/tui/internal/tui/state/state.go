package state

import (
	"github.com/sst/opencode/pkg/client"
)

type SessionSelectedMsg = *client.SessionInfo
type ModelSelectedMsg struct {
	Provider client.ProviderInfo
	Model    client.ProviderModel
}

type SessionClearedMsg struct{}
type CompactSessionMsg struct{}

// TODO: remove
type StateUpdatedMsg struct {
	State map[string]any
}

// TODO: store in CONFIG/tui.yaml
