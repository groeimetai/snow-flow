package core

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sst/opencode/internal/pubsub"
	"github.com/sst/opencode/internal/status"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

type StatusCmp interface {
	tea.Model
}

type statusCmp struct {
	app         *app.App
	queue       []status.StatusMessage
	width       int
	messageTTL  time.Duration
	activeUntil time.Time
}

// clearMessageCmd is a command that clears status messages after a timeout
func (m statusCmp) clearMessageCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return statusCleanupMsg{time: t}
	})
}

// statusCleanupMsg is a message that triggers cleanup of expired status messages
type statusCleanupMsg struct {
	time time.Time
}

func (m statusCmp) Init() tea.Cmd {
	return m.clearMessageCmd()
}

func (m statusCmp) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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

// getHelpWidget returns the help widget with current theme colors
func getHelpWidget() string {
	t := theme.CurrentTheme()
	helpText := "ctrl+? help"

	return styles.Padded().
		Background(t.TextMuted()).
		Foreground(t.BackgroundDarker()).
		Bold(true).
		Render(helpText)
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

func (m statusCmp) View() string {
	t := theme.CurrentTheme()
	status := getHelpWidget()

	if m.app.Session.Id != "" {
		tokens := float32(0)
		cost := float32(0)
		contextWindow := m.app.Model.ContextWindow

		for _, message := range m.app.Messages {
			if message.Metadata.Assistant != nil {
				cost += message.Metadata.Assistant.Cost
				usage := message.Metadata.Assistant.Tokens
				if usage.Output > 0 {
					tokens = (usage.Input + usage.Output + usage.Reasoning)
				}
			}
		}

		tokensInfo := styles.Padded().
			Background(t.Text()).
			Foreground(t.BackgroundSecondary()).
			Render(formatTokensAndCost(tokens, contextWindow, cost))
		status += tokensInfo
	}

	diagnostics := styles.Padded().Background(t.BackgroundDarker()).Render(m.projectDiagnostics())

	modelName := m.model()

	statusWidth := max(
		0,
		m.width-
			lipgloss.Width(status)-
			lipgloss.Width(modelName)-
			lipgloss.Width(diagnostics),
	)

	const minInlineWidth = 30

	// Display the first status message if available
	var statusMessage string
	if len(m.queue) > 0 {
		sm := m.queue[0]
		infoStyle := styles.Padded().
			Foreground(t.Background())

		switch sm.Level {
		case "info":
			infoStyle = infoStyle.Background(t.Info())
		case "warn":
			infoStyle = infoStyle.Background(t.Warning())
		case "error":
			infoStyle = infoStyle.Background(t.Error())
		case "debug":
			infoStyle = infoStyle.Background(t.TextMuted())
		}

		// Truncate message if it's longer than available width
		msg := sm.Message
		availWidth := statusWidth - 10

		// If we have enough space, show inline
		if availWidth >= minInlineWidth {
			if len(msg) > availWidth && availWidth > 0 {
				msg = msg[:availWidth] + "..."
			}
			status += infoStyle.Width(statusWidth).Render(msg)
		} else {
			// Otherwise, prepare a full-width message to show above
			if len(msg) > m.width-10 && m.width > 10 {
				msg = msg[:m.width-10] + "..."
			}
			statusMessage = infoStyle.Width(m.width).Render(msg)

			// Add empty space in the status bar
			status += styles.Padded().
				Foreground(t.Text()).
				Background(t.BackgroundSecondary()).
				Width(statusWidth).
				Render("")
		}
	} else {
		status += styles.Padded().
			Foreground(t.Text()).
			Background(t.BackgroundSecondary()).
			Width(statusWidth).
			Render("")
	}

	status += diagnostics
	status += modelName

	// If we have a separate status message, prepend it
	if statusMessage != "" {
		return statusMessage + "\n" + status
	} else {
		blank := styles.BaseStyle().Background(t.Background()).Width(m.width).Render("")
		return blank + "\n" + status
	}
}

func (m *statusCmp) projectDiagnostics() string {
	t := theme.CurrentTheme()

	// Check if any LSP server is still initializing
	initializing := false
	// for _, client := range m.app.LSPClients {
	// 	if client.GetServerState() == lsp.StateStarting {
	// 		initializing = true
	// 		break
	// 	}
	// }

	// If any server is initializing, show that status
	if initializing {
		return lipgloss.NewStyle().
			Foreground(t.Warning()).
			Render(fmt.Sprintf("%s Initializing LSP...", styles.SpinnerIcon))
	}

	// errorDiagnostics := []protocol.Diagnostic{}
	// warnDiagnostics := []protocol.Diagnostic{}
	// hintDiagnostics := []protocol.Diagnostic{}
	// infoDiagnostics := []protocol.Diagnostic{}
	// for _, client := range m.app.LSPClients {
	// 	for _, d := range client.GetDiagnostics() {
	// 		for _, diag := range d {
	// 			switch diag.Severity {
	// 			case protocol.SeverityError:
	// 				errorDiagnostics = append(errorDiagnostics, diag)
	// 			case protocol.SeverityWarning:
	// 				warnDiagnostics = append(warnDiagnostics, diag)
	// 			case protocol.SeverityHint:
	// 				hintDiagnostics = append(hintDiagnostics, diag)
	// 			case protocol.SeverityInformation:
	// 				infoDiagnostics = append(infoDiagnostics, diag)
	// 			}
	// 		}
	// 	}
	// }
	return styles.ForceReplaceBackgroundWithLipgloss(
		styles.Padded().Render("No diagnostics"),
		t.BackgroundDarker(),
	)

	// if len(errorDiagnostics) == 0 &&
	// 	len(warnDiagnostics) == 0 &&
	// 	len(infoDiagnostics) == 0 &&
	// 	len(hintDiagnostics) == 0 {
	// 	return styles.ForceReplaceBackgroundWithLipgloss(
	// 		styles.Padded().Render("No diagnostics"),
	// 		t.BackgroundDarker(),
	// 	)
	// }

	// diagnostics := []string{}
	//
	// errStr := lipgloss.NewStyle().
	// 	Background(t.BackgroundDarker()).
	// 	Foreground(t.Error()).
	// 	Render(fmt.Sprintf("%s %d", styles.ErrorIcon, len(errorDiagnostics)))
	// diagnostics = append(diagnostics, errStr)
	//
	// warnStr := lipgloss.NewStyle().
	// 	Background(t.BackgroundDarker()).
	// 	Foreground(t.Warning()).
	// 	Render(fmt.Sprintf("%s %d", styles.WarningIcon, len(warnDiagnostics)))
	// diagnostics = append(diagnostics, warnStr)
	//
	// infoStr := lipgloss.NewStyle().
	// 	Background(t.BackgroundDarker()).
	// 	Foreground(t.Info()).
	// 	Render(fmt.Sprintf("%s %d", styles.InfoIcon, len(infoDiagnostics)))
	// diagnostics = append(diagnostics, infoStr)
	//
	// hintStr := lipgloss.NewStyle().
	// 	Background(t.BackgroundDarker()).
	// 	Foreground(t.Text()).
	// 	Render(fmt.Sprintf("%s %d", styles.HintIcon, len(hintDiagnostics)))
	// diagnostics = append(diagnostics, hintStr)
	//
	// return styles.ForceReplaceBackgroundWithLipgloss(
	// 	styles.Padded().Render(strings.Join(diagnostics, " ")),
	// 	t.BackgroundDarker(),
	// )
}

func (m statusCmp) model() string {
	t := theme.CurrentTheme()
	model := "None"
	if m.app.Model != nil {
		model = *m.app.Model.Name
	}

	return styles.Padded().
		Background(t.Secondary()).
		Foreground(t.Background()).
		Render(model)
}

func NewStatusCmp(app *app.App) StatusCmp {
	statusComponent := &statusCmp{
		app:         app,
		queue:       []status.StatusMessage{},
		messageTTL:  4 * time.Second,
		activeUntil: time.Time{},
	}

	return statusComponent
}
