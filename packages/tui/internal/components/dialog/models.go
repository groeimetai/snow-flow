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
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
	"github.com/sst/opencode/pkg/client"
)

const (
	numVisibleModels = 10
	maxDialogWidth   = 40
)

// CloseModelDialogMsg is sent when a model is selected
type CloseModelDialogMsg struct {
	Provider *client.ProviderInfo
	Model    *client.ProviderModel
}

// ModelDialog interface for the model selection dialog
type ModelDialog interface {
	layout.ModelWithView
	layout.Bindings

	SetProviders(providers []client.ProviderInfo)
}

type modelDialogComponent struct {
	app                *app.App
	availableProviders []client.ProviderInfo
	provider           client.ProviderInfo

	selectedIdx     int
	width           int
	height          int
	scrollOffset    int
	hScrollOffset   int
	hScrollPossible bool
}

type modelKeyMap struct {
	Up     key.Binding
	Down   key.Binding
	Left   key.Binding
	Right  key.Binding
	Enter  key.Binding
	Escape key.Binding
	J      key.Binding
	K      key.Binding
	H      key.Binding
	L      key.Binding
}

var modelKeys = modelKeyMap{
	Up: key.NewBinding(
		key.WithKeys("up"),
		key.WithHelp("↑", "previous model"),
	),
	Down: key.NewBinding(
		key.WithKeys("down"),
		key.WithHelp("↓", "next model"),
	),
	Left: key.NewBinding(
		key.WithKeys("left"),
		key.WithHelp("←", "scroll left"),
	),
	Right: key.NewBinding(
		key.WithKeys("right"),
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
	J: key.NewBinding(
		key.WithKeys("j"),
		key.WithHelp("j", "next model"),
	),
	K: key.NewBinding(
		key.WithKeys("k"),
		key.WithHelp("k", "previous model"),
	),
	H: key.NewBinding(
		key.WithKeys("h"),
		key.WithHelp("h", "scroll left"),
	),
	L: key.NewBinding(
		key.WithKeys("l"),
		key.WithHelp("l", "scroll right"),
	),
}

func (m *modelDialogComponent) Init() tea.Cmd {
	// cfg := config.Get()
	// modelInfo := GetSelectedModel(cfg)
	// m.availableProviders = getEnabledProviders(cfg)
	// m.hScrollPossible = len(m.availableProviders) > 1

	// m.provider = modelInfo.Provider
	// m.hScrollOffset = findProviderIndex(m.availableProviders, m.provider)

	// m.setupModelsForProvider(m.provider)

	m.availableProviders, _ = m.app.ListProviders(context.Background())
	m.hScrollOffset = 0
	m.hScrollPossible = len(m.availableProviders) > 1
	m.provider = m.availableProviders[m.hScrollOffset]

	return nil
}

func (m *modelDialogComponent) SetProviders(providers []client.ProviderInfo) {
	m.availableProviders = providers
}

func (m *modelDialogComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, modelKeys.Up) || key.Matches(msg, modelKeys.K):
			m.moveSelectionUp()
		case key.Matches(msg, modelKeys.Down) || key.Matches(msg, modelKeys.J):
			m.moveSelectionDown()
		case key.Matches(msg, modelKeys.Left) || key.Matches(msg, modelKeys.H):
			if m.hScrollPossible {
				m.switchProvider(-1)
			}
		case key.Matches(msg, modelKeys.Right) || key.Matches(msg, modelKeys.L):
			if m.hScrollPossible {
				m.switchProvider(1)
			}
		case key.Matches(msg, modelKeys.Enter):
			models := m.models()
			return m, util.CmdHandler(CloseModelDialogMsg{Provider: &m.provider, Model: &models[m.selectedIdx]})
		case key.Matches(msg, modelKeys.Escape):
			return m, util.CmdHandler(CloseModelDialogMsg{})
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	}

	return m, nil
}

func (m *modelDialogComponent) models() []client.ProviderModel {
	models := slices.SortedFunc(maps.Values(m.provider.Models), func(a, b client.ProviderModel) int {
		return strings.Compare(*a.Name, *b.Name)
	})
	return models
}

// moveSelectionUp moves the selection up or wraps to bottom
func (m *modelDialogComponent) moveSelectionUp() {
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
func (m *modelDialogComponent) moveSelectionDown() {
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

func (m *modelDialogComponent) switchProvider(offset int) {
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

func (m *modelDialogComponent) View() string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle()

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
			itemStyle = itemStyle.Background(t.Primary()).
				Foreground(t.Background()).Bold(true)
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

	return baseStyle.Padding(1, 2).
		Border(lipgloss.RoundedBorder()).
		BorderBackground(t.Background()).
		BorderForeground(t.TextMuted()).
		Width(lipgloss.Width(content) + 4).
		Render(content)
}

func (m *modelDialogComponent) getScrollIndicators(maxWidth int) string {
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

func (m *modelDialogComponent) BindingKeys() []key.Binding {
	return layout.KeyMapToSlice(modelKeys)
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

func (m *modelDialogComponent) setupModelsForProvider(_ string) {
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

func NewModelDialogCmp(app *app.App) ModelDialog {
	return &modelDialogComponent{
		app: app,
	}
}
