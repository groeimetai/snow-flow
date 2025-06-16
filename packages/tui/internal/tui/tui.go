package tui

import (
	"context"
	"log/slog"

	"github.com/charmbracelet/bubbles/v2/cursor"
	"github.com/charmbracelet/bubbles/v2/key"
	"github.com/charmbracelet/bubbles/v2/spinner"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"

	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/commands"
	"github.com/sst/opencode/internal/components/core"
	"github.com/sst/opencode/internal/components/dialog"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/page"
	"github.com/sst/opencode/internal/state"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
	"github.com/sst/opencode/pkg/client"
)

type appModel struct {
	width, height int
	currentPage   page.PageID
	previousPage  page.PageID
	pages         map[page.PageID]layout.ModelWithView
	loadedPages   map[page.PageID]bool
	status        core.StatusComponent
	app           *app.App
	modal         layout.Modal
}

func (a appModel) Init() tea.Cmd {
	t := theme.CurrentTheme()
	var cmds []tea.Cmd
	cmds = append(cmds, a.app.InitializeProvider())

	cmds = append(cmds, tea.SetBackgroundColor(t.Background()))
	cmds = append(cmds, tea.RequestBackgroundColor)

	cmd := a.pages[a.currentPage].Init()
	a.loadedPages[a.currentPage] = true
	cmds = append(cmds, cmd)

	cmd = a.status.Init()
	cmds = append(cmds, cmd)

	// Check if we should show the init dialog
	cmds = append(cmds, func() tea.Msg {
		shouldShow := a.app.Info.Git && a.app.Info.Time.Initialized == nil
		return dialog.ShowInitDialogMsg{Show: shouldShow}
	})

	return tea.Batch(cmds...)
}

func (a appModel) updateAllPages(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	for id := range a.pages {
		updated, cmd := a.pages[id].Update(msg)
		a.pages[id] = updated.(layout.ModelWithView)
		cmds = append(cmds, cmd)
	}

	s, cmd := a.status.Update(msg)
	cmds = append(cmds, cmd)
	a.status = s.(core.StatusComponent)

	return a, tea.Batch(cmds...)
}

func (a appModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	if a.modal != nil {
		bypassModal := false

		if _, ok := msg.(modal.CloseModalMsg); ok {
			a.modal = nil
			return a, nil
		}

		if msg, ok := msg.(tea.KeyMsg); ok {
			switch msg.String() {
			case "esc":
				a.modal = nil
				return a, nil
			case "ctrl+c":
				return a, tea.Quit
			}

			// don't send commands to the modal
			for _, cmdDef := range a.app.Commands {
				if key.Matches(msg, cmdDef.KeyBinding) {
					bypassModal = true
					break
				}
			}
		}

		// thanks i hate this
		switch msg.(type) {
		case tea.WindowSizeMsg:
			bypassModal = true
		case client.EventSessionUpdated:
			bypassModal = true
		case client.EventMessageUpdated:
			bypassModal = true
		case cursor.BlinkMsg:
			bypassModal = true
		case spinner.TickMsg:
			bypassModal = true
		}

		if !bypassModal {
			updatedModal, cmd := a.modal.Update(msg)
			a.modal = updatedModal.(layout.Modal)
			return a, cmd
		}
	}

	switch msg := msg.(type) {
	case commands.ExecuteCommandMsg:
		switch msg.Name {
		case "quit":
			return a, tea.Quit
		case "new":
			a.app.Session = &client.SessionInfo{}
			a.app.Messages = []client.MessageInfo{}
			cmds = append(cmds, util.CmdHandler(state.SessionClearedMsg{}))
		case "sessions":
			sessionDialog := dialog.NewSessionDialog(a.app)
			a.modal = sessionDialog
		case "model":
			modelDialog := dialog.NewModelDialog(a.app)
			a.modal = modelDialog
		case "theme":
			themeDialog := dialog.NewThemeDialog()
			a.modal = themeDialog
		case "share":
			a.app.Client.PostSessionShareWithResponse(context.Background(), client.PostSessionShareJSONRequestBody{
				SessionID: a.app.Session.Id,
			})
		case "init":
			return a, a.app.InitializeProject(context.Background())
		// case "compact":
		// 	return a, a.app.CompactSession(context.Background())
		case "help":
			var helpBindings []key.Binding
			for _, cmd := range a.app.Commands {
				// Create a new binding for help display
				helpBindings = append(helpBindings, key.NewBinding(
					key.WithKeys(cmd.KeyBinding.Keys()...),
					key.WithHelp("/"+cmd.Name, cmd.Description),
				))
			}
			helpDialog := dialog.NewHelpDialog(helpBindings...)
			a.modal = helpDialog
		}
		slog.Info("Execute command", "cmds", cmds)
		return a, tea.Batch(cmds...)

	case tea.BackgroundColorMsg:
		styles.Terminal = &styles.TerminalInfo{
			BackgroundIsDark: msg.IsDark(),
		}

	case cursor.BlinkMsg:
		return a.updateAllPages(msg)

	case spinner.TickMsg:
		return a.updateAllPages(msg)

	case client.EventSessionUpdated:
		if msg.Properties.Info.Id == a.app.Session.Id {
			a.app.Session = &msg.Properties.Info
			return a.updateAllPages(state.StateUpdatedMsg{State: nil})
		}

	case client.EventMessageUpdated:
		if msg.Properties.Info.Metadata.SessionID == a.app.Session.Id {
			for i, m := range a.app.Messages {
				if m.Id == msg.Properties.Info.Id {
					a.app.Messages[i] = msg.Properties.Info
					return a.updateAllPages(state.StateUpdatedMsg{State: nil})
				}
			}
			a.app.Messages = append(a.app.Messages, msg.Properties.Info)
			return a.updateAllPages(state.StateUpdatedMsg{State: nil})
		}

	case tea.WindowSizeMsg:
		msg.Height -= 2 // Make space for the status bar
		a.width, a.height = msg.Width, msg.Height

		// TODO: move away from global state
		layout.Current = &layout.LayoutInfo{
			Viewport: layout.Dimensions{
				Width:  a.width,
				Height: a.height,
			},
			Container: layout.Dimensions{
				Width: min(a.width, 80),
			},
		}

		s, cmd := a.status.Update(msg)
		a.status = s.(core.StatusComponent)
		if cmd != nil {
			cmds = append(cmds, cmd)
		}

		updated, cmd := a.pages[a.currentPage].Update(msg)
		a.pages[a.currentPage] = updated.(layout.ModelWithView)
		if cmd != nil {
			cmds = append(cmds, cmd)
		}

		if a.modal != nil {
			s, cmd := a.modal.Update(msg)
			a.modal = s.(layout.Modal)
			if cmd != nil {
				cmds = append(cmds, cmd)
			}
		}

		return a, tea.Batch(cmds...)

	case page.PageChangeMsg:
		return a, a.moveToPage(msg.ID)

	case state.SessionSelectedMsg:
		a.app.Session = msg
		a.app.Messages, _ = a.app.ListMessages(context.Background(), msg.Id)
		return a.updateAllPages(msg)

	case state.ModelSelectedMsg:
		a.app.Provider = &msg.Provider
		a.app.Model = &msg.Model
		a.app.Config.Provider = msg.Provider.Id
		a.app.Config.Model = msg.Model.Id
		a.app.SaveConfig()
		return a.updateAllPages(msg)

	case dialog.ThemeChangedMsg:
		a.app.Config.Theme = msg.ThemeName
		a.app.SaveConfig()

		updated, cmd := a.pages[a.currentPage].Update(msg)
		a.pages[a.currentPage] = updated.(layout.ModelWithView)
		if cmd != nil {
			cmds = append(cmds, cmd)
		}

		s, cmd := a.status.Update(msg)
		cmds = append(cmds, cmd)
		a.status = s.(core.StatusComponent)

		t := theme.CurrentTheme()
		cmds = append(cmds, tea.SetBackgroundColor(t.Background()))
		return a, tea.Batch(cmds...)

	case tea.KeyMsg:
		switch msg.String() {
		// give the editor a chance to clear input
		case "ctrl+c":
			updated, cmd := a.pages[a.currentPage].Update(msg)
			a.pages[a.currentPage] = updated.(layout.ModelWithView)
			if cmd != nil {
				return a, cmd
			}
		}

		// First, check for modal triggers from the command registry
		if a.modal == nil {
			for _, cmdDef := range a.app.Commands {
				if key.Matches(msg, cmdDef.KeyBinding) {
					// If a key matches, send an ExecuteCommandMsg to self.
					// This unifies keybinding and slash command handling.
					return a, util.CmdHandler(commands.ExecuteCommandMsg{Name: cmdDef.Name})
				}
			}
		}
	}

	// update status bar
	s, cmd := a.status.Update(msg)
	cmds = append(cmds, cmd)
	a.status = s.(core.StatusComponent)

	// update current page
	updated, cmd := a.pages[a.currentPage].Update(msg)
	a.pages[a.currentPage] = updated.(layout.ModelWithView)
	cmds = append(cmds, cmd)
	return a, tea.Batch(cmds...)
}

func (a *appModel) moveToPage(pageID page.PageID) tea.Cmd {
	var cmds []tea.Cmd
	if _, ok := a.loadedPages[pageID]; !ok {
		cmd := a.pages[pageID].Init()
		cmds = append(cmds, cmd)
		a.loadedPages[pageID] = true
	}
	a.previousPage = a.currentPage
	a.currentPage = pageID
	if sizable, ok := a.pages[a.currentPage].(layout.Sizeable); ok {
		cmd := sizable.SetSize(a.width, a.height)
		cmds = append(cmds, cmd)
	}

	return tea.Batch(cmds...)
}

func (a appModel) View() string {
	components := []string{
		a.pages[a.currentPage].View(),
	}
	components = append(components, a.status.View())
	appView := lipgloss.JoinVertical(lipgloss.Top, components...)

	if a.modal != nil {
		appView = a.modal.Render(appView)
	}

	return appView
}

func NewModel(app *app.App) tea.Model {
	startPage := page.ChatPage
	model := &appModel{
		currentPage: startPage,
		loadedPages: make(map[page.PageID]bool),
		status:      core.NewStatusCmp(app),
		app:         app,
		pages: map[page.PageID]layout.ModelWithView{
			page.ChatPage: page.NewChatPage(app),
		},
	}

	return model
}
