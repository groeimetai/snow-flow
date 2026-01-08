package dialog

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	list "github.com/sst/opencode/internal/components/list"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
)

// FeatureState represents the feature toggle states
type FeatureState struct {
	Context7  bool `json:"context7"`
	WebSearch bool `json:"webSearch"`
	WebFetch  bool `json:"webFetch"`
}

// SettingsUpdatedMsg is sent when settings are changed
type SettingsUpdatedMsg struct {
	Features FeatureState
}

// FeaturesLoadedMsg is sent when features are loaded from server
type FeaturesLoadedMsg struct {
	Features FeatureState
	Error    string
}

// FeatureToggledMsg is sent when a feature is toggled
type FeatureToggledMsg struct {
	Features FeatureState
	Error    string
}

// SettingsDialog interface for the settings dialog
type SettingsDialog interface {
	layout.Modal
}

type settingItem struct {
	name        string
	description string
	enabled     bool
	key         string
}

func (s settingItem) Render(selected bool, width int, baseStyle styles.Style) string {
	t := theme.CurrentTheme()

	// Toggle indicator
	toggle := "[ ]"
	toggleColor := t.TextMuted()
	if s.enabled {
		toggle = "[x]"
		toggleColor = t.Success()
	}

	toggleStyle := baseStyle.Foreground(toggleColor)

	labelStyle := baseStyle.Foreground(t.Text())
	if selected {
		labelStyle = labelStyle.Foreground(t.Primary()).Bold(true)
	}

	descStyle := baseStyle.Foreground(t.TextMuted()).Italic(true)

	return lipgloss.JoinHorizontal(
		lipgloss.Left,
		toggleStyle.Render(toggle),
		" ",
		labelStyle.Render(s.name),
		" ",
		descStyle.Render(s.description),
	)
}

func (s settingItem) Selectable() bool {
	return true
}

type headerItem struct {
	title string
}

func (h headerItem) Render(selected bool, width int, baseStyle styles.Style) string {
	t := theme.CurrentTheme()
	return baseStyle.
		Foreground(t.TextMuted()).
		Bold(true).
		MarginTop(1).
		Render(h.title)
}

func (h headerItem) Selectable() bool {
	return false
}

type settingsDialog struct {
	width    int
	height   int
	modal    *modal.Modal
	list     list.List[list.Item]
	features FeatureState
	loading  bool
	error    string
}

func (d *settingsDialog) Init() tea.Cmd {
	return d.loadFeatures()
}

func (d *settingsDialog) loadFeatures() tea.Cmd {
	return func() tea.Msg {
		serverURL := os.Getenv("SNOWCODE_SERVER")
		if serverURL == "" {
			serverURL = "http://127.0.0.1:3006"
		}
		serverURL = strings.TrimSuffix(serverURL, "/")

		resp, err := http.Get(serverURL + "/features")
		if err != nil {
			return FeaturesLoadedMsg{Error: err.Error()}
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return FeaturesLoadedMsg{Error: err.Error()}
		}

		var features FeatureState
		if err := json.Unmarshal(body, &features); err != nil {
			return FeaturesLoadedMsg{Error: err.Error()}
		}

		return FeaturesLoadedMsg{Features: features}
	}
}

func (d *settingsDialog) toggleFeature(key string) tea.Cmd {
	return func() tea.Msg {
		// Toggle locally first
		newFeatures := d.features
		switch key {
		case "context7":
			newFeatures.Context7 = !newFeatures.Context7
		case "webSearch":
			newFeatures.WebSearch = !newFeatures.WebSearch
		case "webFetch":
			newFeatures.WebFetch = !newFeatures.WebFetch
		}

		serverURL := os.Getenv("SNOWCODE_SERVER")
		if serverURL == "" {
			serverURL = "http://127.0.0.1:3006"
		}
		serverURL = strings.TrimSuffix(serverURL, "/")

		jsonData, err := json.Marshal(newFeatures)
		if err != nil {
			return FeatureToggledMsg{Features: d.features, Error: err.Error()}
		}

		resp, err := http.Post(serverURL+"/features", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return FeatureToggledMsg{Features: d.features, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return FeatureToggledMsg{Features: d.features, Error: err.Error()}
		}

		var updatedFeatures FeatureState
		if err := json.Unmarshal(body, &updatedFeatures); err != nil {
			return FeatureToggledMsg{Features: d.features, Error: err.Error()}
		}

		return FeatureToggledMsg{Features: updatedFeatures}
	}
}

func (d *settingsDialog) refreshList() {
	items := []list.Item{
		headerItem{title: "External Services"},
		settingItem{
			name:        "Context7",
			description: "(documentation search)",
			enabled:     d.features.Context7,
			key:         "context7",
		},
		headerItem{title: "Web Tools"},
		settingItem{
			name:        "WebSearch",
			description: "(search the web)",
			enabled:     d.features.WebSearch,
			key:         "webSearch",
		},
		settingItem{
			name:        "WebFetch",
			description: "(fetch web pages)",
			enabled:     d.features.WebFetch,
			key:         "webFetch",
		},
	}
	d.list.SetItems(items)
}

func (d *settingsDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case FeaturesLoadedMsg:
		d.loading = false
		if msg.Error != "" {
			d.error = msg.Error
		} else {
			d.features = msg.Features
			d.refreshList()
		}
		return d, nil

	case FeatureToggledMsg:
		if msg.Error != "" {
			d.error = msg.Error
		} else {
			d.features = msg.Features
			d.refreshList()
		}
		return d, util.CmdHandler(SettingsUpdatedMsg{Features: d.features})

	case tea.WindowSizeMsg:
		d.width = msg.Width
		d.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "enter", " ":
			// Toggle selected item
			if item, idx := d.list.GetSelectedItem(); idx >= 0 {
				if si, ok := item.(settingItem); ok {
					return d, d.toggleFeature(si.key)
				}
			}
		case "esc":
			return d, util.CmdHandler(modal.CloseModalMsg{})
		}
	}

	var cmd tea.Cmd
	listModel, cmd := d.list.Update(msg)
	d.list = listModel.(list.List[list.Item])
	return d, cmd
}

func (d *settingsDialog) View() string {
	if d.loading {
		return "Loading settings..."
	}
	if d.error != "" {
		return "Error: " + d.error
	}
	return d.list.View()
}

func (d *settingsDialog) Render(background string) string {
	return d.modal.Render(d.View(), background)
}

func (d *settingsDialog) Close() tea.Cmd {
	return nil
}

// NewSettingsDialog creates a new settings dialog
func NewSettingsDialog() SettingsDialog {
	listComponent := list.NewListComponent(
		list.WithItems([]list.Item{}),
		list.WithMaxVisibleHeight[list.Item](8),
		list.WithFallbackMessage[list.Item]("Loading settings..."),
		list.WithAlphaNumericKeys[list.Item](false),
		list.WithRenderFunc(func(item list.Item, selected bool, width int, baseStyle styles.Style) string {
			return item.Render(selected, width, baseStyle)
		}),
		list.WithSelectableFunc(func(item list.Item) bool {
			return item.Selectable()
		}),
	)
	listComponent.SetMaxWidth(42)

	return &settingsDialog{
		list:  listComponent,
		modal: modal.New(modal.WithTitle("Settings"), modal.WithMaxWidth(46)),
		features: FeatureState{
			Context7:  true,
			WebSearch: true,
			WebFetch:  true,
		},
		loading: true,
	}
}
