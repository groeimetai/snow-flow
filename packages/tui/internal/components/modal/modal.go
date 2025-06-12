package modal

import (
	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

// Modal is a reusable modal component that handles frame rendering and overlay placement
type Modal struct {
	content       tea.Model
	width         int
	height        int
	title         string
	showBorder    bool
	borderStyle   lipgloss.Border
	maxWidth      int
	maxHeight     int
	centerContent bool
}

// ModalOption is a function that configures a Modal
type ModalOption func(*Modal)

// WithTitle sets the modal title
func WithTitle(title string) ModalOption {
	return func(m *Modal) {
		m.title = title
	}
}

// WithBorder enables/disables the border
func WithBorder(show bool) ModalOption {
	return func(m *Modal) {
		m.showBorder = show
	}
}

// WithBorderStyle sets the border style
func WithBorderStyle(style lipgloss.Border) ModalOption {
	return func(m *Modal) {
		m.borderStyle = style
	}
}

// WithMaxWidth sets the maximum width
func WithMaxWidth(width int) ModalOption {
	return func(m *Modal) {
		m.maxWidth = width
	}
}

// WithMaxHeight sets the maximum height
func WithMaxHeight(height int) ModalOption {
	return func(m *Modal) {
		m.maxHeight = height
	}
}

// WithCenterContent centers the content within the modal
func WithCenterContent(center bool) ModalOption {
	return func(m *Modal) {
		m.centerContent = center
	}
}

// New creates a new Modal with the given content and options
func New(content tea.Model, opts ...ModalOption) *Modal {
	m := &Modal{
		content:       content,
		showBorder:    true,
		borderStyle:   lipgloss.ThickBorder(),
		maxWidth:      0,
		maxHeight:     0,
		centerContent: false,
	}

	for _, opt := range opts {
		opt(m)
	}

	return m
}

func (m *Modal) Init() tea.Cmd {
	return m.content.Init()
}

func (m *Modal) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	}

	// Pass all messages to the content
	var cmd tea.Cmd
	m.content, cmd = m.content.Update(msg)
	return m, cmd
}

func (m *Modal) View() string {
	t := theme.CurrentTheme()
	
	// Get the content view
	contentView := ""
	if v, ok := m.content.(layout.ModelWithView); ok {
		contentView = v.View()
	}

	// Calculate dimensions
	outerWidth := layout.Current.Container.Width - 8
	if m.maxWidth > 0 && outerWidth > m.maxWidth {
		outerWidth = m.maxWidth
	}
	
	innerWidth := outerWidth - 4
	
	// Base style for the modal
	baseStyle := styles.BaseStyle().
		Background(t.BackgroundElement()).
		Foreground(t.TextMuted())

	// Add title if provided
	var finalContent string
	if m.title != "" {
		titleStyle := baseStyle.
			Foreground(t.Primary()).
			Bold(true).
			Width(innerWidth).
			Padding(0, 1)
		
		titleView := titleStyle.Render(m.title)
		finalContent = lipgloss.JoinVertical(
			lipgloss.Left,
			titleView,
			contentView,
		)
	} else {
		finalContent = contentView
	}

	// Apply modal styling
	modalStyle := baseStyle.
		PaddingTop(1).
		PaddingBottom(1).
		PaddingLeft(2).
		PaddingRight(2)

	if m.showBorder {
		modalStyle = modalStyle.
			BorderStyle(m.borderStyle).
			BorderLeft(true).
			BorderRight(true).
			BorderLeftForeground(t.BackgroundSubtle()).
			BorderLeftBackground(t.Background()).
			BorderRightForeground(t.BackgroundSubtle()).
			BorderRightBackground(t.Background())
	}

	return modalStyle.
		Width(outerWidth).
		Render(finalContent)
}

// Render renders the modal centered on the screen
func (m *Modal) Render(background string) string {
	modalView := m.View()
	
	// Calculate position for centering
	bgHeight := lipgloss.Height(background)
	bgWidth := lipgloss.Width(background)
	modalHeight := lipgloss.Height(modalView)
	modalWidth := lipgloss.Width(modalView)
	
	row := (bgHeight - modalHeight) / 2
	col := (bgWidth - modalWidth) / 2
	
	// Use PlaceOverlay to render the modal on top of the background
	return layout.PlaceOverlay(
		col,
		row,
		modalView,
		background,
		true, // shadow
	)
}

// BindingKeys returns the key bindings from the content if it implements layout.Bindings
func (m *Modal) BindingKeys() []key.Binding {
	if b, ok := m.content.(layout.Bindings); ok {
		return b.BindingKeys()
	}
	return []key.Binding{}
}