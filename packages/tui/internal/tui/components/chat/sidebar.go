package chat

import (
	"fmt"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/tui/app"
	"github.com/sst/opencode/internal/tui/state"
	"github.com/sst/opencode/internal/tui/styles"
	"github.com/sst/opencode/internal/tui/theme"
)

type sidebarCmp struct {
	app           *app.App
	width, height int
	modFiles      map[string]struct {
		additions int
		removals  int
	}
}

func (m *sidebarCmp) Init() tea.Cmd {
	// TODO: History service not implemented in API yet
	// Initialize the modified files map
	m.modFiles = make(map[string]struct {
		additions int
		removals  int
	})
	return nil
}

func (m *sidebarCmp) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg.(type) {
	case state.SessionSelectedMsg:
		// TODO: History service not implemented in API yet
		// ctx := context.Background()
		// m.loadModifiedFiles(ctx)
		// case pubsub.Event[history.File]:
		// TODO: History service not implemented in API yet
		// if msg.Payload.SessionID == m.app.CurrentSession.ID {
		// 	// Process the individual file change instead of reloading all files
		// 	ctx := context.Background()
		// 	m.processFileChanges(ctx, msg.Payload)
		// }
	}
	return m, nil
}

func (m *sidebarCmp) View() string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle()
	shareUrl := ""
	if m.app.Session.Share != nil {
		shareUrl = baseStyle.Foreground(t.TextMuted()).Render(m.app.Session.Share.Url)
	}

	// qrcode := ""
	// if m.app.Session.ShareID != nil {
	// 	url := "https://dev.opencode.ai/share?id="
	// 	qrcode, _, _ = qr.Generate(url + m.app.Session.Id)
	// }

	return baseStyle.
		Width(m.width).
		PaddingLeft(4).
		PaddingRight(1).
		Render(
			lipgloss.JoinVertical(
				lipgloss.Top,
				header(m.app, m.width),
				" ",
				m.sessionSection(),
				shareUrl,
			),
		)
}

func (m *sidebarCmp) sessionSection() string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle()

	sessionKey := baseStyle.
		Foreground(t.Primary()).
		Bold(true).
		Render("Session")

	sessionValue := baseStyle.
		Foreground(t.Text()).
		Render(fmt.Sprintf(": %s", m.app.Session.Title))

	return sessionKey + sessionValue
}

func (m *sidebarCmp) modifiedFile(filePath string, additions, removals int) string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle()

	stats := ""
	if additions > 0 && removals > 0 {
		additionsStr := baseStyle.
			Foreground(t.Success()).
			PaddingLeft(1).
			Render(fmt.Sprintf("+%d", additions))

		removalsStr := baseStyle.
			Foreground(t.Error()).
			PaddingLeft(1).
			Render(fmt.Sprintf("-%d", removals))

		content := lipgloss.JoinHorizontal(lipgloss.Left, additionsStr, removalsStr)
		stats = baseStyle.Width(lipgloss.Width(content)).Render(content)
	} else if additions > 0 {
		additionsStr := fmt.Sprintf(" %s", baseStyle.
			PaddingLeft(1).
			Foreground(t.Success()).
			Render(fmt.Sprintf("+%d", additions)))
		stats = baseStyle.Width(lipgloss.Width(additionsStr)).Render(additionsStr)
	} else if removals > 0 {
		removalsStr := fmt.Sprintf(" %s", baseStyle.
			PaddingLeft(1).
			Foreground(t.Error()).
			Render(fmt.Sprintf("-%d", removals)))
		stats = baseStyle.Width(lipgloss.Width(removalsStr)).Render(removalsStr)
	}

	filePathStr := baseStyle.Render(filePath)

	return baseStyle.
		Width(m.width).
		Render(
			lipgloss.JoinHorizontal(
				lipgloss.Left,
				filePathStr,
				stats,
			),
		)
}

func (m *sidebarCmp) modifiedFiles() string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle()

	modifiedFiles := baseStyle.
		Width(m.width).
		Foreground(t.Primary()).
		Bold(true).
		Render("Modified Files:")

	// If no modified files, show a placeholder message
	if m.modFiles == nil || len(m.modFiles) == 0 {
		message := "No modified files"
		remainingWidth := m.width - lipgloss.Width(message)
		if remainingWidth > 0 {
			message += strings.Repeat(" ", remainingWidth)
		}
		return baseStyle.
			Width(m.width).
			Render(
				lipgloss.JoinVertical(
					lipgloss.Top,
					modifiedFiles,
					baseStyle.Foreground(t.TextMuted()).Render(message),
				),
			)
	}

	// Sort file paths alphabetically for consistent ordering
	var paths []string
	for path := range m.modFiles {
		paths = append(paths, path)
	}
	sort.Strings(paths)

	// Create views for each file in sorted order
	var fileViews []string
	for _, path := range paths {
		stats := m.modFiles[path]
		fileViews = append(fileViews, m.modifiedFile(path, stats.additions, stats.removals))
	}

	return baseStyle.
		Width(m.width).
		Render(
			lipgloss.JoinVertical(
				lipgloss.Top,
				modifiedFiles,
				lipgloss.JoinVertical(
					lipgloss.Left,
					fileViews...,
				),
			),
		)
}

func (m *sidebarCmp) SetSize(width, height int) tea.Cmd {
	m.width = width
	m.height = height
	return nil
}

func (m *sidebarCmp) GetSize() (int, int) {
	return m.width, m.height
}

func NewSidebarCmp(app *app.App) tea.Model {
	return &sidebarCmp{
		app: app,
	}
}

// Helper function to get the display path for a file
func getDisplayPath(path string) string {
	workingDir := config.WorkingDirectory()
	displayPath := strings.TrimPrefix(path, workingDir)
	return strings.TrimPrefix(displayPath, "/")
}
