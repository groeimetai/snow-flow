package state

import "github.com/sst/opencode/internal/session"

type SessionSelectedMsg = *session.Session
type SessionClearedMsg struct{}
type CompactSessionMsg struct{}
