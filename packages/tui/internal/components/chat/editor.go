package chat

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"

	"github.com/charmbracelet/bubbles/v2/key"
	"github.com/charmbracelet/bubbles/v2/spinner"
	"github.com/charmbracelet/bubbles/v2/textarea"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/commands"
	"github.com/sst/opencode/internal/components/dialog"
	"github.com/sst/opencode/internal/image"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/status"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
)

type editorComponent struct {
	width          int
	height         int
	app            *app.App
	textarea       textarea.Model
	attachments    []app.Attachment
	deleteMode     bool
	history        []string
	historyIndex   int
	currentMessage string
	spinner        spinner.Model
}

type EditorKeyMaps struct {
	Send        key.Binding
	OpenEditor  key.Binding
	Paste       key.Binding
	HistoryUp   key.Binding
	HistoryDown key.Binding
}

type DeleteAttachmentKeyMaps struct {
	AttachmentDeleteMode key.Binding
	Escape               key.Binding
	DeleteAllAttachments key.Binding
}

var editorMaps = EditorKeyMaps{
	Send: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "send message"),
	),
	OpenEditor: key.NewBinding(
		key.WithKeys("f12"),
		key.WithHelp("f12", "open editor"),
	),
	Paste: key.NewBinding(
		key.WithKeys("ctrl+v"),
		key.WithHelp("ctrl+v", "paste content"),
	),
	HistoryUp: key.NewBinding(
		key.WithKeys("up"),
		key.WithHelp("up", "previous message"),
	),
	HistoryDown: key.NewBinding(
		key.WithKeys("down"),
		key.WithHelp("down", "next message"),
	),
}

var DeleteKeyMaps = DeleteAttachmentKeyMaps{
	AttachmentDeleteMode: key.NewBinding(
		key.WithKeys("ctrl+r"),
		key.WithHelp("ctrl+r+{i}", "delete attachment at index i"),
	),
	Escape: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "cancel delete mode"),
	),
	DeleteAllAttachments: key.NewBinding(
		key.WithKeys("r"),
		key.WithHelp("ctrl+r+r", "delete all attachments"),
	),
}

const (
	maxAttachments = 5
)

func (m *editorComponent) Init() tea.Cmd {
	return tea.Batch(textarea.Blink, m.spinner.Tick, tea.EnableReportFocus)
}

func (m *editorComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case dialog.ThemeChangedMsg:
		m.textarea = createTextArea(&m.textarea)
	case dialog.CompletionSelectedMsg:
		if msg.IsCommand {
			// Execute the command directly
			commandName := strings.TrimPrefix(msg.CompletionValue, "/")
			m.textarea.Reset()
			return m, util.CmdHandler(commands.ExecuteCommandMsg{Name: commandName})
		} else {
			// For files, replace the text in the editor
			existingValue := m.textarea.Value()
			modifiedValue := strings.Replace(existingValue, msg.SearchString, msg.CompletionValue, 1)
			m.textarea.SetValue(modifiedValue)
			return m, nil
		}
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			if m.textarea.Value() != "" {
				m.textarea.Reset()
				return m, func() tea.Msg {
					return nil
				}
			}
		case "shift+enter":
			value := m.textarea.Value()
			m.textarea.SetValue(value + "\n")
			return m, nil
		}

		if key.Matches(msg, DeleteKeyMaps.AttachmentDeleteMode) {
			m.deleteMode = true
			return m, nil
		}
		if key.Matches(msg, DeleteKeyMaps.DeleteAllAttachments) && m.deleteMode {
			m.deleteMode = false
			m.attachments = nil
			return m, nil
		}
		// if m.deleteMode && len(msg.Runes) > 0 && unicode.IsDigit(msg.Runes[0]) {
		// 	num := int(msg.Runes[0] - '0')
		// 	m.deleteMode = false
		// 	if num < 10 && len(m.attachments) > num {
		// 		if num == 0 {
		// 			m.attachments = m.attachments[num+1:]
		// 		} else {
		// 			m.attachments = slices.Delete(m.attachments, num, num+1)
		// 		}
		// 		return m, nil
		// 	}
		// }
		if key.Matches(msg, messageKeys.PageUp) || key.Matches(msg, messageKeys.PageDown) ||
			key.Matches(msg, messageKeys.HalfPageUp) || key.Matches(msg, messageKeys.HalfPageDown) {
			return m, nil
		}
		if key.Matches(msg, editorMaps.OpenEditor) {
			if m.app.IsBusy() {
				status.Warn("Agent is working, please wait...")
				return m, nil
			}
			value := m.textarea.Value()
			m.textarea.Reset()
			return m, m.openEditor(value)
		}
		if key.Matches(msg, DeleteKeyMaps.Escape) {
			m.deleteMode = false
			return m, nil
		}

		if key.Matches(msg, editorMaps.Paste) {
			imageBytes, text, err := image.GetImageFromClipboard()
			if err != nil {
				slog.Error(err.Error())
				return m, cmd
			}
			if len(imageBytes) != 0 {
				attachmentName := fmt.Sprintf("clipboard-image-%d", len(m.attachments))
				attachment := app.Attachment{FilePath: attachmentName, FileName: attachmentName, Content: imageBytes, MimeType: "image/png"}
				m.attachments = append(m.attachments, attachment)
			} else {
				m.textarea.SetValue(m.textarea.Value() + text)
			}
			return m, cmd
		}

		// Handle history navigation with up/down arrow keys
		// Only handle history navigation if the filepicker is not open and completion dialog is not open
		if m.textarea.Focused() && key.Matches(msg, editorMaps.HistoryUp) {
			// TODO: fix this
			//  && !m.app.IsFilepickerOpen() && !m.app.IsCompletionDialogOpen() {
			// Get the current line number
			currentLine := m.textarea.Line()

			// Only navigate history if we're at the first line
			if currentLine == 0 && len(m.history) > 0 {
				// Save current message if we're just starting to navigate
				if m.historyIndex == len(m.history) {
					m.currentMessage = m.textarea.Value()
				}

				// Go to previous message in history
				if m.historyIndex > 0 {
					m.historyIndex--
					m.textarea.SetValue(m.history[m.historyIndex])
				}
				return m, nil
			}
		}

		if m.textarea.Focused() && key.Matches(msg, editorMaps.HistoryDown) {
			// TODO: fix this
			// && !m.app.IsFilepickerOpen() && !m.app.IsCompletionDialogOpen() {
			// Get the current line number and total lines
			currentLine := m.textarea.Line()
			value := m.textarea.Value()
			lines := strings.Split(value, "\n")
			totalLines := len(lines)

			// Only navigate history if we're at the last line
			if currentLine == totalLines-1 {
				if m.historyIndex < len(m.history)-1 {
					// Go to next message in history
					m.historyIndex++
					m.textarea.SetValue(m.history[m.historyIndex])
				} else if m.historyIndex == len(m.history)-1 {
					// Return to the current message being composed
					m.historyIndex = len(m.history)
					m.textarea.SetValue(m.currentMessage)
				}
				return m, nil
			}
		}

		// Handle Enter key
		if m.textarea.Focused() && key.Matches(msg, editorMaps.Send) {
			value := m.textarea.Value()
			if len(value) > 0 && value[len(value)-1] == '\\' {
				// If the last character is a backslash, remove it and add a newline
				m.textarea.SetValue(value[:len(value)-1] + "\n")
				return m, nil
			} else {
				// Otherwise, send the message
				return m, m.send()
			}
		}
	}

	m.spinner, cmd = m.spinner.Update(msg)
	cmds = append(cmds, cmd)

	m.textarea, cmd = m.textarea.Update(msg)
	cmds = append(cmds, cmd)

	return m, tea.Batch(cmds...)
}

func (m *editorComponent) View() string {
	t := theme.CurrentTheme()
	base := styles.BaseStyle().Render
	muted := styles.Muted().Render
	promptStyle := lipgloss.NewStyle().
		Padding(0, 0, 0, 1).
		Bold(true).
		Foreground(t.Primary())
	prompt := promptStyle.Render(">")

	textarea := lipgloss.JoinHorizontal(
		lipgloss.Top,
		prompt,
		m.textarea.View(),
	)
	textarea = styles.BaseStyle().
		Width(m.width).
		PaddingTop(1).
		PaddingBottom(1).
		Background(t.BackgroundElement()).
		Border(lipgloss.ThickBorder(), false, true).
		BorderForeground(t.BackgroundSubtle()).
		BorderBackground(t.Background()).
		Render(textarea)

	hint := base("enter") + muted(" send   ") + base("shift") + muted("+") + base("enter") + muted(" newline")
	if m.app.IsBusy() {
		hint = muted("working") + m.spinner.View() + muted("  ") + base("esc") + muted(" interrupt")
	}

	model := ""
	if m.app.Model != nil {
		model = base(m.app.Model.Name) + muted(" • /model")
	}

	space := m.width - 2 - lipgloss.Width(model) - lipgloss.Width(hint)
	spacer := lipgloss.NewStyle().Width(space).Render("")

	info := lipgloss.JoinHorizontal(lipgloss.Left, hint, spacer, model)
	info = styles.Padded().Render(info)

	content := lipgloss.JoinVertical(
		lipgloss.Top,
		// m.attachmentsContent(),
		"",
		textarea,
		info,
	)

	return content
}

func (m *editorComponent) SetSize(width, height int) tea.Cmd {
	m.width = width
	m.height = height
	m.textarea.SetWidth(width - 5)   // account for the prompt and padding right
	m.textarea.SetHeight(height - 4) // account for info underneath
	return nil
}

func (m *editorComponent) GetSize() (int, int) {
	return m.width, m.height
}

func (m *editorComponent) openEditor(value string) tea.Cmd {
	editor := os.Getenv("EDITOR")
	if editor == "" {
		editor = "nvim"
	}

	tmpfile, err := os.CreateTemp("", "msg_*.md")
	tmpfile.WriteString(value)
	if err != nil {
		status.Error(err.Error())
		return nil
	}
	tmpfile.Close()
	c := exec.Command(editor, tmpfile.Name()) //nolint:gosec
	c.Stdin = os.Stdin
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	return tea.ExecProcess(c, func(err error) tea.Msg {
		if err != nil {
			status.Error(err.Error())
			return nil
		}
		content, err := os.ReadFile(tmpfile.Name())
		if err != nil {
			status.Error(err.Error())
			return nil
		}
		if len(content) == 0 {
			status.Warn("Message is empty")
			return nil
		}
		os.Remove(tmpfile.Name())
		attachments := m.attachments
		m.attachments = nil
		return SendMsg{
			Text:        string(content),
			Attachments: attachments,
		}
	})
}

func (m *editorComponent) send() tea.Cmd {
	value := strings.TrimSpace(m.textarea.Value())
	m.textarea.Reset()
	attachments := m.attachments

	// Save to history if not empty and not a duplicate of the last entry
	if value != "" {
		if len(m.history) == 0 || m.history[len(m.history)-1] != value {
			m.history = append(m.history, value)
		}
		m.historyIndex = len(m.history)
		m.currentMessage = ""
	}

	m.attachments = nil
	if value == "" {
		return nil
	}

	// Check for slash command
	// if strings.HasPrefix(value, "/") {
	// 	commandName := strings.TrimPrefix(value, "/")
	// 	if _, ok := m.app.Commands[commandName]; ok {
	// 		return util.CmdHandler(commands.ExecuteCommandMsg{Name: commandName})
	// 	}
	// }
	slog.Info("Send message", "value", value)

	return tea.Batch(
		util.CmdHandler(SendMsg{
			Text:        value,
			Attachments: attachments,
		}),
	)
}

func (m *editorComponent) attachmentsContent() string {
	if len(m.attachments) == 0 {
		return ""
	}

	t := theme.CurrentTheme()
	var styledAttachments []string
	attachmentStyles := styles.BaseStyle().
		MarginLeft(1).
		Background(t.TextMuted()).
		Foreground(t.Text())
	for i, attachment := range m.attachments {
		var filename string
		if len(attachment.FileName) > 10 {
			filename = fmt.Sprintf(" %s %s...", styles.DocumentIcon, attachment.FileName[0:7])
		} else {
			filename = fmt.Sprintf(" %s %s", styles.DocumentIcon, attachment.FileName)
		}
		if m.deleteMode {
			filename = fmt.Sprintf("%d%s", i, filename)
		}
		styledAttachments = append(styledAttachments, attachmentStyles.Render(filename))
	}
	content := lipgloss.JoinHorizontal(lipgloss.Left, styledAttachments...)
	return content
}

func createTextArea(existing *textarea.Model) textarea.Model {
	t := theme.CurrentTheme()
	bgColor := t.BackgroundElement()
	textColor := t.Text()
	textMutedColor := t.TextMuted()

	ta := textarea.New()

	ta.Styles.Blurred.Base = lipgloss.NewStyle().Background(bgColor).Foreground(textColor)
	ta.Styles.Blurred.CursorLine = lipgloss.NewStyle().Background(bgColor)
	ta.Styles.Blurred.Placeholder = lipgloss.NewStyle().Background(bgColor).Foreground(textMutedColor)
	ta.Styles.Blurred.Text = lipgloss.NewStyle().Background(bgColor).Foreground(textColor)
	ta.Styles.Focused.Base = lipgloss.NewStyle().Background(bgColor).Foreground(textColor)
	ta.Styles.Focused.CursorLine = lipgloss.NewStyle().Background(bgColor)
	ta.Styles.Focused.Placeholder = lipgloss.NewStyle().Background(bgColor).Foreground(textMutedColor)
	ta.Styles.Focused.Text = lipgloss.NewStyle().Background(bgColor).Foreground(textColor)
	ta.Styles.Cursor.Color = t.Primary()

	ta.Prompt = " "
	ta.ShowLineNumbers = false
	ta.CharLimit = -1

	if existing != nil {
		ta.SetValue(existing.Value())
		ta.SetWidth(existing.Width())
		ta.SetHeight(existing.Height())
	}

	ta.Focus()
	return ta
}

func (m *editorComponent) GetValue() string {
	return m.textarea.Value()
}

func NewEditorComponent(app *app.App) layout.ModelWithView {
	s := spinner.New(spinner.WithSpinner(spinner.Ellipsis), spinner.WithStyle(styles.Muted().Width(3)))
	ta := createTextArea(nil)

	return &editorComponent{
		app:            app,
		textarea:       ta,
		history:        []string{},
		historyIndex:   0,
		currentMessage: "",
		spinner:        s,
	}
}
