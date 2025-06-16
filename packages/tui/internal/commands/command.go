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
type Registry map[string]Command

// ExecuteCommandMsg is a message sent when a command should be executed.
type ExecuteCommandMsg struct {
	Name string
}

func NewCommandRegistry() Registry {
	return Registry{
		"help": {
			Name:        "help",
			Description: "show help",
			KeyBinding: key.NewBinding(
				key.WithKeys("f1", "super+/", "super+h"),
			),
		},
		"new": {
			Name:        "new",
			Description: "new session",
			KeyBinding: key.NewBinding(
				key.WithKeys("f2", "super+n"),
			),
		},
		"sessions": {
			Name:        "sessions",
			Description: "switch session",
			KeyBinding: key.NewBinding(
				key.WithKeys("f3", "super+s"),
			),
		},
		"model": {
			Name:        "model",
			Description: "switch model",
			KeyBinding: key.NewBinding(
				key.WithKeys("f4", "super+m"),
			),
		},
		"theme": {
			Name:        "theme",
			Description: "switch theme",
			KeyBinding: key.NewBinding(
				key.WithKeys("f5", "super+t"),
			),
		},
		"share": {
			Name:        "share",
			Description: "create shareable link",
			KeyBinding: key.NewBinding(
				key.WithKeys("f6"),
			),
		},
		"init": {
			Name:        "init",
			Description: "create or update AGENTS.md",
			KeyBinding: key.NewBinding(
				key.WithKeys("f7"),
			),
		},
		// "compact": {
		// 	Name:        "compact",
		// 	Description: "compact the session",
		// 	KeyBinding: key.NewBinding(
		// 		key.WithKeys("f8"),
		// 	),
		// },
		"quit": {
			Name:        "quit",
			Description: "quit",
			KeyBinding: key.NewBinding(
				key.WithKeys("f10", "ctrl+c", "super+q"),
			),
		},
	}
}
