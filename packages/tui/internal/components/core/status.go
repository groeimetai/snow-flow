package core

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/pubsub"
	"github.com/sst/opencode/internal/status"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

type StatusComponent interface {
	layout.ModelWithView
}

type statusComponent struct {
	app         *app.App
	queue       []status.StatusMessage
	width       int
	messageTTL  time.Duration
	activeUntil time.Time
}

// clearMessageCmd is a command that clears status messages after a timeout
func (m statusComponent) clearMessageCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return statusCleanupMsg{time: t}
	})
}

// statusCleanupMsg is a message that triggers cleanup of expired status messages
type statusCleanupMsg struct {
	time time.Time
}

func (m statusComponent) Init() tea.Cmd {
	return m.clearMessageCmd()
}

func (m statusComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case pubsub.Event[status.StatusMessage]:
		if msg.Type == status.EventStatusPublished {
			// If this is a critical message, move it to the front of the queue
			if msg.Payload.Critical {
				// Insert at the front of the queue
				m.queue = append([]status.StatusMessage{msg.Payload}, m.queue...)

				// Reset active time to show critical message immediately
				m.activeUntil = time.Time{}
			} else {
				// Otherwise, just add it to the queue
				m.queue = append(m.queue, msg.Payload)

				// If this is the first message and nothing is active, activate it immediately
				if len(m.queue) == 1 && m.activeUntil.IsZero() {
					now := time.Now()
					duration := m.messageTTL
					if msg.Payload.Duration > 0 {
						duration = msg.Payload.Duration
					}
					m.activeUntil = now.Add(duration)
				}
			}
		}
	case statusCleanupMsg:
		now := msg.time

		// If the active message has expired, remove it and activate the next one
		if !m.activeUntil.IsZero() && m.activeUntil.Before(now) {
			// Current message expired, remove it if we have one
			if len(m.queue) > 0 {
				m.queue = m.queue[1:]
			}
			m.activeUntil = time.Time{}
		}

		// If we have messages in queue but none are active, activate the first one
		if len(m.queue) > 0 && m.activeUntil.IsZero() {
			// Use custom duration if specified, otherwise use default
			duration := m.messageTTL
			if m.queue[0].Duration > 0 {
				duration = m.queue[0].Duration
			}
			m.activeUntil = now.Add(duration)
		}

		return m, m.clearMessageCmd()
	}
	return m, nil
}

func logo() string {
	t := theme.CurrentTheme()
	base := lipgloss.NewStyle().Background(t.BackgroundElement()).Foreground(t.TextMuted()).Render
	emphasis := lipgloss.NewStyle().Bold(true).Background(t.BackgroundElement()).Foreground(t.Text()).Render

	open := base("open")
	code := emphasis("code ")
	version := base(app.Info.Version)
	return styles.Padded().
		Background(t.BackgroundElement()).
		Render(open + code + version)
}

func formatTokensAndCost(tokens float32, contextWindow float32, cost float32) string {
	// Format tokens in human-readable format (e.g., 110K, 1.2M)
	var formattedTokens string
	switch {
	case tokens >= 1_000_000:
		formattedTokens = fmt.Sprintf("%.1fM", float64(tokens)/1_000_000)
	case tokens >= 1_000:
		formattedTokens = fmt.Sprintf("%.1fK", float64(tokens)/1_000)
	default:
		formattedTokens = fmt.Sprintf("%d", int(tokens))
	}

	// Remove .0 suffix if present
	if strings.HasSuffix(formattedTokens, ".0K") {
		formattedTokens = strings.Replace(formattedTokens, ".0K", "K", 1)
	}
	if strings.HasSuffix(formattedTokens, ".0M") {
		formattedTokens = strings.Replace(formattedTokens, ".0M", "M", 1)
	}

	// Format cost with $ symbol and 2 decimal places
	formattedCost := fmt.Sprintf("$%.2f", cost)
	percentage := (float64(tokens) / float64(contextWindow)) * 100

	return fmt.Sprintf("Tokens: %s (%d%%), Cost: %s", formattedTokens, int(percentage), formattedCost)
}

func (m statusComponent) View() string {
	t := theme.CurrentTheme()
	if m.app.Session.Id == "" {
		return styles.BaseStyle().
			Background(t.Background()).
			Width(m.width).
			Height(2).
			Render("")
	}

	logo := logo()

	cwd := styles.Padded().
		Foreground(t.TextMuted()).
		Background(t.BackgroundSubtle()).
		Render(app.Info.Path.Cwd)

	sessionInfo := ""
	if m.app.Session.Id != "" {
		tokens := float32(0)
		cost := float32(0)
		contextWindow := m.app.Model.Limit.Context

		for _, message := range m.app.Messages {
			if message.Metadata.Assistant != nil {
				cost += message.Metadata.Assistant.Cost
				usage := message.Metadata.Assistant.Tokens
				if usage.Output > 0 {
					tokens = (usage.Input + usage.Output + usage.Reasoning)
				}
			}
		}

		sessionInfo = styles.Padded().
			Background(t.BackgroundElement()).
			Foreground(t.TextMuted()).
			Render(formatTokensAndCost(tokens, contextWindow, cost))
	}

	// diagnostics := styles.Padded().Background(t.BackgroundElement()).Render(m.projectDiagnostics())

	space := max(
		0,
		m.width-lipgloss.Width(logo)-lipgloss.Width(cwd)-lipgloss.Width(sessionInfo),
	)
	spacer := lipgloss.NewStyle().Background(t.BackgroundSubtle()).Width(space).Render("")

	status := logo + cwd + spacer + sessionInfo

	blank := styles.BaseStyle().Background(t.Background()).Width(m.width).Render("")
	return blank + "\n" + status

	// Display the first status message if available
	// var statusMessage string
	// if len(m.queue) > 0 {
	// 	sm := m.queue[0]
	// 	infoStyle := styles.Padded().
	// 		Foreground(t.Background())
	//
	// 	switch sm.Level {
	// 	case "info":
	// 		infoStyle = infoStyle.Background(t.Info())
	// 	case "warn":
	// 		infoStyle = infoStyle.Background(t.Warning())
	// 	case "error":
	// 		infoStyle = infoStyle.Background(t.Error())
	// 	case "debug":
	// 		infoStyle = infoStyle.Background(t.TextMuted())
	// 	}
	//
	// 	// Truncate message if it's longer than available width
	// 	msg := sm.Message
	// 	availWidth := statusWidth - 10
	//
	// 	// If we have enough space, show inline
	// 	if availWidth >= minInlineWidth {
	// 		if len(msg) > availWidth && availWidth > 0 {
	// 			msg = msg[:availWidth] + "..."
	// 		}
	// 		status += infoStyle.Width(statusWidth).Render(msg)
	// 	} else {
	// 		// Otherwise, prepare a full-width message to show above
	// 		if len(msg) > m.width-10 && m.width > 10 {
	// 			msg = msg[:m.width-10] + "..."
	// 		}
	// 		statusMessage = infoStyle.Width(m.width).Render(msg)
	//
	// 		// Add empty space in the status bar
	// 		status += styles.Padded().
	// 			Foreground(t.Text()).
	// 			Background(t.BackgroundSubtle()).
	// 			Width(statusWidth).
	// 			Render("")
	// 	}
	// } else {
	// 	status += styles.Padded().
	// 		Foreground(t.Text()).
	// 		Background(t.BackgroundSubtle()).
	// 		Width(statusWidth).
	// 		Render("")
	// }

	// status += diagnostics
	// status += modelName

	// If we have a separate status message, prepend it
	// if statusMessage != "" {
	// 	return statusMessage + "\n" + status
	// } else {
	// blank := styles.BaseStyle().Background(t.Background()).Width(m.width).Render("")
	// return blank + "\n" + status
	// }
}

func NewStatusCmp(app *app.App) StatusComponent {
	statusComponent := &statusComponent{
		app:         app,
		queue:       []status.StatusMessage{},
		messageTTL:  4 * time.Second,
		activeUntil: time.Time{},
	}

	return statusComponent
}
