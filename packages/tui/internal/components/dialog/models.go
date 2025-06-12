package dialog

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/state"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
	"github.com/sst/opencode/pkg/client"
)

const (
	numVisibleModels = 6
	maxDialogWidth   = 40
)

// ModelDialog interface for the model selection dialog
type ModelDialog interface {
	layout.Modal
}

type modelDialog struct {
	app                *app.App
	availableProviders []client.ProviderInfo
	provider           client.ProviderInfo

	selectedIdx     int
	width           int
	height          int
	scrollOffset    int
	hScrollOffset   int
	hScrollPossible bool

	modal *modal.Modal
}

type modelKeyMap struct {
	Up     key.Binding
	Down   key.Binding
	Left   key.Binding
	Right  key.Binding
	Enter  key.Binding
	Escape key.Binding
}

var modelKeys = modelKeyMap{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑", "previous model"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓", "next model"),
	),
	Left: key.NewBinding(
		key.WithKeys("left", "h"),
		key.WithHelp("←", "scroll left"),
	),
	Right: key.NewBinding(
		key.WithKeys("right", "l"),
		key.WithHelp("→", "scroll right"),
	),
	Enter: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "select model"),
	),
	Escape: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "close"),
	),
}

func (m *modelDialog) Init() tea.Cmd {
	// cfg := config.Get()
	// modelInfo := GetSelectedModel(cfg)
	// m.availableProviders = getEnabledProviders(cfg)
	// m.hScrollPossible = len(m.availableProviders) > 1

	// m.provider = modelInfo.Provider
	// m.hScrollOffset = findProviderIndex(m.availableProviders, m.provider)

	// m.setupModelsForProvider(m.provider)
	return nil
}

func (m *modelDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, modelKeys.Up):
			m.moveSelectionUp()
		case key.Matches(msg, modelKeys.Down):
			m.moveSelectionDown()
		case key.Matches(msg, modelKeys.Left):
			if m.hScrollPossible {
				m.switchProvider(-1)
			}
		case key.Matches(msg, modelKeys.Right):
			if m.hScrollPossible {
				m.switchProvider(1)
			}
		case key.Matches(msg, modelKeys.Enter):
			models := m.models()
			cmd := util.CmdHandler(state.ModelSelectedMsg{Provider: m.provider, Model: models[m.selectedIdx]})
			return m, tea.Batch(cmd, util.CmdHandler(modal.CloseModalMsg{}))
		case key.Matches(msg, modelKeys.Escape):
			return m, util.CmdHandler(modal.CloseModalMsg{})
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	}

	return m, nil
}

func (m *modelDialog) models() []client.ProviderModel {
	models := slices.SortedFunc(maps.Values(m.provider.Models), func(a, b client.ProviderModel) int {
		return strings.Compare(*a.Name, *b.Name)
	})
	return models
}

// moveSelectionUp moves the selection up or wraps to bottom
func (m *modelDialog) moveSelectionUp() {
	if m.selectedIdx > 0 {
		m.selectedIdx--
	} else {
		m.selectedIdx = len(m.provider.Models) - 1
		m.scrollOffset = max(0, len(m.provider.Models)-numVisibleModels)
	}

	// Keep selection visible
	if m.selectedIdx < m.scrollOffset {
		m.scrollOffset = m.selectedIdx
	}
}

// moveSelectionDown moves the selection down or wraps to top
func (m *modelDialog) moveSelectionDown() {
	if m.selectedIdx < len(m.provider.Models)-1 {
		m.selectedIdx++
	} else {
		m.selectedIdx = 0
		m.scrollOffset = 0
	}

	// Keep selection visible
	if m.selectedIdx >= m.scrollOffset+numVisibleModels {
		m.scrollOffset = m.selectedIdx - (numVisibleModels - 1)
	}
}

func (m *modelDialog) switchProvider(offset int) {
	newOffset := m.hScrollOffset + offset

	// Ensure we stay within bounds
	if newOffset < 0 {
		newOffset = len(m.availableProviders) - 1
	}
	if newOffset >= len(m.availableProviders) {
		newOffset = 0
	}

	m.hScrollOffset = newOffset
	m.provider = m.availableProviders[m.hScrollOffset]
	m.setupModelsForProvider(m.provider.Id)
}

func (m *modelDialog) View() string {
	t := theme.CurrentTheme()
	baseStyle := lipgloss.NewStyle().
		Background(t.BackgroundElement()).
		Foreground(t.Text())

	// Capitalize first letter of provider name
	title := baseStyle.
		Foreground(t.Primary()).
		Bold(true).
		Width(maxDialogWidth).
		Padding(0, 0, 1).
		Render(fmt.Sprintf("Select %s Model", m.provider.Name))

	// Render visible models
	endIdx := min(m.scrollOffset+numVisibleModels, len(m.provider.Models))
	modelItems := make([]string, 0, endIdx-m.scrollOffset)

	models := m.models()
	for i := m.scrollOffset; i < endIdx; i++ {
		itemStyle := baseStyle.Width(maxDialogWidth)
		if i == m.selectedIdx {
			itemStyle = itemStyle.
				Background(t.Primary()).
				Foreground(t.BackgroundElement()).
				Bold(true)
		}
		modelItems = append(modelItems, itemStyle.Render(*models[i].Name))
	}

	scrollIndicator := m.getScrollIndicators(maxDialogWidth)

	content := lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		baseStyle.Width(maxDialogWidth).Render(lipgloss.JoinVertical(lipgloss.Left, modelItems...)),
		scrollIndicator,
	)

	return content
}

func (m *modelDialog) getScrollIndicators(maxWidth int) string {
	var indicator string

	if len(m.provider.Models) > numVisibleModels {
		if m.scrollOffset > 0 {
			indicator += "↑ "
		}
		if m.scrollOffset+numVisibleModels < len(m.provider.Models) {
			indicator += "↓ "
		}
	}

	if m.hScrollPossible {
		if m.hScrollOffset > 0 {
			indicator = "← " + indicator
		}
		if m.hScrollOffset < len(m.availableProviders)-1 {
			indicator += "→"
		}
	}

	if indicator == "" {
		return ""
	}

	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle()

	return baseStyle.
		Foreground(t.Primary()).
		Width(maxWidth).
		Align(lipgloss.Right).
		Bold(true).
		Render(indicator)
}

// findProviderIndex returns the index of the provider in the list, or -1 if not found
// func findProviderIndex(providers []string, provider string) int {
// 	for i, p := range providers {
// 		if p == provider {
// 			return i
// 		}
// 	}
// 	return -1
// }

func (m *modelDialog) setupModelsForProvider(_ string) {
	m.selectedIdx = 0
	m.scrollOffset = 0

	// cfg := config.Get()
	// agentCfg := cfg.Agents[config.AgentPrimary]
	// selectedModelId := agentCfg.Model

	// m.provider = provider
	// m.models = getModelsForProvider(provider)

	// Try to select the current model if it belongs to this provider
	// if provider == models.SupportedModels[selectedModelId].Provider {
	// 	for i, model := range m.models {
	// 		if model.ID == selectedModelId {
	// 			m.selectedIdx = i
	// 			// Adjust scroll position to keep selected model visible
	// 			if m.selectedIdx >= numVisibleModels {
	// 				m.scrollOffset = m.selectedIdx - (numVisibleModels - 1)
	// 			}
	// 			break
	// 		}
	// 	}
	// }
}

func (m *modelDialog) Render(background string) string {
	return m.modal.Render(m.View(), background)
}

func (s *modelDialog) Close() tea.Cmd {
	return nil
}

func NewModelDialog(app *app.App) ModelDialog {
	availableProviders, _ := app.ListProviders(context.Background())

	return &modelDialog{
		availableProviders: availableProviders,
		hScrollOffset:      0,
		hScrollPossible:    len(availableProviders) > 1,
		provider:           availableProviders[0],
		modal:              modal.New(),
	}
}
