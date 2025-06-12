package dialog

import (
	"strings"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
)

const question = "Are you sure you want to quit?"

// QuitDialog interface for the quit confirmation dialog
type QuitDialog interface {
	layout.Modal
	IsQuitDialog() bool
}

type quitDialog struct {
	width  int
	height int

	modal      *modal.Modal
	selectedNo bool
}

type helpMapping struct {
	LeftRight  key.Binding
	EnterSpace key.Binding
	Yes        key.Binding
	No         key.Binding
}

var helpKeys = helpMapping{
	LeftRight: key.NewBinding(
		key.WithKeys("left", "right", "h", "l", "tab"),
		key.WithHelp("←/→", "switch options"),
	),
	EnterSpace: key.NewBinding(
		key.WithKeys("enter", " "),
		key.WithHelp("enter/space", "confirm"),
	),
	Yes: key.NewBinding(
		key.WithKeys("y", "Y", "ctrl+c"),
		key.WithHelp("y/Y", "yes"),
	),
	No: key.NewBinding(
		key.WithKeys("n", "N"),
		key.WithHelp("n/N", "no"),
	),
}

func (q *quitDialog) Init() tea.Cmd {
	return nil
}

func (q *quitDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		q.width = msg.Width
		q.height = msg.Height
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, helpKeys.LeftRight):
			q.selectedNo = !q.selectedNo
			return q, nil
		case key.Matches(msg, helpKeys.EnterSpace):
			if !q.selectedNo {
				return q, tea.Quit
			}
			return q, tea.Batch(
				util.CmdHandler(modal.CloseModalMsg{}),
			)
		case key.Matches(msg, helpKeys.Yes):
			return q, tea.Quit
		case key.Matches(msg, helpKeys.No):
			return q, tea.Batch(
				util.CmdHandler(modal.CloseModalMsg{}),
			)
		}
	}
	return q, nil
}

func (q *quitDialog) Render(background string) string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle()

	yesStyle := baseStyle
	noStyle := baseStyle
	spacerStyle := baseStyle.Background(t.BackgroundElement())

	if q.selectedNo {
		noStyle = noStyle.Background(t.Primary()).Foreground(t.BackgroundElement())
		yesStyle = yesStyle.Background(t.BackgroundElement()).Foreground(t.Primary())
	} else {
		yesStyle = yesStyle.Background(t.Primary()).Foreground(t.BackgroundElement())
		noStyle = noStyle.Background(t.BackgroundElement()).Foreground(t.Primary())
	}

	yesButton := yesStyle.Padding(0, 1).Render("Yes")
	noButton := noStyle.Padding(0, 1).Render("No")

	buttons := lipgloss.JoinHorizontal(lipgloss.Left, yesButton, spacerStyle.Render("  "), noButton)

	width := lipgloss.Width(question)
	remainingWidth := width - lipgloss.Width(buttons)
	if remainingWidth > 0 {
		buttons = spacerStyle.Render(strings.Repeat(" ", remainingWidth)) + buttons
	}

	content := baseStyle.Render(
		lipgloss.JoinVertical(
			lipgloss.Center,
			question,
			"",
			buttons,
		),
	)

	return q.modal.Render(content, background)
}

func (q *quitDialog) Close() tea.Cmd {
	return nil
}

func (q *quitDialog) IsQuitDialog() bool {
	return true
}

// NewQuitDialog creates a new quit confirmation dialog
func NewQuitDialog() QuitDialog {
	return &quitDialog{
		selectedNo: true,
		modal:      modal.New(),
	}
}
