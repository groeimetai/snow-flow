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
	Context7     bool `json:"context7"`
	WebSearch    bool `json:"webSearch"`
	WebFetch     bool `json:"webFetch"`
	IsEnterprise bool `json:"isEnterprise"`
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

// FeaturesSavedMsg is sent when features are saved to server
type FeaturesSavedMsg struct {
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

type actionItem struct {
	label  string
	action string
}

func (a actionItem) Render(selected bool, width int, baseStyle styles.Style) string {
	t := theme.CurrentTheme()

	style := baseStyle.
		Foreground(t.Text()).
		MarginTop(1).
		Bold(true)

	if selected {
		style = style.Foreground(t.Success())
	}

	return style.Render("[ " + a.label + " ]")
}

func (a actionItem) Selectable() bool {
	return true
}

type settingsDialog struct {
	width            int
	height           int
	modal            *modal.Modal
	list             list.List[list.Item]
	originalFeatures FeatureState // Features loaded from server
	pendingFeatures  FeatureState // Features being edited (not yet saved)
	loading          bool
	saving           bool
	error            string
	hasChanges       bool
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

func (d *settingsDialog) saveFeatures() tea.Cmd {
	return func() tea.Msg {
		serverURL := os.Getenv("SNOWCODE_SERVER")
		if serverURL == "" {
			serverURL = "http://127.0.0.1:3006"
		}
		serverURL = strings.TrimSuffix(serverURL, "/")

		jsonData, err := json.Marshal(d.pendingFeatures)
		if err != nil {
			return FeaturesSavedMsg{Features: d.originalFeatures, Error: err.Error()}
		}

		resp, err := http.Post(serverURL+"/features", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return FeaturesSavedMsg{Features: d.originalFeatures, Error: err.Error()}
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return FeaturesSavedMsg{Features: d.originalFeatures, Error: err.Error()}
		}

		var savedFeatures FeatureState
		if err := json.Unmarshal(body, &savedFeatures); err != nil {
			return FeaturesSavedMsg{Features: d.originalFeatures, Error: err.Error()}
		}

		return FeaturesSavedMsg{Features: savedFeatures}
	}
}

func (d *settingsDialog) toggleFeatureLocally(key string) {
	switch key {
	case "context7":
		d.pendingFeatures.Context7 = !d.pendingFeatures.Context7
	case "webSearch":
		d.pendingFeatures.WebSearch = !d.pendingFeatures.WebSearch
	case "webFetch":
		d.pendingFeatures.WebFetch = !d.pendingFeatures.WebFetch
	}
	d.updateHasChanges()
	d.refreshList()
}

func (d *settingsDialog) updateHasChanges() {
	d.hasChanges = d.pendingFeatures.Context7 != d.originalFeatures.Context7 ||
		d.pendingFeatures.WebSearch != d.originalFeatures.WebSearch ||
		d.pendingFeatures.WebFetch != d.originalFeatures.WebFetch
}

func (d *settingsDialog) refreshList() {
	items := []list.Item{}

	// Context7 is enterprise-only
	if d.pendingFeatures.IsEnterprise {
		items = append(items, headerItem{title: "External Services (Enterprise)"})
		items = append(items, settingItem{
			name:        "Context7",
			description: "(documentation search)",
			enabled:     d.pendingFeatures.Context7,
			key:         "context7",
		})
	}

	items = append(items, headerItem{title: "Web Tools"})
	items = append(items, settingItem{
		name:        "WebSearch",
		description: "(search the web)",
		enabled:     d.pendingFeatures.WebSearch,
		key:         "webSearch",
	})
	items = append(items, settingItem{
		name:        "WebFetch",
		description: "(fetch web pages)",
		enabled:     d.pendingFeatures.WebFetch,
		key:         "webFetch",
	})

	// Add Save button
	saveLabel := "Save"
	if d.hasChanges {
		saveLabel = "Save *"
	}
	items = append(items, actionItem{label: saveLabel, action: "save"})

	d.list.SetItems(items)
}

func (d *settingsDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case FeaturesLoadedMsg:
		d.loading = false
		if msg.Error != "" {
			d.error = msg.Error
		} else {
			d.originalFeatures = msg.Features
			d.pendingFeatures = msg.Features
			d.hasChanges = false
			d.refreshList()
		}
		return d, nil

	case FeaturesSavedMsg:
		d.saving = false
		if msg.Error != "" {
			d.error = msg.Error
			return d, nil
		}
		// Success! Update original features and close
		d.originalFeatures = msg.Features
		d.pendingFeatures = msg.Features
		d.hasChanges = false
		return d, tea.Batch(
			util.CmdHandler(SettingsUpdatedMsg{Features: msg.Features}),
			util.CmdHandler(modal.CloseModalMsg{}),
		)

	case tea.WindowSizeMsg:
		d.width = msg.Width
		d.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "enter", " ":
			// Handle selected item
			if item, idx := d.list.GetSelectedItem(); idx >= 0 {
				if si, ok := item.(settingItem); ok {
					// Toggle the setting locally
					d.toggleFeatureLocally(si.key)
					return d, nil
				}
				if ai, ok := item.(actionItem); ok {
					if ai.action == "save" {
						d.saving = true
						return d, d.saveFeatures()
					}
				}
			}
		case "esc":
			// Cancel without saving
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
	if d.saving {
		return "Saving..."
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
		list.WithMaxVisibleHeight[list.Item](10),
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
		originalFeatures: FeatureState{
			Context7:  true,
			WebSearch: true,
			WebFetch:  true,
		},
		pendingFeatures: FeatureState{
			Context7:  true,
			WebSearch: true,
			WebFetch:  true,
		},
		loading: true,
	}
}
