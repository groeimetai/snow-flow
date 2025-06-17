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
	"github.com/sst/opencode/internal/completions"
	"github.com/sst/opencode/internal/components/chat"
	"github.com/sst/opencode/internal/components/dialog"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/components/status"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
	"github.com/sst/opencode/pkg/client"
)

type appModel struct {
	width, height        int
	status               status.StatusComponent
	app                  *app.App
	modal                layout.Modal
	editorContainer      layout.Container
	editor               chat.EditorComponent
	messagesContainer    layout.Container
	layout               layout.FlexLayout
	completionDialog     dialog.CompletionDialog
	completionManager    *completions.CompletionManager
	showCompletionDialog bool
}

type ChatKeyMap struct {
	Cancel               key.Binding
	ToggleTools          key.Binding
	ShowCompletionDialog key.Binding
}

var keyMap = ChatKeyMap{
	Cancel: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "cancel"),
	),
	ToggleTools: key.NewBinding(
		key.WithKeys("ctrl+h"),
		key.WithHelp("ctrl+h", "toggle tools"),
	),
	ShowCompletionDialog: key.NewBinding(
		key.WithKeys("/"),
		key.WithHelp("/", "Complete"),
	),
}

func (a appModel) Init() tea.Cmd {
	t := theme.CurrentTheme()
	var cmds []tea.Cmd
	cmds = append(cmds, a.app.InitializeProvider())

	cmds = append(cmds, tea.SetBackgroundColor(t.Background()))
	cmds = append(cmds, tea.RequestBackgroundColor)

	cmds = append(cmds, a.layout.Init())
	cmds = append(cmds, a.completionDialog.Init())
	cmds = append(cmds, a.status.Init())

	// Check if we should show the init dialog
	cmds = append(cmds, func() tea.Msg {
		shouldShow := a.app.Info.Git && a.app.Info.Time.Initialized == nil
		return dialog.ShowInitDialogMsg{Show: shouldShow}
	})

	return tea.Batch(cmds...)
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

			// TODO: do we need this?
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
	case chat.SendMsg:
		a.showCompletionDialog = false
		cmd := a.sendMessage(msg.Text, msg.Attachments)
		if cmd != nil {
			return a, cmd
		}
	case dialog.CompletionDialogCloseMsg:
		a.showCompletionDialog = false
	case commands.ExecuteCommandMsg:
		switch msg.Name {
		case "quit":
			return a, tea.Quit
		case "new":
			a.app.Session = &client.SessionInfo{}
			a.app.Messages = []client.MessageInfo{}
			cmds = append(cmds, util.CmdHandler(app.SessionClearedMsg{}))
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

	case client.EventSessionUpdated:
		if msg.Properties.Info.Id == a.app.Session.Id {
			a.app.Session = &msg.Properties.Info
		}

	case client.EventMessageUpdated:
		if msg.Properties.Info.Metadata.SessionID == a.app.Session.Id {
			exists := false
			for i, m := range a.app.Messages {
				if m.Id == msg.Properties.Info.Id {
					a.app.Messages[i] = msg.Properties.Info
					exists = true
				}
			}
			if !exists {
				a.app.Messages = append(a.app.Messages, msg.Properties.Info)
			}
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

		// Update status
		s, cmd := a.status.Update(msg)
		a.status = s.(status.StatusComponent)
		if cmd != nil {
			cmds = append(cmds, cmd)
		}

		// Update chat layout
		cmd = a.layout.SetSize(msg.Width, msg.Height)
		if cmd != nil {
			cmds = append(cmds, cmd)
		}

		// Update modal if present
		if a.modal != nil {
			s, cmd := a.modal.Update(msg)
			a.modal = s.(layout.Modal)
			if cmd != nil {
				cmds = append(cmds, cmd)
			}
		}

		return a, tea.Batch(cmds...)

	case app.SessionSelectedMsg:
		a.app.Session = msg
		a.app.Messages, _ = a.app.ListMessages(context.Background(), msg.Id)

	case app.ModelSelectedMsg:
		a.app.Provider = &msg.Provider
		a.app.Model = &msg.Model
		a.app.Config.Provider = msg.Provider.Id
		a.app.Config.Model = msg.Model.Id
		a.app.SaveConfig()

	case dialog.ThemeSelectedMsg:
		a.app.Config.Theme = msg.ThemeName
		a.app.SaveConfig()

		// Update layout
		u, cmd := a.layout.Update(msg)
		a.layout = u.(layout.FlexLayout)
		if cmd != nil {
			cmds = append(cmds, cmd)
		}

		// Update status
		s, cmd := a.status.Update(msg)
		cmds = append(cmds, cmd)
		a.status = s.(status.StatusComponent)

		t := theme.CurrentTheme()
		cmds = append(cmds, tea.SetBackgroundColor(t.Background()))
		return a, tea.Batch(cmds...)

	case tea.KeyMsg:
		switch msg.String() {
		// give the editor a chance to clear input
		case "ctrl+c":
			_, cmd := a.editorContainer.Update(msg)
			if cmd != nil {
				return a, cmd
			}
		}

		// Handle chat-specific keys
		switch {
		case key.Matches(msg, keyMap.ShowCompletionDialog):
			a.showCompletionDialog = true
			// Continue sending keys to layout->chat
		case key.Matches(msg, keyMap.Cancel):
			if a.app.Session.Id != "" {
				// Cancel the current session's generation process
				// This allows users to interrupt long-running operations
				a.app.Cancel(context.Background(), a.app.Session.Id)
				return a, nil
			}
		case key.Matches(msg, keyMap.ToggleTools):
			return a, util.CmdHandler(chat.ToggleToolMessagesMsg{})
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

	if a.showCompletionDialog {
		currentInput := a.editor.Value()
		provider := a.completionManager.GetProvider(currentInput)
		a.completionDialog.SetProvider(provider)

		context, contextCmd := a.completionDialog.Update(msg)
		a.completionDialog = context.(dialog.CompletionDialog)
		cmds = append(cmds, contextCmd)

		// Doesn't forward event if enter key is pressed
		if keyMsg, ok := msg.(tea.KeyMsg); ok {
			if keyMsg.String() == "enter" {
				return a, tea.Batch(cmds...)
			}
		}
	}

	// update status bar
	s, cmd := a.status.Update(msg)
	cmds = append(cmds, cmd)
	a.status = s.(status.StatusComponent)

	// update chat layout
	u, cmd := a.layout.Update(msg)
	a.layout = u.(layout.FlexLayout)
	cmds = append(cmds, cmd)
	return a, tea.Batch(cmds...)
}

func (a *appModel) sendMessage(text string, attachments []app.Attachment) tea.Cmd {
	var cmds []tea.Cmd
	cmd := a.app.SendChatMessage(context.Background(), text, attachments)
	cmds = append(cmds, cmd)
	return tea.Batch(cmds...)
}

func (a appModel) View() string {
	layoutView := a.layout.View()

	if a.showCompletionDialog {
		editorWidth, _ := a.editorContainer.GetSize()
		editorX, editorY := a.editorContainer.GetPosition()

		a.completionDialog.SetWidth(editorWidth)
		overlay := a.completionDialog.View()

		layoutView = layout.PlaceOverlay(
			editorX,
			editorY-lipgloss.Height(overlay)+2,
			overlay,
			layoutView,
		)
	}

	components := []string{
		layoutView,
		a.status.View(),
	}
	appView := lipgloss.JoinVertical(lipgloss.Top, components...)

	if a.modal != nil {
		appView = a.modal.Render(appView)
	}

	return appView
}

func NewModel(app *app.App) tea.Model {
	completionManager := completions.NewCompletionManager(app)
	initialProvider := completionManager.GetProvider("")
	completionDialog := dialog.NewCompletionDialogComponent(initialProvider)

	messagesContainer := layout.NewContainer(
		chat.NewMessagesComponent(app),
	)
	editor := chat.NewEditorComponent(app)
	editorContainer := layout.NewContainer(
		editor,
		layout.WithMaxWidth(layout.Current.Container.Width),
		layout.WithAlignCenter(),
	)

	model := &appModel{
		status:               status.NewStatusCmp(app),
		app:                  app,
		editorContainer:      editorContainer,
		editor:               editor,
		messagesContainer:    messagesContainer,
		completionDialog:     completionDialog,
		completionManager:    completionManager,
		showCompletionDialog: false,
		layout: layout.NewFlexLayout(
			layout.WithPanes(messagesContainer, editorContainer),
			layout.WithDirection(layout.FlexDirectionVertical),
			layout.WithPaneSizes(
				layout.FlexPaneSizeGrow,
				layout.FlexPaneSizeFixed(6),
			),
		),
	}

	return model
}
