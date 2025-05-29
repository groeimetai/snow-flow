package chat

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"slices"
	"strings"
	"unicode"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/textarea"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sst/opencode/internal/message"
	"github.com/sst/opencode/internal/status"
	"github.com/sst/opencode/internal/tui/app"
	"github.com/sst/opencode/internal/tui/components/dialog"
	"github.com/sst/opencode/internal/tui/image"
	"github.com/sst/opencode/internal/tui/layout"
	"github.com/sst/opencode/internal/tui/styles"
	"github.com/sst/opencode/internal/tui/theme"
	"github.com/sst/opencode/internal/tui/util"
)

type editorCmp struct {
	width          int
	height         int
	app            *app.App
	textarea       textarea.Model
	attachments    []message.Attachment
	deleteMode     bool
	history        []string
	historyIndex   int
	currentMessage string
}

type EditorKeyMaps struct {
	Send        key.Binding
	OpenEditor  key.Binding
	Paste       key.Binding
	HistoryUp   key.Binding
	HistoryDown key.Binding
}

type bluredEditorKeyMaps struct {
	Send       key.Binding
	Focus      key.Binding
	OpenEditor key.Binding
}
type DeleteAttachmentKeyMaps struct {
	AttachmentDeleteMode key.Binding
	Escape               key.Binding
	DeleteAllAttachments key.Binding
}

var editorMaps = EditorKeyMaps{
	Send: key.NewBinding(
		key.WithKeys("enter", "ctrl+s"),
		key.WithHelp("enter", "send message"),
	),
	OpenEditor: key.NewBinding(
		key.WithKeys("ctrl+e"),
		key.WithHelp("ctrl+e", "open editor"),
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

func (m *editorCmp) openEditor(value string) tea.Cmd {
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

func (m *editorCmp) Init() tea.Cmd {
	return textarea.Blink
}

func (m *editorCmp) send() tea.Cmd {
	value := m.textarea.Value()
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
	return tea.Batch(
		util.CmdHandler(SendMsg{
			Text:        value,
			Attachments: attachments,
		}),
	)
}

func (m *editorCmp) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case dialog.ThemeChangedMsg:
		m.textarea = CreateTextArea(&m.textarea)
	case dialog.CompletionSelectedMsg:
		existingValue := m.textarea.Value()
		modifiedValue := strings.Replace(existingValue, msg.SearchString, msg.CompletionValue, 1)

		m.textarea.SetValue(modifiedValue)
		return m, nil
	case dialog.AttachmentAddedMsg:
		if len(m.attachments) >= maxAttachments {
			status.Error(fmt.Sprintf("cannot add more than %d images", maxAttachments))
			return m, cmd
		}
		m.attachments = append(m.attachments, msg.Attachment)
	case tea.KeyMsg:
		if key.Matches(msg, DeleteKeyMaps.AttachmentDeleteMode) {
			m.deleteMode = true
			return m, nil
		}
		if key.Matches(msg, DeleteKeyMaps.DeleteAllAttachments) && m.deleteMode {
			m.deleteMode = false
			m.attachments = nil
			return m, nil
		}
		if m.deleteMode && len(msg.Runes) > 0 && unicode.IsDigit(msg.Runes[0]) {
			num := int(msg.Runes[0] - '0')
			m.deleteMode = false
			if num < 10 && len(m.attachments) > num {
				if num == 0 {
					m.attachments = m.attachments[num+1:]
				} else {
					m.attachments = slices.Delete(m.attachments, num, num+1)
				}
				return m, nil
			}
		}
		if key.Matches(msg, messageKeys.PageUp) || key.Matches(msg, messageKeys.PageDown) ||
			key.Matches(msg, messageKeys.HalfPageUp) || key.Matches(msg, messageKeys.HalfPageDown) {
			return m, nil
		}
		if key.Matches(msg, editorMaps.OpenEditor) {
			// if m.app.PrimaryAgentOLD.IsSessionBusy(m.app.CurrentSessionOLD.ID) {
			// 	status.Warn("Agent is working, please wait...")
			// 	return m, nil
			// }
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
				attachment := message.Attachment{FilePath: attachmentName, FileName: attachmentName, Content: imageBytes, MimeType: "image/png"}
				m.attachments = append(m.attachments, attachment)
			} else {
				m.textarea.SetValue(m.textarea.Value() + text)
			}
			return m, cmd
		}

		// Handle history navigation with up/down arrow keys
		// Only handle history navigation if the filepicker is not open and completion dialog is not open
		if m.textarea.Focused() && key.Matches(msg, editorMaps.HistoryUp) && !m.app.IsFilepickerOpen() && !m.app.IsCompletionDialogOpen() {
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

		if m.textarea.Focused() && key.Matches(msg, editorMaps.HistoryDown) && !m.app.IsFilepickerOpen() && !m.app.IsCompletionDialogOpen() {
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
	m.textarea, cmd = m.textarea.Update(msg)
	return m, cmd
}

func (m *editorCmp) View() string {
	t := theme.CurrentTheme()

	// Style the prompt with theme colors
	style := lipgloss.NewStyle().
		Padding(0, 0, 0, 1).
		Bold(true).
		Foreground(t.Primary())

	if len(m.attachments) == 0 {
		return lipgloss.JoinHorizontal(lipgloss.Top, style.Render(">"), m.textarea.View())
	}
	m.textarea.SetHeight(m.height - 1)
	return lipgloss.JoinVertical(lipgloss.Top,
		m.attachmentsContent(),
		lipgloss.JoinHorizontal(lipgloss.Top, style.Render(">"),
			m.textarea.View()),
	)
}

func (m *editorCmp) SetSize(width, height int) tea.Cmd {
	m.width = width
	m.height = height
	m.textarea.SetWidth(width - 3) // account for the prompt and padding right
	m.textarea.SetHeight(height)
	return nil
}

func (m *editorCmp) GetSize() (int, int) {
	return m.textarea.Width(), m.textarea.Height()
}

func (m *editorCmp) attachmentsContent() string {
	var styledAttachments []string
	t := theme.CurrentTheme()
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

func (m *editorCmp) BindingKeys() []key.Binding {
	bindings := []key.Binding{}
	bindings = append(bindings, layout.KeyMapToSlice(editorMaps)...)
	bindings = append(bindings, layout.KeyMapToSlice(DeleteKeyMaps)...)
	return bindings
}

func CreateTextArea(existing *textarea.Model) textarea.Model {
	t := theme.CurrentTheme()
	bgColor := t.Background()
	textColor := t.Text()
	textMutedColor := t.TextMuted()

	ta := textarea.New()
	ta.BlurredStyle.Base = styles.BaseStyle().Background(bgColor).Foreground(textColor)
	ta.BlurredStyle.CursorLine = styles.BaseStyle().Background(bgColor)
	ta.BlurredStyle.Placeholder = styles.BaseStyle().Background(bgColor).Foreground(textMutedColor)
	ta.BlurredStyle.Text = styles.BaseStyle().Background(bgColor).Foreground(textColor)
	ta.FocusedStyle.Base = styles.BaseStyle().Background(bgColor).Foreground(textColor)
	ta.FocusedStyle.CursorLine = styles.BaseStyle().Background(bgColor)
	ta.FocusedStyle.Placeholder = styles.BaseStyle().Background(bgColor).Foreground(textMutedColor)
	ta.FocusedStyle.Text = styles.BaseStyle().Background(bgColor).Foreground(textColor)

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

func NewEditorCmp(app *app.App) tea.Model {
	ta := CreateTextArea(nil)
	return &editorCmp{
		app:            app,
		textarea:       ta,
		history:        []string{},
		historyIndex:   0,
		currentMessage: "",
	}
}
