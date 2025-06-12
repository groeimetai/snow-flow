package layout

import (
	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
)

type FlexDirection int

const (
	FlexDirectionHorizontal FlexDirection = iota
	FlexDirectionVertical
)

type FlexPaneSize struct {
	Fixed bool
	Size  int
}

var FlexPaneSizeGrow = FlexPaneSize{Fixed: false}

func FlexPaneSizeFixed(size int) FlexPaneSize {
	return FlexPaneSize{Fixed: true, Size: size}
}

type FlexLayout interface {
	ModelWithView
	Sizeable
	Bindings
	SetPanes(panes []Container) tea.Cmd
	SetPaneSizes(sizes []FlexPaneSize) tea.Cmd
	SetDirection(direction FlexDirection) tea.Cmd
}

type flexLayout struct {
	width     int
	height    int
	direction FlexDirection
	panes     []Container
	sizes     []FlexPaneSize
}

type FlexLayoutOption func(*flexLayout)

func (f *flexLayout) Init() tea.Cmd {
	var cmds []tea.Cmd
	for _, pane := range f.panes {
		if pane != nil {
			cmds = append(cmds, pane.Init())
		}
	}
	return tea.Batch(cmds...)
}

func (f *flexLayout) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		return f, f.SetSize(msg.Width, msg.Height)
	}

	for i, pane := range f.panes {
		if pane != nil {
			u, cmd := pane.Update(msg)
			f.panes[i] = u.(Container)
			if cmd != nil {
				cmds = append(cmds, cmd)
			}
		}
	}

	return f, tea.Batch(cmds...)
}

func (f *flexLayout) View() string {
	if len(f.panes) == 0 {
		return ""
	}

	views := make([]string, 0, len(f.panes))
	for i, pane := range f.panes {
		if pane == nil {
			continue
		}

		var paneWidth, paneHeight int
		if f.direction == FlexDirectionHorizontal {
			paneWidth, paneHeight = f.calculatePaneSize(i)
			view := lipgloss.PlaceHorizontal(
				paneWidth,
				pane.Alignment(),
				pane.View(),
			)
			views = append(views, view)
		} else {
			paneWidth, paneHeight = f.calculatePaneSize(i)
			view := lipgloss.Place(
				f.width,
				paneHeight,
				lipgloss.Center,
				pane.Alignment(),
				pane.View(),
			)
			views = append(views, view)
		}
	}

	if f.direction == FlexDirectionHorizontal {
		return lipgloss.JoinHorizontal(lipgloss.Center, views...)
	}
	return lipgloss.JoinVertical(lipgloss.Center, views...)
}

func (f *flexLayout) calculatePaneSize(index int) (width, height int) {
	if index >= len(f.panes) {
		return 0, 0
	}

	totalFixed := 0
	flexCount := 0

	for i, pane := range f.panes {
		if pane == nil {
			continue
		}
		if i < len(f.sizes) && f.sizes[i].Fixed {
			if f.direction == FlexDirectionHorizontal {
				totalFixed += f.sizes[i].Size
			} else {
				totalFixed += f.sizes[i].Size
			}
		} else {
			flexCount++
		}
	}

	if f.direction == FlexDirectionHorizontal {
		height = f.height
		if index < len(f.sizes) && f.sizes[index].Fixed {
			width = f.sizes[index].Size
		} else if flexCount > 0 {
			remainingSpace := f.width - totalFixed
			width = remainingSpace / flexCount
		}
	} else {
		width = f.width
		if index < len(f.sizes) && f.sizes[index].Fixed {
			height = f.sizes[index].Size
		} else if flexCount > 0 {
			remainingSpace := f.height - totalFixed
			height = remainingSpace / flexCount
		}
	}

	return width, height
}

func (f *flexLayout) SetSize(width, height int) tea.Cmd {
	f.width = width
	f.height = height

	var cmds []tea.Cmd
	for i, pane := range f.panes {
		if pane != nil {
			paneWidth, paneHeight := f.calculatePaneSize(i)
			cmd := pane.SetSize(paneWidth, paneHeight)
			cmds = append(cmds, cmd)
		}
	}
	return tea.Batch(cmds...)
}

func (f *flexLayout) GetSize() (int, int) {
	return f.width, f.height
}

func (f *flexLayout) SetPanes(panes []Container) tea.Cmd {
	f.panes = panes
	if f.width > 0 && f.height > 0 {
		return f.SetSize(f.width, f.height)
	}
	return nil
}

func (f *flexLayout) SetPaneSizes(sizes []FlexPaneSize) tea.Cmd {
	f.sizes = sizes
	if f.width > 0 && f.height > 0 {
		return f.SetSize(f.width, f.height)
	}
	return nil
}

func (f *flexLayout) SetDirection(direction FlexDirection) tea.Cmd {
	f.direction = direction
	if f.width > 0 && f.height > 0 {
		return f.SetSize(f.width, f.height)
	}
	return nil
}

func (f *flexLayout) BindingKeys() []key.Binding {
	keys := []key.Binding{}
	for _, pane := range f.panes {
		if pane != nil {
			if b, ok := pane.(Bindings); ok {
				keys = append(keys, b.BindingKeys()...)
			}
		}
	}
	return keys
}

func NewFlexLayout(options ...FlexLayoutOption) FlexLayout {
	layout := &flexLayout{
		direction: FlexDirectionHorizontal,
		panes:     []Container{},
		sizes:     []FlexPaneSize{},
	}
	for _, option := range options {
		option(layout)
	}
	return layout
}

func WithDirection(direction FlexDirection) FlexLayoutOption {
	return func(f *flexLayout) {
		f.direction = direction
	}
}

func WithPanes(panes ...Container) FlexLayoutOption {
	return func(f *flexLayout) {
		f.panes = panes
	}
}

func WithPaneSizes(sizes ...FlexPaneSize) FlexLayoutOption {
	return func(f *flexLayout) {
		f.sizes = sizes
	}
}
