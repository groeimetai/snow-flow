package dialog

import (
	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	utilComponents "github.com/sst/opencode/internal/components/util"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
	"github.com/sst/opencode/pkg/client"
)

// CloseSessionDialogMsg is sent when the session dialog is closed
type CloseSessionDialogMsg struct {
	Session *client.SessionInfo
}

// SessionDialog interface for the session switching dialog
type SessionDialog interface {
	layout.ModelWithView
	layout.Bindings
	SetSessions(sessions []client.SessionInfo)
	SetSelectedSession(sessionID string)
}

type sessionItem struct {
	session client.SessionInfo
}

func (s sessionItem) Render(selected bool, width int) string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle().
		Width(width - 2).
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

	return baseStyle.Padding(0, 1).Render(s.session.Title)
}

type sessionDialogComponent struct {
	sessions          []client.SessionInfo
	width             int
	height            int
	selectedSessionID string
	list              utilComponents.SimpleList[sessionItem]
}

type sessionKeyMap struct {
	Enter  key.Binding
	Escape key.Binding
}

var sessionKeys = sessionKeyMap{
	Enter: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "select session"),
	),
	Escape: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "close"),
	),
}

func (s *sessionDialogComponent) Init() tea.Cmd {
	return nil
}

func (s *sessionDialogComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		s.width = msg.Width
		s.height = msg.Height
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, sessionKeys.Enter):
			if item, idx := s.list.GetSelectedItem(); idx >= 0 {
				selectedSession := item.session
				s.selectedSessionID = selectedSession.Id

				return s, util.CmdHandler(CloseSessionDialogMsg{
					Session: &selectedSession,
				})
			}
		case key.Matches(msg, sessionKeys.Escape):
			return s, util.CmdHandler(CloseSessionDialogMsg{})
		default:
			// Pass other key messages to the list component
			var cmd tea.Cmd
			listModel, cmd := s.list.Update(msg)
			s.list = listModel.(utilComponents.SimpleList[sessionItem])
			return s, cmd
		}
	}

	// For non-key messages
	var cmd tea.Cmd
	listModel, cmd := s.list.Update(msg)
	s.list = listModel.(utilComponents.SimpleList[sessionItem])
	return s, cmd
}

func (s *sessionDialogComponent) View() string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle().Background(t.BackgroundElement())
	outerWidth := layout.Current.Container.Width - 8
	width := outerWidth - 4

	if len(s.sessions) == 0 {
		return baseStyle.Padding(1, 2).
			Border(lipgloss.RoundedBorder()).
			BorderBackground(t.Background()).
			BorderForeground(t.TextMuted()).
			Width(width).
			Render("No sessions available")
	}

	// Set the max width for the list
	s.list.SetMaxWidth(width)

	title := baseStyle.
		Foreground(t.Primary()).
		Bold(true).
		Width(width).
		Padding(0, 1).
		Render("Switch Session")

	content := lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		// baseStyle.Width(width).Render(""),
		"",
		s.list.View(),
		"",
		// baseStyle.Width(width).Render(""),
	)

	style := styles.BaseStyle().
		PaddingTop(1).
		PaddingBottom(1).
		PaddingLeft(2).
		PaddingRight(2).
		Background(t.BackgroundElement()).
		Foreground(t.TextMuted()).
		BorderStyle(lipgloss.ThickBorder())

	style = style.
		BorderLeft(true).
		BorderRight(true).
		// AlignHorizontal(align).
		BorderLeftForeground(t.BackgroundSubtle()).
		BorderLeftBackground(t.Background()).
		BorderRightForeground(t.BackgroundSubtle()).
		BorderRightBackground(t.Background())

	return style.
		// Border(lipgloss.ThickBorder()).
		// BorderBackground(t.BackgroundElement()).
		// BorderForeground(t.BorderSubtle()).
		Width(outerWidth).
		Render(content)
}

func (s *sessionDialogComponent) BindingKeys() []key.Binding {
	// Combine session dialog keys with list keys
	dialogKeys := layout.KeyMapToSlice(sessionKeys)
	listKeys := s.list.BindingKeys()
	return append(dialogKeys, listKeys...)
}

func (s *sessionDialogComponent) SetSessions(sessions []client.SessionInfo) {
	s.sessions = sessions

	// Convert sessions to sessionItems
	var sessionItems []sessionItem

	for _, sess := range sessions {
		sessionItems = append(sessionItems, sessionItem{session: sess})
	}

	s.list.SetItems(sessionItems)
}

func (s *sessionDialogComponent) SetSelectedSession(sessionID string) {
	s.selectedSessionID = sessionID

	// Update the selected index if sessions are already loaded
	if len(s.sessions) > 0 {
		// Re-set the sessions to update the selection
		s.SetSessions(s.sessions)
	}
}

// NewSessionDialogCmp creates a new session switching dialog
func NewSessionDialogCmp() SessionDialog {
	list := utilComponents.NewSimpleList[sessionItem](
		[]sessionItem{},
		10, // maxVisibleSessions
		"No sessions available",
		true, // useAlphaNumericKeys
	)

	return &sessionDialogComponent{
		sessions:          []client.SessionInfo{},
		selectedSessionID: "",
		list:              list,
	}
}
