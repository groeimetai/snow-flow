package dialog

import (
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/opencode/internal/components/modal"
	components "github.com/sst/opencode/internal/components/util"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/status"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
)

// ThemeChangedMsg is sent when the theme is changed
type ThemeChangedMsg struct {
	ThemeName string
}

// ThemeDialog interface for the theme switching dialog
type ThemeDialog interface {
	layout.Modal
}

type themeItem struct {
	name string
}

func (t themeItem) Render(selected bool, width int) string {
	th := theme.CurrentTheme()
	baseStyle := styles.BaseStyle().
		Width(width - 2).
		Background(th.BackgroundElement())

	if selected {
		baseStyle = baseStyle.
			Background(th.Primary()).
			Foreground(th.BackgroundElement()).
			Bold(true)
	} else {
		baseStyle = baseStyle.
			Foreground(th.Text())
	}

	return baseStyle.Padding(0, 1).Render(t.name)
}

type themeDialog struct {
	width  int
	height int

	modal *modal.Modal
	list  components.SimpleList[themeItem]
}

func (t *themeDialog) Init() tea.Cmd {
	return nil
}

func (t *themeDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		t.width = msg.Width
		t.height = msg.Height
	case tea.KeyMsg:
		switch msg.String() {
		case "enter":
			if item, idx := t.list.GetSelectedItem(); idx >= 0 {
				previousTheme := theme.CurrentThemeName()
				selectedTheme := item.name
				if previousTheme == selectedTheme {
					return t, util.CmdHandler(modal.CloseModalMsg{})
				}
				if err := theme.SetTheme(selectedTheme); err != nil {
					status.Error(err.Error())
					return t, nil
				}
				return t, tea.Sequence(
					util.CmdHandler(modal.CloseModalMsg{}),
					util.CmdHandler(ThemeChangedMsg{ThemeName: selectedTheme}),
				)
			}
		}
	}

	var cmd tea.Cmd
	listModel, cmd := t.list.Update(msg)
	t.list = listModel.(components.SimpleList[themeItem])
	return t, cmd
}

func (t *themeDialog) Render(background string) string {
	return t.modal.Render(t.list.View(), background)
}

func (t *themeDialog) Close() tea.Cmd {
	return nil
}

// NewThemeDialog creates a new theme switching dialog
func NewThemeDialog() ThemeDialog {
	themes := theme.AvailableThemes()
	currentTheme := theme.CurrentThemeName()

	var themeItems []themeItem
	var selectedIdx int
	for i, name := range themes {
		themeItems = append(themeItems, themeItem{name: name})
		if name == currentTheme {
			selectedIdx = i
		}
	}

	list := components.NewSimpleList(
		themeItems,
		10, // maxVisibleThemes
		"No themes available",
		true,
	)

	// Set the initial selection to the current theme
	list.SetSelectedIndex(selectedIdx)

	return &themeDialog{
		list:  list,
		modal: modal.New(modal.WithTitle("Select Theme"), modal.WithMaxWidth(40)),
	}
}
