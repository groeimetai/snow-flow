package logs

import (
	// "context"
	"fmt"
	"log/slog"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/logging"
	"github.com/sst/opencode/internal/pubsub"
	"github.com/sst/opencode/internal/tui/layout"
	"github.com/sst/opencode/internal/tui/state"
	"github.com/sst/opencode/internal/tui/theme"
)

type TableComponent interface {
	tea.Model
	layout.Sizeable
	layout.Bindings
}

type tableCmp struct {
	app           *app.App
	table         table.Model
	focused       bool
	logs          []logging.Log
	selectedLogID string
}

type selectedLogMsg logging.Log

type LogsLoadedMsg struct {
	logs []logging.Log
}

func (i *tableCmp) Init() tea.Cmd {
	return i.fetchLogs()
}

func (i *tableCmp) fetchLogs() tea.Cmd {
	return func() tea.Msg {
		// ctx := context.Background()

		var logs []logging.Log
		var err error

		// Limit the number of logs to improve performance
		const logLimit = 100
		// TODO: Logs service not implemented in API yet
		logs = []logging.Log{}
		err = fmt.Errorf("logs service not implemented")

		if err != nil {
			slog.Error("Failed to fetch logs", "error", err)
			return nil
		}

		return LogsLoadedMsg{logs: logs}
	}
}

func (i *tableCmp) updateRows() tea.Cmd {
	return func() tea.Msg {
		rows := make([]table.Row, 0, len(i.logs))

		for _, log := range i.logs {
			timeStr := log.Timestamp.Local().Format("15:04:05")

			// Include ID as hidden first column for selection
			row := table.Row{
				log.ID,
				timeStr,
				log.Level,
				log.Message,
			}
			rows = append(rows, row)
		}

		i.table.SetRows(rows)
		return nil
	}
}

func (i *tableCmp) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case LogsLoadedMsg:
		i.logs = msg.logs
		return i, i.updateRows()

	case state.SessionSelectedMsg:
		return i, i.fetchLogs()

	case pubsub.Event[logging.Log]:
		if msg.Type == logging.EventLogCreated {
			// Add the new log to our list
			i.logs = append([]logging.Log{msg.Payload}, i.logs...)
			// Keep the list at a reasonable size
			if len(i.logs) > 100 {
				i.logs = i.logs[:100]
			}
			return i, i.updateRows()
		}
		return i, nil
	}

	// Only process keyboard input when focused
	if _, ok := msg.(tea.KeyMsg); ok && !i.focused {
		return i, nil
	}

	t, cmd := i.table.Update(msg)
	cmds = append(cmds, cmd)
	i.table = t

	selectedRow := i.table.SelectedRow()
	if selectedRow != nil {
		// Only send message if it's a new selection
		if i.selectedLogID != selectedRow[0] {
			cmds = append(cmds, func() tea.Msg {
				for _, log := range i.logs {
					if log.ID == selectedRow[0] {
						return selectedLogMsg(log)
					}
				}
				return nil
			})
		}

		i.selectedLogID = selectedRow[0]
	}

	return i, tea.Batch(cmds...)
}

func (i *tableCmp) View() string {
	t := theme.CurrentTheme()
	defaultStyles := table.DefaultStyles()
	defaultStyles.Selected = defaultStyles.Selected.Foreground(t.Primary())
	i.table.SetStyles(defaultStyles)
	return i.table.View()
}

func (i *tableCmp) GetSize() (int, int) {
	return i.table.Width(), i.table.Height()
}

func (i *tableCmp) SetSize(width int, height int) tea.Cmd {
	i.table.SetWidth(width)
	i.table.SetHeight(height)
	columns := i.table.Columns()

	// Calculate widths for visible columns
	timeWidth := 8  // Fixed width for Time column
	levelWidth := 7 // Fixed width for Level column

	// Message column gets the remaining space
	messageWidth := width - timeWidth - levelWidth - 5 // 5 for padding and borders

	// Set column widths
	columns[0].Width = 0 // ID column (hidden)
	columns[1].Width = timeWidth
	columns[2].Width = levelWidth
	columns[3].Width = messageWidth

	i.table.SetColumns(columns)
	return nil
}

func (i *tableCmp) BindingKeys() []key.Binding {
	return layout.KeyMapToSlice(i.table.KeyMap)
}

func NewLogsTable(app *app.App) TableComponent {
	columns := []table.Column{
		{Title: "ID", Width: 0}, // ID column with zero width
		{Title: "Time", Width: 8},
		{Title: "Level", Width: 7},
		{Title: "Message", Width: 30},
	}

	tableModel := table.New(
		table.WithColumns(columns),
	)
	tableModel.Focus()
	return &tableCmp{
		app:   app,
		table: tableModel,
		logs:  []logging.Log{},
	}
}

// Focus implements the focusable interface
func (i *tableCmp) Focus() {
	i.focused = true
	i.table.Focus()
}

// Blur implements the blurable interface
func (i *tableCmp) Blur() {
	i.focused = false
	i.table.Blur()
}
