package page

import (
	"context"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/completions"
	"github.com/sst/opencode/internal/components/chat"
	"github.com/sst/opencode/internal/components/dialog"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/util"
)

var ChatPage PageID = "chat"

type chatPage struct {
	app                  *app.App
	editor               layout.Container
	messages             layout.Container
	layout               layout.FlexLayout
	completionDialog     dialog.CompletionDialog
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

func (p *chatPage) Init() tea.Cmd {
	cmds := []tea.Cmd{
		p.layout.Init(),
	}
	cmds = append(cmds, p.completionDialog.Init())
	return tea.Batch(cmds...)
}

func (p *chatPage) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		cmd := p.layout.SetSize(msg.Width, msg.Height)
		cmds = append(cmds, cmd)
	case chat.SendMsg:
		p.showCompletionDialog = false
		cmd := p.sendMessage(msg.Text, msg.Attachments)
		if cmd != nil {
			return p, cmd
		}
	case dialog.CompletionDialogCloseMsg:
		p.showCompletionDialog = false
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			_, cmd := p.editor.Update(msg)
			if cmd != nil {
				return p, cmd
			}
		}

		switch {
		case key.Matches(msg, keyMap.ShowCompletionDialog):
			p.showCompletionDialog = true
			// Continue sending keys to layout->chat
		case key.Matches(msg, keyMap.Cancel):
			if p.app.Session.Id != "" {
				// Cancel the current session's generation process
				// This allows users to interrupt long-running operations
				p.app.Cancel(context.Background(), p.app.Session.Id)
				return p, nil
			}
		case key.Matches(msg, keyMap.ToggleTools):
			return p, util.CmdHandler(chat.ToggleToolMessagesMsg{})
		}
	}

	if p.showCompletionDialog {
		context, contextCmd := p.completionDialog.Update(msg)
		p.completionDialog = context.(dialog.CompletionDialog)
		cmds = append(cmds, contextCmd)

		// Doesn't forward event if enter key is pressed
		if keyMsg, ok := msg.(tea.KeyMsg); ok {
			if keyMsg.String() == "enter" && !p.completionDialog.IsEmpty() {
				return p, tea.Batch(cmds...)
			}
		}
	}

	u, cmd := p.layout.Update(msg)
	cmds = append(cmds, cmd)
	p.layout = u.(layout.FlexLayout)
	return p, tea.Batch(cmds...)
}

func (p *chatPage) sendMessage(text string, attachments []app.Attachment) tea.Cmd {
	var cmds []tea.Cmd
	cmd := p.app.SendChatMessage(context.Background(), text, attachments)
	cmds = append(cmds, cmd)
	return tea.Batch(cmds...)
}

func (p *chatPage) SetSize(width, height int) tea.Cmd {
	return p.layout.SetSize(width, height)
}

func (p *chatPage) GetSize() (int, int) {
	return p.layout.GetSize()
}

func (p *chatPage) View() string {
	layoutView := p.layout.View()

	if p.showCompletionDialog {
		editorWidth, _ := p.editor.GetSize()
		editorX, editorY := p.editor.GetPosition()

		p.completionDialog.SetWidth(editorWidth)
		overlay := p.completionDialog.View()

		layoutView = layout.PlaceOverlay(
			editorX,
			editorY-lipgloss.Height(overlay)+2,
			overlay,
			layoutView,
		)
	}

	return layoutView
}

func NewChatPage(app *app.App) layout.ModelWithView {
	cg := completions.NewFileAndFolderContextGroup()
	completionDialog := dialog.NewCompletionDialogComponent(cg)
	messagesContainer := layout.NewContainer(
		chat.NewMessagesComponent(app),
	)
	editorContainer := layout.NewContainer(
		chat.NewEditorComponent(app),
		layout.WithMaxWidth(layout.Current.Container.Width),
		layout.WithAlignCenter(),
	)
	return &chatPage{
		app:              app,
		editor:           editorContainer,
		messages:         messagesContainer,
		completionDialog: completionDialog,
		layout: layout.NewFlexLayout(
			layout.WithPanes(messagesContainer, editorContainer),
			layout.WithDirection(layout.FlexDirectionVertical),
			layout.WithPaneSizes(
				layout.FlexPaneSizeGrow,
				layout.FlexPaneSizeFixed(6),
			),
		),
	}
}
