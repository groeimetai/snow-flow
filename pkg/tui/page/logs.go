package page

import (
	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/tui/components/logs"
	"github.com/sst/opencode/internal/tui/layout"
	"github.com/sst/opencode/internal/tui/styles"
	"github.com/sst/opencode/internal/tui/theme"
)

var LogsPage PageID = "logs"

type LogPage interface {
	tea.Model
	layout.Sizeable
	layout.Bindings
}

// Custom keybindings for logs page
type logsKeyMap struct {
	Left  key.Binding
	Right key.Binding
	Tab   key.Binding
}

var logsKeys = logsKeyMap{
	Left: key.NewBinding(
		key.WithKeys("left", "h"),
		key.WithHelp("←/h", "left pane"),
	),
	Right: key.NewBinding(
		key.WithKeys("right", "l"),
		key.WithHelp("→/l", "right pane"),
	),
	Tab: key.NewBinding(
		key.WithKeys("tab"),
		key.WithHelp("tab", "switch panes"),
	),
}

type logsPage struct {
	width, height int
	table         layout.Container
	details       layout.Container
	activePane    int // 0 = table, 1 = details
	keyMap        logsKeyMap
}

// Message to switch active pane
type switchPaneMsg struct {
	pane int // 0 = table, 1 = details
}

func (p *logsPage) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		p.width = msg.Width
		p.height = msg.Height
		return p, p.SetSize(msg.Width, msg.Height)
	case switchPaneMsg:
		p.activePane = msg.pane
		if p.activePane == 0 {
			p.table.Focus()
			p.details.Blur()
		} else {
			p.table.Blur()
			p.details.Focus()
		}
		return p, nil
	case tea.KeyMsg:
		// Handle navigation keys
		switch {
		case key.Matches(msg, p.keyMap.Left):
			return p, func() tea.Msg {
				return switchPaneMsg{pane: 0}
			}
		case key.Matches(msg, p.keyMap.Right):
			return p, func() tea.Msg {
				return switchPaneMsg{pane: 1}
			}
		case key.Matches(msg, p.keyMap.Tab):
			return p, func() tea.Msg {
				return switchPaneMsg{pane: (p.activePane + 1) % 2}
			}
		}
	}

	// Update the active pane first to handle keyboard input
	if p.activePane == 0 {
		table, cmd := p.table.Update(msg)
		cmds = append(cmds, cmd)
		p.table = table.(layout.Container)

		// Update details pane without focus
		details, cmd := p.details.Update(msg)
		cmds = append(cmds, cmd)
		p.details = details.(layout.Container)
	} else {
		details, cmd := p.details.Update(msg)
		cmds = append(cmds, cmd)
		p.details = details.(layout.Container)

		// Update table pane without focus
		table, cmd := p.table.Update(msg)
		cmds = append(cmds, cmd)
		p.table = table.(layout.Container)
	}

	return p, tea.Batch(cmds...)
}

func (p *logsPage) View() string {
	t := theme.CurrentTheme()

	// Add padding to the right of the table view
	tableView := lipgloss.NewStyle().PaddingRight(3).Render(p.table.View())

	// Add border to the active pane
	tableStyle := lipgloss.NewStyle()
	detailsStyle := lipgloss.NewStyle()

	if p.activePane == 0 {
		tableStyle = tableStyle.BorderForeground(t.Primary())
	} else {
		detailsStyle = detailsStyle.BorderForeground(t.Primary())
	}

	tableView = tableStyle.Render(tableView)
	detailsView := detailsStyle.Render(p.details.View())

	return styles.ForceReplaceBackgroundWithLipgloss(
		lipgloss.JoinVertical(
			lipgloss.Left,
			styles.Bold().Render(" esc")+styles.Muted().Render(" to go back")+
				"  "+styles.Bold().Render(" tab/←→/h/l")+styles.Muted().Render(" to switch panes"),
			"",
			lipgloss.JoinHorizontal(lipgloss.Top,
				tableView,
				detailsView,
			),
			"",
		),
		t.Background(),
	)
}

func (p *logsPage) BindingKeys() []key.Binding {
	// Add our custom keybindings
	bindings := []key.Binding{
		p.keyMap.Left,
		p.keyMap.Right,
		p.keyMap.Tab,
	}

	// Add the active pane's keybindings
	if p.activePane == 0 {
		bindings = append(bindings, p.table.BindingKeys()...)
	} else {
		bindings = append(bindings, p.details.BindingKeys()...)
	}

	return bindings
}

// GetSize implements LogPage.
func (p *logsPage) GetSize() (int, int) {
	return p.width, p.height
}

// SetSize implements LogPage.
func (p *logsPage) SetSize(width int, height int) tea.Cmd {
	p.width = width
	p.height = height

	// Account for padding between panes (3 characters)
	const padding = 3
	leftPaneWidth := (width - padding) / 2
	rightPaneWidth := width - leftPaneWidth - padding

	return tea.Batch(
		p.table.SetSize(leftPaneWidth, height-3),
		p.details.SetSize(rightPaneWidth, height-3),
	)
}

func (p *logsPage) Init() tea.Cmd {
	// Start with table pane active
	p.activePane = 0
	p.table.Focus()
	p.details.Blur()

	// Force an initial selection to update the details pane
	var cmds []tea.Cmd
	cmds = append(cmds, p.table.Init())
	cmds = append(cmds, p.details.Init())

	// Send a key down and then key up to select the first row
	// This ensures the details pane is populated when returning to the logs page
	cmds = append(cmds, func() tea.Msg {
		return tea.KeyMsg{Type: tea.KeyDown}
	})
	cmds = append(cmds, func() tea.Msg {
		return tea.KeyMsg{Type: tea.KeyUp}
	})

	return tea.Batch(cmds...)
}

func NewLogsPage(app *app.App) tea.Model {
	// Create containers with borders to visually indicate active pane
	tableContainer := layout.NewContainer(logs.NewLogsTable(app), layout.WithBorderHorizontal())
	detailsContainer := layout.NewContainer(logs.NewLogsDetails(), layout.WithBorderHorizontal())

	return &logsPage{
		table:      tableContainer,
		details:    detailsContainer,
		activePane: 0, // Start with table pane active
		keyMap:     logsKeys,
	}
}
