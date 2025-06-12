package dialog

import (
	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	utilComponents "github.com/sst/opencode/internal/components/util"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

const (
	maxToolsDialogWidth = 60
	maxVisibleTools     = 15
)

// ToolsDialog interface for the tools list dialog
type ToolsDialog interface {
	layout.ModelWithView
	layout.Bindings
	SetTools(tools []string)
}

// ShowToolsDialogMsg is sent to show the tools dialog
type ShowToolsDialogMsg struct {
	Show bool
}

// CloseToolsDialogMsg is sent when the tools dialog is closed
type CloseToolsDialogMsg struct{}

type toolItem struct {
	name string
}

func (t toolItem) Render(selected bool, width int) string {
	th := theme.CurrentTheme()
	baseStyle := styles.BaseStyle().
		Width(width).
		Background(th.Background())

	if selected {
		baseStyle = baseStyle.
			Background(th.Primary()).
			Foreground(th.Background()).
			Bold(true)
	} else {
		baseStyle = baseStyle.
			Foreground(th.Text())
	}

	return baseStyle.Render(t.name)
}

type toolsDialogComponent struct {
	tools  []toolItem
	width  int
	height int
	list   utilComponents.SimpleList[toolItem]
}

type toolsKeyMap struct {
	Up     key.Binding
	Down   key.Binding
	Escape key.Binding
	J      key.Binding
	K      key.Binding
}

var toolsKeys = toolsKeyMap{
	Up: key.NewBinding(
		key.WithKeys("up"),
		key.WithHelp("↑", "previous tool"),
	),
	Down: key.NewBinding(
		key.WithKeys("down"),
		key.WithHelp("↓", "next tool"),
	),
	Escape: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "close"),
	),
	J: key.NewBinding(
		key.WithKeys("j"),
		key.WithHelp("j", "next tool"),
	),
	K: key.NewBinding(
		key.WithKeys("k"),
		key.WithHelp("k", "previous tool"),
	),
}

func (m *toolsDialogComponent) Init() tea.Cmd {
	return nil
}

func (m *toolsDialogComponent) SetTools(tools []string) {
	var toolItems []toolItem
	for _, name := range tools {
		toolItems = append(toolItems, toolItem{name: name})
	}

	m.tools = toolItems
	m.list.SetItems(toolItems)
}

func (m *toolsDialogComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, toolsKeys.Escape):
			return m, func() tea.Msg { return CloseToolsDialogMsg{} }
		// Pass other key messages to the list component
		default:
			var cmd tea.Cmd
			listModel, cmd := m.list.Update(msg)
			m.list = listModel.(utilComponents.SimpleList[toolItem])
			return m, cmd
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	}

	// For non-key messages
	var cmd tea.Cmd
	listModel, cmd := m.list.Update(msg)
	m.list = listModel.(utilComponents.SimpleList[toolItem])
	return m, cmd
}

func (m *toolsDialogComponent) View() string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle().Background(t.Background())

	title := baseStyle.
		Foreground(t.Primary()).
		Bold(true).
		Width(maxToolsDialogWidth).
		Padding(0, 0, 1).
		Render("Available Tools")

	// Calculate dialog width based on content
	dialogWidth := min(maxToolsDialogWidth, m.width/2)
	m.list.SetMaxWidth(dialogWidth)

	content := lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		m.list.View(),
	)

	return baseStyle.Padding(1, 2).
		Border(lipgloss.RoundedBorder()).
		BorderBackground(t.Background()).
		BorderForeground(t.TextMuted()).
		Background(t.Background()).
		Width(lipgloss.Width(content) + 4).
		Render(content)
}

func (m *toolsDialogComponent) BindingKeys() []key.Binding {
	return layout.KeyMapToSlice(toolsKeys)
}

func NewToolsDialogCmp() ToolsDialog {
	list := utilComponents.NewSimpleList[toolItem](
		[]toolItem{},
		maxVisibleTools,
		"No tools available",
		true,
	)

	return &toolsDialogComponent{
		list: list,
	}
}
