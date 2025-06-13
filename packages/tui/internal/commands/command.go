package commands

import (
	"github.com/charmbracelet/bubbles/v2/key"
)

// Command represents a user-triggerable action.
type Command struct {
	// Name is the identifier used for slash commands (e.g., "new").
	Name string
	// Description is a short explanation of what the command does.
	Description string
	// KeyBinding is the keyboard shortcut to trigger this command.
	KeyBinding key.Binding
}

// Registry holds all the available commands.
type Registry struct {
	Commands map[string]Command
}

// ExecuteCommandMsg is a message sent when a command should be executed.
type ExecuteCommandMsg struct {
	Name string
}