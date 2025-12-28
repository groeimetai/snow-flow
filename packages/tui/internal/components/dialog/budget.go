package dialog

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/v2/textinput"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	list "github.com/sst/opencode/internal/components/list"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/components/toast"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
)

// BudgetSavedMsg is sent when budget configuration is saved
type BudgetSavedMsg struct {
	Success bool
	Error   string
}

// EnterpriseAuthCheckMsg is sent when checking enterprise auth status
type EnterpriseAuthCheckMsg struct {
	IsEnterprise bool
	Error        string
}

// BudgetDialog interface for the budget configuration dialog
type BudgetDialog interface {
	layout.Modal
}

type budgetStep int

const (
	stepBudgetCheckingAuth budgetStep = iota
	stepBudgetNotEnterprise
	stepBudgetInputs
	stepBudgetSelectAction
	stepBudgetSaving
)

type actionOption struct {
	value       string
	label       string
	description string
}

func (a actionOption) Render(selected bool, width int, baseStyle styles.Style) string {
	t := theme.CurrentTheme()

	labelStyle := baseStyle.
		Foreground(t.Text()).
		Bold(selected)

	descStyle := baseStyle.
		Foreground(t.TextMuted()).
		Italic(true)

	if selected {
		labelStyle = labelStyle.Foreground(t.Primary())
	}

	label := labelStyle.Render(a.label)
	desc := descStyle.Render("  " + a.description)

	return lipgloss.JoinHorizontal(lipgloss.Left, label, desc)
}

func (a actionOption) Selectable() bool {
	return true
}

func (a actionOption) FilterValue() string {
	return a.label
}

type budgetDialog struct {
	width  int
	height int

	modal        *modal.Modal
	step         budgetStep
	inputs       []textinput.Model
	focusedInput int
	inputLabels  []string
	list         list.List[list.Item]

	// Values
	monthlyTokens string
	dailyCost     string
	action        string

	// Loading state
	loading        bool
	loadingMessage string
}

func (b *budgetDialog) Init() tea.Cmd {
	return tea.Batch(textinput.Blink, b.checkEnterpriseAuth())
}

func (b *budgetDialog) checkEnterpriseAuth() tea.Cmd {
	return func() tea.Msg {
		serverURL := os.Getenv("SNOWCODE_SERVER")
		if serverURL == "" {
			serverURL = "http://127.0.0.1:3006"
		}
		serverURL = strings.TrimSuffix(serverURL, "/")

		// Check if enterprise is configured by checking the config
		resp, err := http.Get(serverURL + "/api/enterprise/status")
		if err != nil {
			// If endpoint doesn't exist, check via config
			configResp, configErr := http.Get(serverURL + "/config")
			if configErr != nil {
				return EnterpriseAuthCheckMsg{IsEnterprise: false, Error: configErr.Error()}
			}
			defer configResp.Body.Close()

			var config map[string]interface{}
			if err := json.NewDecoder(configResp.Body).Decode(&config); err != nil {
				return EnterpriseAuthCheckMsg{IsEnterprise: false, Error: err.Error()}
			}

			// Check if enterprise is configured in MCP servers
			if mcp, ok := config["mcp"].(map[string]interface{}); ok {
				if _, hasEnterprise := mcp["snow-flow-enterprise"]; hasEnterprise {
					return EnterpriseAuthCheckMsg{IsEnterprise: true}
				}
			}

			return EnterpriseAuthCheckMsg{IsEnterprise: false}
		}
		defer resp.Body.Close()

		if resp.StatusCode == 200 {
			var result struct {
				IsEnterprise bool `json:"isEnterprise"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
				return EnterpriseAuthCheckMsg{IsEnterprise: result.IsEnterprise}
			}
		}

		return EnterpriseAuthCheckMsg{IsEnterprise: false}
	}
}

func (b *budgetDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		b.width = msg.Width
		b.height = msg.Height

	case EnterpriseAuthCheckMsg:
		b.loading = false
		if msg.IsEnterprise {
			b.step = stepBudgetInputs
			b.setupInputs()
			return b, b.updateInputFocus()
		} else {
			b.step = stepBudgetNotEnterprise
			b.modal = modal.New(modal.WithTitle("Enterprise Required"), modal.WithMaxWidth(60))
			return b, nil
		}

	case BudgetSavedMsg:
		b.loading = false
		if msg.Success {
			return b, tea.Sequence(
				toast.NewSuccessToast("Budget limits configured successfully!"),
				util.CmdHandler(modal.CloseModalMsg{}),
			)
		}
		return b, toast.NewErrorToast("Failed to save budget: " + msg.Error)

	case tea.KeyMsg:
		if b.loading {
			return b, nil
		}

		switch msg.String() {
		case "esc":
			return b, util.CmdHandler(modal.CloseModalMsg{})

		case "enter":
			return b.handleEnter()

		case "tab", "down":
			if b.step == stepBudgetInputs && len(b.inputs) > 0 {
				b.focusedInput = (b.focusedInput + 1) % len(b.inputs)
				return b, b.updateInputFocus()
			}

		case "shift+tab", "up":
			if b.step == stepBudgetInputs && len(b.inputs) > 0 {
				b.focusedInput--
				if b.focusedInput < 0 {
					b.focusedInput = len(b.inputs) - 1
				}
				return b, b.updateInputFocus()
			}
		}
	}

	// Update text inputs
	if b.step == stepBudgetInputs {
		for i := range b.inputs {
			var cmd tea.Cmd
			b.inputs[i], cmd = b.inputs[i].Update(msg)
			cmds = append(cmds, cmd)
		}
	}

	// Update list
	if b.step == stepBudgetSelectAction {
		var cmd tea.Cmd
		listModel, cmd := b.list.Update(msg)
		b.list = listModel.(list.List[list.Item])
		cmds = append(cmds, cmd)
	}

	return b, tea.Batch(cmds...)
}

func (b *budgetDialog) handleEnter() (tea.Model, tea.Cmd) {
	switch b.step {
	case stepBudgetInputs:
		// Validate inputs
		if len(b.inputs) >= 2 {
			b.monthlyTokens = strings.TrimSpace(b.inputs[0].Value())
			b.dailyCost = strings.TrimSpace(b.inputs[1].Value())

			if b.monthlyTokens == "" || b.dailyCost == "" {
				return b, toast.NewErrorToast("Please fill in all fields")
			}

			// Validate numeric values
			if _, err := strconv.ParseInt(b.monthlyTokens, 10, 64); err != nil {
				return b, toast.NewErrorToast("Monthly tokens must be a number")
			}
			if _, err := strconv.ParseFloat(b.dailyCost, 64); err != nil {
				return b, toast.NewErrorToast("Daily cost must be a number")
			}

			// Move to action selection
			b.step = stepBudgetSelectAction
			b.setupActionList()
			return b, nil
		}

	case stepBudgetSelectAction:
		if item, idx := b.list.GetSelectedItem(); idx >= 0 {
			if opt, ok := item.(actionOption); ok {
				b.action = opt.value
				b.loading = true
				b.loadingMessage = "Saving budget configuration..."
				return b, b.saveBudget()
			}
		}
	}

	return b, nil
}

func (b *budgetDialog) setupActionList() {
	options := []actionOption{
		{value: "warn", label: "Warn only", description: "Show warning when limit is reached"},
		{value: "throttle", label: "Throttle requests", description: "Slow down requests when limit is reached"},
		{value: "block", label: "Block requests", description: "Block all requests when limit is reached"},
	}

	items := make([]list.Item, len(options))
	for i, opt := range options {
		items[i] = opt
	}

	b.list = list.NewListComponent(
		list.WithItems(items),
		list.WithMaxVisibleHeight[list.Item](5),
		list.WithFallbackMessage[list.Item]("No options available"),
		list.WithRenderFunc(func(item list.Item, selected bool, width int, baseStyle styles.Style) string {
			return item.Render(selected, width, baseStyle)
		}),
		list.WithSelectableFunc(func(item list.Item) bool {
			return item.Selectable()
		}),
	)
	b.list.SetMaxWidth(55)
	b.modal = modal.New(modal.WithTitle("Select Limit Action"), modal.WithMaxWidth(60))
}

func (b *budgetDialog) setupInputs() {
	ti1 := textinput.New()
	ti1.Placeholder = "10000000"
	ti1.CharLimit = 15
	ti1.SetWidth(30)

	ti2 := textinput.New()
	ti2.Placeholder = "50"
	ti2.CharLimit = 10
	ti2.SetWidth(30)

	b.inputs = []textinput.Model{ti1, ti2}
	b.inputLabels = []string{"Monthly Token Budget", "Daily Cost Limit (USD)"}
	b.focusedInput = 0
	b.modal = modal.New(modal.WithTitle("Budget Configuration"), modal.WithMaxWidth(60))
}

func (b *budgetDialog) updateInputFocus() tea.Cmd {
	cmds := make([]tea.Cmd, len(b.inputs))
	for i := range b.inputs {
		if i == b.focusedInput {
			cmds[i] = b.inputs[i].Focus()
		} else {
			b.inputs[i].Blur()
		}
	}
	return tea.Batch(cmds...)
}

func (b *budgetDialog) saveBudget() tea.Cmd {
	monthlyTokens := b.monthlyTokens
	dailyCost := b.dailyCost
	action := b.action

	return func() tea.Msg {
		serverURL := os.Getenv("SNOWCODE_SERVER")
		if serverURL == "" {
			serverURL = "http://127.0.0.1:3006"
		}
		serverURL = strings.TrimSuffix(serverURL, "/")

		// Parse values
		monthlyTokensInt, _ := strconv.ParseInt(monthlyTokens, 10, 64)
		dailyCostFloat, _ := strconv.ParseFloat(dailyCost, 64)

		payload := map[string]interface{}{
			"monthlyTokens": monthlyTokensInt,
			"dailyCost":     dailyCostFloat,
			"action":        action,
		}
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return BudgetSavedMsg{Success: false, Error: err.Error()}
		}

		resp, err := http.Post(serverURL+"/api/enterprise/budget", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return BudgetSavedMsg{Success: false, Error: err.Error()}
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			body, _ := io.ReadAll(resp.Body)
			var errResult struct {
				Error string `json:"error"`
			}
			json.Unmarshal(body, &errResult)
			if errResult.Error != "" {
				return BudgetSavedMsg{Success: false, Error: errResult.Error}
			}
			return BudgetSavedMsg{Success: false, Error: fmt.Sprintf("HTTP %d", resp.StatusCode)}
		}

		return BudgetSavedMsg{Success: true}
	}
}

func (b *budgetDialog) Render(background string) string {
	t := theme.CurrentTheme()
	var content string

	if b.loading {
		loadingStyle := styles.NewStyle().Foreground(t.Primary())
		content = loadingStyle.Render("  " + b.loadingMessage)
	} else {
		switch b.step {
		case stepBudgetCheckingAuth:
			loadingStyle := styles.NewStyle().Foreground(t.Primary())
			content = loadingStyle.Render("  Checking enterprise authentication...")

		case stepBudgetNotEnterprise:
			var lines []string
			errorStyle := styles.NewStyle().Foreground(t.Error()).Bold(true)
			textStyle := styles.NewStyle().Foreground(t.Text())
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)

			lines = append(lines, errorStyle.Render("Enterprise License Required"))
			lines = append(lines, "")
			lines = append(lines, textStyle.Render("The /budget command is only available for"))
			lines = append(lines, textStyle.Render("Enterprise license users."))
			lines = append(lines, "")
			lines = append(lines, textStyle.Render("To configure budget limits, please first"))
			lines = append(lines, textStyle.Render("authenticate with your Enterprise license"))
			lines = append(lines, textStyle.Render("using the /auth command."))
			lines = append(lines, "")
			lines = append(lines, helpStyle.Render("Press Esc to close"))
			content = strings.Join(lines, "\n")

		case stepBudgetInputs:
			var lines []string

			// Header
			headerStyle := styles.NewStyle().Foreground(t.TextMuted())
			lines = append(lines, headerStyle.Render("Configure budget limits for your organization."))
			lines = append(lines, "")

			// Inputs
			for i, input := range b.inputs {
				label := b.inputLabels[i]
				labelStyle := styles.NewStyle().Foreground(t.TextMuted())
				if i == b.focusedInput {
					labelStyle = labelStyle.Foreground(t.Primary()).Bold(true)
				}
				lines = append(lines, labelStyle.Render(label+":"))
				lines = append(lines, input.View())
				lines = append(lines, "")
			}

			// Help
			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			lines = append(lines, helpStyle.Render("Tab: next field  Enter: continue  Esc: cancel"))
			content = strings.Join(lines, "\n")

		case stepBudgetSelectAction:
			var lines []string

			// Summary of values
			summaryStyle := styles.NewStyle().Foreground(t.TextMuted())
			valueStyle := styles.NewStyle().Foreground(t.Primary()).Bold(true)
			lines = append(lines, summaryStyle.Render("Monthly Token Budget: ")+valueStyle.Render(b.monthlyTokens))
			lines = append(lines, summaryStyle.Render("Daily Cost Limit: ")+valueStyle.Render("$"+b.dailyCost))
			lines = append(lines, "")
			lines = append(lines, summaryStyle.Render("What should happen when a limit is reached?"))
			lines = append(lines, "")
			lines = append(lines, b.list.View())
			lines = append(lines, "")

			helpStyle := styles.NewStyle().Foreground(t.TextMuted()).Italic(true)
			lines = append(lines, helpStyle.Render("/: navigate  Enter: save  Esc: cancel"))
			content = strings.Join(lines, "\n")
		}
	}

	return b.modal.Render(content, background)
}

func (b *budgetDialog) Close() tea.Cmd {
	return nil
}

// NewBudgetDialog creates a new budget configuration dialog
func NewBudgetDialog() BudgetDialog {
	return &budgetDialog{
		modal:        modal.New(modal.WithTitle("Budget Configuration"), modal.WithMaxWidth(60)),
		step:         stepBudgetCheckingAuth,
		loading:      true,
		loadingMessage: "Checking enterprise authentication...",
		action:       "warn",
	}
}
