package dialog

import (
	"context"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/components/list"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
	"github.com/sst/opencode/pkg/client"
)

// SessionDialog interface for the session switching dialog
type SessionDialog interface {
	layout.Modal
}

type sessionItem client.SessionInfo

func (s sessionItem) Render(selected bool, width int) string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle().
		Width(width - 4).
		Background(t.BackgroundElement())

	if selected {
		baseStyle = baseStyle.
			Background(t.Primary()).
			Foreground(t.BackgroundElement()).
			Bold(true)
	} else {
		baseStyle = baseStyle.
			Foreground(t.Text())
	}

	return baseStyle.Padding(0, 1).Render(s.Title)
}

type sessionDialog struct {
	width             int
	height            int
	modal             *modal.Modal
	selectedSessionID string
	list              list.List[sessionItem]
}

func (s *sessionDialog) Init() tea.Cmd {
	return nil
}

func (s *sessionDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		s.width = msg.Width
		s.height = msg.Height
		s.list.SetMaxWidth(layout.Current.Container.Width - 12)
	case tea.KeyPressMsg:
		switch msg.String() {
		case "enter":
			if item, idx := s.list.GetSelectedItem(); idx >= 0 {
				s.selectedSessionID = item.Id
				return s, tea.Sequence(
					util.CmdHandler(modal.CloseModalMsg{}),
					util.CmdHandler(app.SessionSelectedMsg(&item)),
				)
			}
		}
	}

	var cmd tea.Cmd
	listModel, cmd := s.list.Update(msg)
	s.list = listModel.(list.List[sessionItem])
	return s, cmd
}

func (s *sessionDialog) Render(background string) string {
	return s.modal.Render(s.list.View(), background)
}

func (s *sessionDialog) Close() tea.Cmd {
	return nil
}

// NewSessionDialog creates a new session switching dialog
func NewSessionDialog(app *app.App) SessionDialog {
	sessions, _ := app.ListSessions(context.Background())

	var sessionItems []sessionItem
	for _, sess := range sessions {
		if sess.ParentID != nil {
			continue
		}
		sessionItems = append(sessionItems, sessionItem(sess))
	}

	list := list.NewListComponent(
		sessionItems,
		10, // maxVisibleSessions
		"No sessions available",
		true, // useAlphaNumericKeys
	)

	return &sessionDialog{
		list:  list,
		modal: modal.New(modal.WithTitle("Switch Session"), modal.WithMaxWidth(80)),
	}
}
