package dialog

import (
	"fmt"
	"os"
	"runtime"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/viewport"
)

type versionDialog struct {
	width    int
	height   int
	modal    *modal.Modal
	app      *app.App
	viewport viewport.Model
}

func (v *versionDialog) Init() tea.Cmd {
	return v.viewport.Init()
}

func (v *versionDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		v.width = msg.Width
		v.height = msg.Height
		maxWidth := min(60, msg.Width-8)
		v.viewport = viewport.New(viewport.WithWidth(maxWidth-4), viewport.WithHeight(msg.Height-6))
	}

	v.viewport.SetContent(v.renderContent())

	var vpCmd tea.Cmd
	v.viewport, vpCmd = v.viewport.Update(msg)
	cmds = append(cmds, vpCmd)

	return v, tea.Batch(cmds...)
}

func (v *versionDialog) renderContent() string {
	t := theme.CurrentTheme()

	labelStyle := styles.NewStyle().
		Foreground(t.TextMuted()).
		Background(t.BackgroundPanel()).
		Width(16)

	valueStyle := styles.NewStyle().
		Foreground(t.Text()).
		Background(t.BackgroundPanel()).
		Bold(true)

	sectionStyle := styles.NewStyle().
		Foreground(t.Primary()).
		Background(t.BackgroundPanel()).
		Bold(true).
		MarginTop(1).
		MarginBottom(1)

	var content string

	// Version info section
	content += sectionStyle.Render("Snow-Flow TUI") + "\n\n"

	content += labelStyle.Render("Version:") + valueStyle.Render(v.app.Version) + "\n"
	content += labelStyle.Render("Go Version:") + valueStyle.Render(runtime.Version()) + "\n"
	content += labelStyle.Render("OS/Arch:") + valueStyle.Render(fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH)) + "\n"

	// Project info section
	content += "\n" + sectionStyle.Render("Project") + "\n\n"

	content += labelStyle.Render("Worktree:") + valueStyle.Render(v.app.Project.Worktree) + "\n"

	// Provider/Model info section
	content += "\n" + sectionStyle.Render("Current Model") + "\n\n"

	if v.app.Provider != nil {
		content += labelStyle.Render("Provider:") + valueStyle.Render(v.app.Provider.Name) + "\n"
	}
	if v.app.Model != nil {
		content += labelStyle.Render("Model:") + valueStyle.Render(v.app.Model.Name) + "\n"
		content += labelStyle.Render("Model ID:") + valueStyle.Render(v.app.Model.ID) + "\n"
	}

	// Agent info
	content += "\n" + sectionStyle.Render("Agent") + "\n\n"

	agent := v.app.Agent()
	content += labelStyle.Render("Name:") + valueStyle.Render(agent.Name) + "\n"
	content += labelStyle.Render("Mode:") + valueStyle.Render(string(agent.Mode)) + "\n"

	// Environment info
	content += "\n" + sectionStyle.Render("Environment") + "\n\n"

	if baseURL := v.app.BaseURL; baseURL != "" {
		content += labelStyle.Render("Server URL:") + valueStyle.Render(baseURL) + "\n"
	}
	if snowInstance := os.Getenv("SNOW_INSTANCE"); snowInstance != "" {
		content += labelStyle.Render("ServiceNow:") + valueStyle.Render(snowInstance) + "\n"
	}

	return content
}

func (v *versionDialog) View() string {
	t := theme.CurrentTheme()
	return lipgloss.NewStyle().
		Background(t.BackgroundPanel()).
		Render(v.viewport.View())
}

func (v *versionDialog) Render(background string) string {
	return v.modal.Render(v.View(), background)
}

func (v *versionDialog) Close() tea.Cmd {
	return nil
}

type VersionDialog interface {
	layout.Modal
}

func NewVersionDialog(app *app.App) VersionDialog {
	vp := viewport.New(viewport.WithHeight(20))
	return &versionDialog{
		app:      app,
		modal:    modal.New(modal.WithTitle("Version Info"), modal.WithMaxWidth(60)),
		viewport: vp,
	}
}
