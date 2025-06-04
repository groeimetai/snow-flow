package chat

import (
	"fmt"
	"time"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/components/dialog"
	"github.com/sst/opencode/internal/state"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/pkg/client"
)

type messagesCmp struct {
	app              *app.App
	width, height    int
	viewport         viewport.Model
	spinner          spinner.Model
	rendering        bool
	attachments      viewport.Model
	showToolMessages bool
}
type renderFinishedMsg struct{}
type ToggleToolMessagesMsg struct{}

type MessageKeys struct {
	PageDown     key.Binding
	PageUp       key.Binding
	HalfPageUp   key.Binding
	HalfPageDown key.Binding
}

var messageKeys = MessageKeys{
	PageDown: key.NewBinding(
		key.WithKeys("pgdown"),
		key.WithHelp("f/pgdn", "page down"),
	),
	PageUp: key.NewBinding(
		key.WithKeys("pgup"),
		key.WithHelp("b/pgup", "page up"),
	),
	HalfPageUp: key.NewBinding(
		key.WithKeys("ctrl+u"),
		key.WithHelp("ctrl+u", "½ page up"),
	),
	HalfPageDown: key.NewBinding(
		key.WithKeys("ctrl+d", "ctrl+d"),
		key.WithHelp("ctrl+d", "½ page down"),
	),
}

func (m *messagesCmp) Init() tea.Cmd {
	return tea.Batch(m.viewport.Init(), m.spinner.Tick)
}

func (m *messagesCmp) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	switch msg := msg.(type) {
	case dialog.ThemeChangedMsg:
		m.renderView()
		return m, nil
	case ToggleToolMessagesMsg:
		m.showToolMessages = !m.showToolMessages
		m.renderView()
		return m, nil
	case state.SessionSelectedMsg:
		cmd := m.Reload()
		return m, cmd
	case state.SessionClearedMsg:
		cmd := m.Reload()
		return m, cmd
	case tea.KeyMsg:
		if key.Matches(msg, messageKeys.PageUp) || key.Matches(msg, messageKeys.PageDown) ||
			key.Matches(msg, messageKeys.HalfPageUp) || key.Matches(msg, messageKeys.HalfPageDown) {
			u, cmd := m.viewport.Update(msg)
			m.viewport = u
			cmds = append(cmds, cmd)
		}
	case renderFinishedMsg:
		m.rendering = false
		m.viewport.GotoBottom()
	case state.StateUpdatedMsg:
		m.renderView()
		m.viewport.GotoBottom()
	}

	spinner, cmd := m.spinner.Update(msg)
	m.spinner = spinner
	cmds = append(cmds, cmd)
	return m, tea.Batch(cmds...)
}

func (m *messagesCmp) renderView() {
	if m.width == 0 {
		return
	}

	messages := make([]string, 0)
	for _, msg := range m.app.Messages {
		switch msg.Role {
		case client.User:
			content := renderUserMessage(m.app.Info.User, msg, m.width)
			messages = append(messages, content+"\n")
		case client.Assistant:
			content := renderAssistantMessage(msg, m.width, m.showToolMessages, *m.app.Info)
			messages = append(messages, content+"\n")
		}
	}

	m.viewport.SetContent(
		styles.BaseStyle().
			Render(
				lipgloss.JoinVertical(
					lipgloss.Top,
					messages...,
				),
			),
	)
}

func (m *messagesCmp) View() string {
	baseStyle := styles.BaseStyle()

	if m.rendering {
		return baseStyle.
			Width(m.width).
			Render(
				lipgloss.JoinVertical(
					lipgloss.Top,
					"Loading...",
					m.working(),
					m.help(),
				),
			)
	}

	if len(m.app.Messages) == 0 {
		content := baseStyle.
			Width(m.width).
			Height(m.height - 1).
			Render(
				m.initialScreen(),
			)

		return baseStyle.
			Width(m.width).
			Render(
				lipgloss.JoinVertical(
					lipgloss.Top,
					content,
					"",
					m.help(),
				),
			)
	}

	return baseStyle.
		Width(m.width).
		Render(
			lipgloss.JoinVertical(
				lipgloss.Top,
				m.viewport.View(),
				m.working(),
				m.help(),
			),
		)
}

// func hasToolsWithoutResponse(messages []message.Message) bool {
// 	toolCalls := make([]message.ToolCall, 0)
// 	toolResults := make([]message.ToolResult, 0)
// 	for _, m := range messages {
// 		toolCalls = append(toolCalls, m.ToolCalls()...)
// 		toolResults = append(toolResults, m.ToolResults()...)
// 	}
//
// 	for _, v := range toolCalls {
// 		found := false
// 		for _, r := range toolResults {
// 			if v.ID == r.ToolCallID {
// 				found = true
// 				break
// 			}
// 		}
// 		if !found && v.Finished {
// 			return true
// 		}
// 	}
// 	return false
// }

// func hasUnfinishedToolCalls(messages []message.Message) bool {
// 	toolCalls := make([]message.ToolCall, 0)
// 	for _, m := range messages {
// 		toolCalls = append(toolCalls, m.ToolCalls()...)
// 	}
// 	for _, v := range toolCalls {
// 		if !v.Finished {
// 			return true
// 		}
// 	}
// 	return false
// }

func (m *messagesCmp) working() string {
	text := ""
	if len(m.app.Messages) > 0 {
		t := theme.CurrentTheme()
		baseStyle := styles.BaseStyle()

		task := ""
		if m.app.IsBusy() {
			task = "Working..."
		}
		// lastMessage := m.app.Messages[len(m.app.Messages)-1]
		// if hasToolsWithoutResponse(m.app.Messages) {
		// 	task = "Waiting for tool response..."
		// } else if hasUnfinishedToolCalls(m.app.Messages) {
		// 	task = "Building tool call..."
		// } else if !lastMessage.IsFinished() {
		// 	task = "Generating..."
		// }
		if task != "" {
			text += baseStyle.
				Width(m.width).
				Foreground(t.Primary()).
				Bold(true).
				Render(fmt.Sprintf("%s %s ", m.spinner.View(), task))
		}
	}
	return text
}

func (m *messagesCmp) help() string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle()

	text := ""

	if m.app.IsBusy() {
		text += lipgloss.JoinHorizontal(
			lipgloss.Left,
			baseStyle.Foreground(t.TextMuted()).Bold(true).Render("press "),
			baseStyle.Foreground(t.Text()).Bold(true).Render("esc"),
			baseStyle.Foreground(t.TextMuted()).Bold(true).Render(" to interrupt"),
		)
	} else {
		text += lipgloss.JoinHorizontal(
			lipgloss.Left,
			baseStyle.Foreground(t.Text()).Bold(true).Render("enter"),
			baseStyle.Foreground(t.TextMuted()).Bold(true).Render(" to send,"),
			baseStyle.Foreground(t.Text()).Bold(true).Render(" \\"),
			baseStyle.Foreground(t.TextMuted()).Bold(true).Render("+"),
			baseStyle.Foreground(t.Text()).Bold(true).Render("enter"),
			baseStyle.Foreground(t.TextMuted()).Bold(true).Render(" for newline,"),
			baseStyle.Foreground(t.Text()).Bold(true).Render(" ↑↓"),
			baseStyle.Foreground(t.TextMuted()).Bold(true).Render(" for history,"),
			baseStyle.Foreground(t.Text()).Bold(true).Render(" ctrl+h"),
			baseStyle.Foreground(t.TextMuted()).Bold(true).Render(" to toggle tool messages"),
		)
	}
	return baseStyle.
		Width(m.width).
		Render(text)
}

func (m *messagesCmp) initialScreen() string {
	baseStyle := styles.BaseStyle()

	return baseStyle.Width(m.width).Render(
		lipgloss.JoinVertical(
			lipgloss.Top,
			header(m.app, m.width),
			"",
			lspsConfigured(m.width),
		),
	)
}

func (m *messagesCmp) SetSize(width, height int) tea.Cmd {
	if m.width == width && m.height == height {
		return nil
	}
	m.width = width
	m.height = height
	m.viewport.Width = width
	m.viewport.Height = height - 2
	m.attachments.Width = width + 40
	m.attachments.Height = 3
	m.renderView()
	return nil
}

func (m *messagesCmp) GetSize() (int, int) {
	return m.width, m.height
}

func (m *messagesCmp) Reload() tea.Cmd {
	m.rendering = true
	return func() tea.Msg {
		m.renderView()
		return renderFinishedMsg{}
	}
}

func (m *messagesCmp) BindingKeys() []key.Binding {
	return []key.Binding{
		m.viewport.KeyMap.PageDown,
		m.viewport.KeyMap.PageUp,
		m.viewport.KeyMap.HalfPageUp,
		m.viewport.KeyMap.HalfPageDown,
	}
}

func NewMessagesCmp(app *app.App) tea.Model {
	customSpinner := spinner.Spinner{
		Frames: []string{" ", "┃", "┃"},
		FPS:    time.Second / 3,
	}
	s := spinner.New(spinner.WithSpinner(customSpinner))

	vp := viewport.New(0, 0)
	attachments := viewport.New(0, 0)
	vp.KeyMap.PageUp = messageKeys.PageUp
	vp.KeyMap.PageDown = messageKeys.PageDown
	vp.KeyMap.HalfPageUp = messageKeys.HalfPageUp
	vp.KeyMap.HalfPageDown = messageKeys.HalfPageDown

	return &messagesCmp{
		app:              app,
		viewport:         vp,
		spinner:          s,
		attachments:      attachments,
		showToolMessages: true,
	}
}
