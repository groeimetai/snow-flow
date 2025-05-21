package logs

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sst/opencode/internal/logging"
	"github.com/sst/opencode/internal/tui/layout"
	"github.com/sst/opencode/internal/tui/styles"
	"github.com/sst/opencode/internal/tui/theme"
)

type DetailComponent interface {
	tea.Model
	layout.Sizeable
	layout.Bindings
}

type detailCmp struct {
	width, height int
	currentLog    logging.Log
	viewport      viewport.Model
	focused       bool
}

func (i *detailCmp) Init() tea.Cmd {
	return nil
}

func (i *detailCmp) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case selectedLogMsg:
		if msg.ID != i.currentLog.ID {
			i.currentLog = logging.Log(msg)
			// Defer content update to avoid blocking the UI
			cmd = tea.Tick(time.Millisecond*1, func(time.Time) tea.Msg {
				i.updateContent()
				return nil
			})
		}
	case tea.KeyMsg:
		// Only process keyboard input when focused
		if !i.focused {
			return i, nil
		}
		// Handle keyboard input for scrolling
		i.viewport, cmd = i.viewport.Update(msg)
		return i, cmd
	}

	return i, cmd
}

func (i *detailCmp) updateContent() {
	var content strings.Builder
	t := theme.CurrentTheme()

	// Format the header with timestamp and level
	timeStyle := lipgloss.NewStyle().Foreground(t.TextMuted())
	levelStyle := getLevelStyle(i.currentLog.Level)

	// Format timestamp
	timeStr := i.currentLog.Timestamp.Format(time.RFC3339)

	header := lipgloss.JoinHorizontal(
		lipgloss.Center,
		timeStyle.Render(timeStr),
		"  ",
		levelStyle.Render(i.currentLog.Level),
	)

	content.WriteString(lipgloss.NewStyle().Bold(true).Render(header))
	content.WriteString("\n\n")

	// Message with styling
	messageStyle := lipgloss.NewStyle().Bold(true).Foreground(t.Text())
	content.WriteString(messageStyle.Render("Message:"))
	content.WriteString("\n")
	content.WriteString(lipgloss.NewStyle().Padding(0, 2).Width(i.width).Render(i.currentLog.Message))
	content.WriteString("\n\n")

	// Attributes section
	if len(i.currentLog.Attributes) > 0 {
		attrHeaderStyle := lipgloss.NewStyle().Bold(true).Foreground(t.Text())
		content.WriteString(attrHeaderStyle.Render("Attributes:"))
		content.WriteString("\n")

		// Create a table-like display for attributes
		keyStyle := lipgloss.NewStyle().Foreground(t.Primary()).Bold(true)
		valueStyle := lipgloss.NewStyle().Foreground(t.Text())

		for key, value := range i.currentLog.Attributes {
			// if value is JSON, render it with indentation
			if strings.HasPrefix(value, "{") {
				var indented bytes.Buffer
				if err := json.Indent(&indented, []byte(value), "", "  "); err != nil {
					indented.WriteString(value)
				}
				value = indented.String()
			}

			attrLine := fmt.Sprintf("%s: %s",
				keyStyle.Render(key),
				valueStyle.Render(value),
			)

			content.WriteString(lipgloss.NewStyle().Padding(0, 2).Width(i.width).Render(attrLine))
			content.WriteString("\n")
		}
	}

	// Session ID if available
	if i.currentLog.SessionID != "" {
		sessionStyle := lipgloss.NewStyle().Bold(true).Foreground(t.Text())
		content.WriteString("\n")
		content.WriteString(sessionStyle.Render("Session:"))
		content.WriteString("\n")
		content.WriteString(lipgloss.NewStyle().Padding(0, 2).Width(i.width).Render(i.currentLog.SessionID))
	}

	i.viewport.SetContent(content.String())
}

func getLevelStyle(level string) lipgloss.Style {
	style := lipgloss.NewStyle().Bold(true)
	t := theme.CurrentTheme()

	switch strings.ToLower(level) {
	case "info":
		return style.Foreground(t.Info())
	case "warn", "warning":
		return style.Foreground(t.Warning())
	case "error", "err":
		return style.Foreground(t.Error())
	case "debug":
		return style.Foreground(t.Success())
	default:
		return style.Foreground(t.Text())
	}
}

func (i *detailCmp) View() string {
	t := theme.CurrentTheme()
	return styles.ForceReplaceBackgroundWithLipgloss(i.viewport.View(), t.Background())
}

func (i *detailCmp) GetSize() (int, int) {
	return i.width, i.height
}

func (i *detailCmp) SetSize(width int, height int) tea.Cmd {
	i.width = width
	i.height = height
	i.viewport.Width = i.width
	i.viewport.Height = i.height
	i.updateContent()
	return nil
}

func (i *detailCmp) BindingKeys() []key.Binding {
	return layout.KeyMapToSlice(i.viewport.KeyMap)
}

func NewLogsDetails() DetailComponent {
	return &detailCmp{
		viewport: viewport.New(0, 0),
	}
}

// Focus implements the focusable interface
func (i *detailCmp) Focus() {
	i.focused = true
	i.viewport.SetYOffset(i.viewport.YOffset)
}

// Blur implements the blurable interface
func (i *detailCmp) Blur() {
	i.focused = false
}
