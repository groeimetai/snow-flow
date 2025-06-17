package chat

import (
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/v2/key"
	"github.com/charmbracelet/bubbles/v2/spinner"
	"github.com/charmbracelet/bubbles/v2/viewport"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/components/dialog"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/pkg/client"
)

type MessagesComponent interface {
	tea.Model
	tea.ViewModel
}

type messagesComponent struct {
	app             *app.App
	width, height   int
	viewport        viewport.Model
	spinner         spinner.Model
	rendering       bool
	attachments     viewport.Model
	showToolResults bool
	cache           *MessageCache
	tail            bool
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

func (m *messagesComponent) Init() tea.Cmd {
	return tea.Batch(m.viewport.Init(), m.spinner.Tick)
}

func (m *messagesComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	switch msg := msg.(type) {
	case SendMsg:
		m.viewport.GotoBottom()
		m.tail = true
		return m, nil
	case dialog.ThemeSelectedMsg:
		m.cache.Clear()
		m.renderView()
		return m, nil
	case ToggleToolMessagesMsg:
		m.showToolResults = !m.showToolResults
		m.renderView()
		return m, nil
	case app.SessionSelectedMsg:
		m.cache.Clear()
		cmd := m.Reload()
		m.viewport.GotoBottom()
		return m, cmd
	case app.SessionClearedMsg:
		m.cache.Clear()
		cmd := m.Reload()
		return m, cmd
	case tea.KeyMsg:
		if key.Matches(msg, messageKeys.PageUp) ||
			key.Matches(msg, messageKeys.PageDown) ||
			key.Matches(msg, messageKeys.HalfPageUp) ||
			key.Matches(msg, messageKeys.HalfPageDown) {
			u, cmd := m.viewport.Update(msg)
			m.viewport = u
			m.tail = m.viewport.AtBottom()
			cmds = append(cmds, cmd)
		}
	case renderFinishedMsg:
		m.rendering = false
		if m.tail {
			m.viewport.GotoBottom()
		}
	case client.EventSessionUpdated:
		m.renderView()
		if m.tail {
			m.viewport.GotoBottom()
		}
	case client.EventMessageUpdated:
		m.renderView()
		if m.tail {
			m.viewport.GotoBottom()
		}
	}

	spinner, cmd := m.spinner.Update(msg)
	m.spinner = spinner
	cmds = append(cmds, cmd)
	return m, tea.Batch(cmds...)
}

type blockType int

const (
	none blockType = iota
	userTextBlock
	assistantTextBlock
	toolInvocationBlock
	errorBlock
)

func (m *messagesComponent) renderView() {
	if m.width == 0 {
		return
	}

	t := theme.CurrentTheme()
	blocks := make([]string, 0)
	previousBlockType := none
	for _, message := range m.app.Messages {
		var content string
		var cached bool

		author := ""
		switch message.Role {
		case client.User:
			author = m.app.Info.User
		case client.Assistant:
			author = message.Metadata.Assistant.ModelID
		}

		for _, p := range message.Parts {
			part, err := p.ValueByDiscriminator()
			if err != nil {
				continue //TODO: handle error?
			}

			switch part.(type) {
			// case client.MessagePartStepStart:
			// 	messages = append(messages, "")
			case client.MessagePartText:
				text := part.(client.MessagePartText)
				key := m.cache.GenerateKey(message.Id, text.Text, layout.Current.Viewport.Width)
				content, cached = m.cache.Get(key)
				if !cached {
					content = renderText(message, text.Text, author)
					m.cache.Set(key, content)
				}
				if previousBlockType != none {
					blocks = append(blocks, "")
				}
				blocks = append(blocks, content)
				if message.Role == client.User {
					previousBlockType = userTextBlock
				} else if message.Role == client.Assistant {
					previousBlockType = assistantTextBlock
				}
			case client.MessagePartToolInvocation:
				toolInvocationPart := part.(client.MessagePartToolInvocation)
				toolCall, _ := toolInvocationPart.ToolInvocation.AsMessageToolInvocationToolCall()
				metadata := client.MessageInfo_Metadata_Tool_AdditionalProperties{}
				if _, ok := message.Metadata.Tool[toolCall.ToolCallId]; ok {
					metadata = message.Metadata.Tool[toolCall.ToolCallId]
				}
				var result *string
				resultPart, resultError := toolInvocationPart.ToolInvocation.AsMessageToolInvocationToolResult()
				if resultError == nil {
					result = &resultPart.Result
				}

				if toolCall.State == "result" {
					key := m.cache.GenerateKey(message.Id,
						toolCall.ToolCallId,
						m.showToolResults,
						layout.Current.Viewport.Width,
					)
					content, cached = m.cache.Get(key)
					if !cached {
						content = renderToolInvocation(toolCall, result, metadata, m.showToolResults)
						m.cache.Set(key, content)
					}
				} else {
					// if the tool call isn't finished, never cache
					content = renderToolInvocation(toolCall, result, metadata, m.showToolResults)
				}

				if previousBlockType != toolInvocationBlock {
					blocks = append(blocks, "")
				}
				blocks = append(blocks, content)
				previousBlockType = toolInvocationBlock
			}
		}

		error := ""
		if message.Metadata.Error != nil {
			errorValue, _ := message.Metadata.Error.ValueByDiscriminator()
			switch errorValue.(type) {
			case client.UnknownError:
				clientError := errorValue.(client.UnknownError)
				error = clientError.Data.Message
				error = renderContentBlock(error, WithBorderColor(t.Error()), WithFullWidth(), WithMarginTop(1), WithMarginBottom(1))
				blocks = append(blocks, error)
				previousBlockType = errorBlock
			}
		}
	}

	centered := []string{}
	for _, block := range blocks {
		centered = append(centered, lipgloss.PlaceHorizontal(
			m.width,
			lipgloss.Center,
			block,
			lipgloss.WithWhitespaceStyle(lipgloss.NewStyle().Background(t.Background())),
		))
	}

	m.viewport.SetHeight(m.height - lipgloss.Height(m.header()))
	m.viewport.SetContent("\n" + strings.Join(centered, "\n") + "\n")
}

func (m *messagesComponent) header() string {
	if m.app.Session.Id == "" {
		return ""
	}

	t := theme.CurrentTheme()
	width := layout.Current.Container.Width
	base := styles.BaseStyle().Background(t.Background()).Render
	muted := styles.Muted().Background(t.Background()).Render
	headerLines := []string{}
	headerLines = append(headerLines, toMarkdown("# "+m.app.Session.Title, width-6, t.Background()))
	if m.app.Session.Share != nil && m.app.Session.Share.Url != "" {
		headerLines = append(headerLines, muted(m.app.Session.Share.Url))
	} else {
		headerLines = append(headerLines, base("/share")+muted(" to create a shareable link"))
	}
	header := strings.Join(headerLines, "\n")

	header = styles.BaseStyle().
		Width(width).
		PaddingLeft(2).
		PaddingRight(2).
		Background(t.Background()).
		BorderLeft(true).
		BorderRight(true).
		BorderBackground(t.Background()).
		BorderForeground(t.BackgroundSubtle()).
		BorderStyle(lipgloss.ThickBorder()).
		Render(header)

	return "\n" + header + "\n"
}

func (m *messagesComponent) View() string {
	if len(m.app.Messages) == 0 {
		return m.home()
	}
	if m.rendering {
		return m.viewport.View()
	}
	t := theme.CurrentTheme()
	return lipgloss.JoinVertical(
		lipgloss.Left,
		lipgloss.PlaceHorizontal(
			m.width,
			lipgloss.Center,
			m.header(),
			lipgloss.WithWhitespaceStyle(lipgloss.NewStyle().Background(t.Background())),
		),
		m.viewport.View(),
	)
}

func (m *messagesComponent) home() string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle().Background(t.Background())
	base := baseStyle.Render
	muted := styles.Muted().Background(t.Background()).Render

	open := `
█▀▀█ █▀▀█ █▀▀ █▀▀▄ 
█░░█ █░░█ █▀▀ █░░█ 
▀▀▀▀ █▀▀▀ ▀▀▀ ▀  ▀ `
	code := `
█▀▀ █▀▀█ █▀▀▄ █▀▀
█░░ █░░█ █░░█ █▀▀
▀▀▀ ▀▀▀▀ ▀▀▀  ▀▀▀`

	logo := lipgloss.JoinHorizontal(
		lipgloss.Top,
		muted(open),
		base(code),
	)
	// cwd := app.Info.Path.Cwd
	// config := app.Info.Path.Config

	commands := [][]string{
		{"/help", "show help"},
		{"/sessions", "list sessions"},
		{"/new", "start a new session"},
		{"/model", "switch model"},
		{"/theme", "switch theme"},
		{"/quit", "exit the app"},
	}

	commandLines := []string{}
	for _, command := range commands {
		commandLines = append(commandLines, (base(command[0]+" ") + muted(command[1])))
	}

	logoAndVersion := lipgloss.JoinVertical(
		lipgloss.Right,
		logo,
		muted(m.app.Version),
	)

	lines := []string{}
	lines = append(lines, "")
	lines = append(lines, "")
	lines = append(lines, logoAndVersion)
	lines = append(lines, "")
	// lines = append(lines, base("cwd ")+muted(cwd))
	// lines = append(lines, base("config ")+muted(config))
	// lines = append(lines, "")
	lines = append(lines, commandLines...)
	lines = append(lines, "")
	if m.rendering {
		lines = append(lines, base("Loading session..."))
	} else {
		lines = append(lines, "")
	}

	return lipgloss.Place(
		m.width,
		m.height,
		lipgloss.Center,
		lipgloss.Center,
		baseStyle.Width(lipgloss.Width(logoAndVersion)).Render(
			strings.Join(lines, "\n"),
		),
		lipgloss.WithWhitespaceStyle(lipgloss.NewStyle().Background(t.Background())),
	)
}

func (m *messagesComponent) SetSize(width, height int) tea.Cmd {
	if m.width == width && m.height == height {
		return nil
	}
	// Clear cache on resize since width affects rendering
	if m.width != width {
		m.cache.Clear()
	}
	m.width = width
	m.height = height
	m.viewport.SetWidth(width)
	m.viewport.SetHeight(height - lipgloss.Height(m.header()))
	m.attachments.SetWidth(width + 40)
	m.attachments.SetHeight(3)
	m.renderView()
	return nil
}

func (m *messagesComponent) GetSize() (int, int) {
	return m.width, m.height
}

func (m *messagesComponent) Reload() tea.Cmd {
	m.rendering = true
	return func() tea.Msg {
		m.renderView()
		return renderFinishedMsg{}
	}
}

func NewMessagesComponent(app *app.App) MessagesComponent {
	customSpinner := spinner.Spinner{
		Frames: []string{" ", "┃", "┃"},
		FPS:    time.Second / 3,
	}
	s := spinner.New(spinner.WithSpinner(customSpinner))

	vp := viewport.New()
	attachments := viewport.New()
	vp.KeyMap.PageUp = messageKeys.PageUp
	vp.KeyMap.PageDown = messageKeys.PageDown
	vp.KeyMap.HalfPageUp = messageKeys.HalfPageUp
	vp.KeyMap.HalfPageDown = messageKeys.HalfPageDown

	return &messagesComponent{
		app:             app,
		viewport:        vp,
		spinner:         s,
		attachments:     attachments,
		showToolResults: true,
		cache:           NewMessageCache(),
		tail:            true,
	}
}
