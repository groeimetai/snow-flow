package dialog

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/commands"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/theme"
)

type helpDialog struct {
	width    int
	height   int
	modal    *modal.Modal
	commands []commands.Command
}

func (h *helpDialog) Init() tea.Cmd {
	return nil
}

func (h *helpDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		h.width = msg.Width
		h.height = msg.Height
	}
	return h, nil
}

func (h *helpDialog) View() string {
	t := theme.CurrentTheme()
	keyStyle := lipgloss.NewStyle().
		Background(t.BackgroundElement()).
		Foreground(t.Text()).
		Bold(true)
	descStyle := lipgloss.NewStyle().
		Background(t.BackgroundElement()).
		Foreground(t.TextMuted())
	contentStyle := lipgloss.NewStyle().
		PaddingLeft(1).Background(t.BackgroundElement())

	lines := []string{}
	for _, b := range h.commands {
		// Only interested in slash commands
		if b.Trigger == "" {
			continue
		}

		content := keyStyle.Render("/" + b.Trigger)
		content += descStyle.Render(" " + b.Description)
		// for i, key := range b.Keybindings {
		// 	if i == 0 {
		// keyString := " (" + key.Key + ")"
		// space := max(h.width-lipgloss.Width(content)-lipgloss.Width(keyString), 0)
		// spacer := strings.Repeat(" ", space)
		// content += descStyle.Render(spacer)
		// content += descStyle.Render(keyString)
		// 	}
		// }

		lines = append(lines, contentStyle.Render(content))
	}

	return strings.Join(lines, "\n")
}

func (h *helpDialog) Render(background string) string {
	return h.modal.Render(h.View(), background)
}

func (h *helpDialog) Close() tea.Cmd {
	return nil
}

type HelpDialog interface {
	layout.Modal
}

func NewHelpDialog(commands []commands.Command) HelpDialog {
	return &helpDialog{
		commands: commands,
		modal:    modal.New(modal.WithTitle("Help")),
	}
}
