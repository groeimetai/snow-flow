package dialog

import (
	"strings"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/theme"
)

type helpDialog struct {
	width    int
	height   int
	modal    *modal.Modal
	bindings []key.Binding
}

// func (i bindingItem) Render(selected bool, width int) string {
// 	t := theme.CurrentTheme()
// 	baseStyle := styles.BaseStyle().
// 		Width(width - 2).
// 		Background(t.BackgroundElement())
//
// 	if selected {
// 		baseStyle = baseStyle.
// 			Background(t.Primary()).
// 			Foreground(t.BackgroundElement()).
// 			Bold(true)
// 	} else {
// 		baseStyle = baseStyle.
// 			Foreground(t.Text())
// 	}
//
// 	return baseStyle.Padding(0, 1).Render(i.binding.Help().Desc)
// }

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
	for _, b := range h.bindings {
		content := keyStyle.Render(b.Help().Key)
		content += descStyle.Render(" " + b.Help().Desc)
		for i, key := range b.Keys() {
			if i == 0 {
				keyString := " (" + strings.ToUpper(key) + ")"
				// space := max(h.width-lipgloss.Width(content)-lipgloss.Width(keyString), 0)
				// spacer := strings.Repeat(" ", space)
				// content += descStyle.Render(spacer)
				content += descStyle.Render(keyString)
			}
		}

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

func NewHelpDialog(bindings ...key.Binding) HelpDialog {
	return &helpDialog{
		bindings: bindings,
		modal:    modal.New(),
	}
}
