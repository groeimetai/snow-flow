package layout

import (
	"reflect"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
)

var Current *LayoutInfo

func init() {
	Current = &LayoutInfo{
		Viewport:  Dimensions{Width: 80, Height: 25},
		Container: Dimensions{Width: 80, Height: 25},
	}
}

type LayoutSize string

type Dimensions struct {
	Width  int
	Height int
}

type LayoutInfo struct {
	Viewport  Dimensions
	Container Dimensions
}

type Modal interface {
	tea.Model
	Render(background string) string
	Close() tea.Cmd
}

type Focusable interface {
	Focus() tea.Cmd
	Blur() tea.Cmd
	IsFocused() bool
}

type Sizeable interface {
	SetSize(width, height int) tea.Cmd
	GetSize() (int, int)
}

type Bindings interface {
	BindingKeys() []key.Binding
}

func KeyMapToSlice(t any) (bindings []key.Binding) {
	typ := reflect.TypeOf(t)
	if typ.Kind() != reflect.Struct {
		return nil
	}
	for i := range typ.NumField() {
		v := reflect.ValueOf(t).Field(i)
		bindings = append(bindings, v.Interface().(key.Binding))
	}
	return
}
