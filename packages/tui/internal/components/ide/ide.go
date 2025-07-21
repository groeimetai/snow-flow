package ide

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

type IdeComponent interface {
	tea.ViewModel
	SetSize(width, height int) tea.Cmd
	SetBackgroundColor(color compat.AdaptiveColor)
}

type ideComponent struct {
	width, height int
	background    *compat.AdaptiveColor
}

func (c *ideComponent) SetSize(width, height int) tea.Cmd {
	c.width = width
	c.height = height
	return nil
}

func (c *ideComponent) SetBackgroundColor(color compat.AdaptiveColor) {
	c.background = &color
}

func (c *ideComponent) View() string {
	t := theme.CurrentTheme()

	triggerStyle := styles.NewStyle().Foreground(t.Primary()).Bold(true)
	descriptionStyle := styles.NewStyle().Foreground(t.Text())

	if c.background != nil {
		triggerStyle = triggerStyle.Background(*c.background)
		descriptionStyle = descriptionStyle.Background(*c.background)
	}

	// VSCode shortcuts data
	shortcuts := []struct {
		shortcut    string
		description string
	}{
		{"Cmd+Esc", "open opencode in VS Code"},
		{"Cmd+Opt+K", "insert file from VS Code"},
	}

	// Calculate column widths
	maxShortcutWidth := 0
	maxDescriptionWidth := 0

	for _, shortcut := range shortcuts {
		if len(shortcut.shortcut) > maxShortcutWidth {
			maxShortcutWidth = len(shortcut.shortcut)
		}
		if len(shortcut.description) > maxDescriptionWidth {
			maxDescriptionWidth = len(shortcut.description)
		}
	}

	// Add padding between columns
	columnPadding := 3

	// Build the output
	var output strings.Builder

	maxWidth := 0
	for _, shortcut := range shortcuts {
		// Pad each column to align properly
		shortcutText := fmt.Sprintf("%-*s", maxShortcutWidth, shortcut.shortcut)
		description := fmt.Sprintf("%-*s", maxDescriptionWidth, shortcut.description)

		// Apply styles and combine
		line := triggerStyle.Render(shortcutText) +
			triggerStyle.Render(strings.Repeat(" ", columnPadding)) +
			descriptionStyle.Render(description)

		output.WriteString(line + "\n")
		maxWidth = max(maxWidth, lipgloss.Width(line))
	}

	// Remove trailing newline
	result := strings.TrimSuffix(output.String(), "\n")
	if c.background != nil {
		result = styles.NewStyle().Background(*c.background).Width(maxWidth).Render(result)
	}

	return result
}

type Option func(*ideComponent)

func WithBackground(background compat.AdaptiveColor) Option {
	return func(c *ideComponent) {
		c.background = &background
	}
}

func New(opts ...Option) IdeComponent {
	c := &ideComponent{}
	for _, opt := range opts {
		opt(c)
	}
	return c
}
