package state

import (
	"github.com/sst/opencode/pkg/client"
)

type SessionSelectedMsg = *client.SessionInfo
type SessionClearedMsg struct{}
type CompactSessionMsg struct{}
type StateUpdatedMsg struct {
	State map[string]any
}
