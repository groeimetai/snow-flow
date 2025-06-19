package toast

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

// ShowToastMsg is a message to display a toast notification
type ShowToastMsg struct {
	Message  string
	Title    *string
	Color    compat.AdaptiveColor
	Duration time.Duration
}

// DismissToastMsg is a message to dismiss a specific toast
type DismissToastMsg struct {
	ID string
}

// Toast represents a single toast notification
type Toast struct {
	ID        string
	Message   string
	Title     *string
	Color     compat.AdaptiveColor
	CreatedAt time.Time
	Duration  time.Duration
}

// ToastManager manages multiple toast notifications
type ToastManager struct {
	toasts []Toast
}

// NewToastManager creates a new toast manager
func NewToastManager() *ToastManager {
	return &ToastManager{
		toasts: []Toast{},
	}
}

// Init initializes the toast manager
func (tm *ToastManager) Init() tea.Cmd {
	return nil
}

// Update handles messages for the toast manager
func (tm *ToastManager) Update(msg tea.Msg) (*ToastManager, tea.Cmd) {
	switch msg := msg.(type) {
	case ShowToastMsg:
		toast := Toast{
			ID:        fmt.Sprintf("toast-%d", time.Now().UnixNano()),
			Title:     msg.Title,
			Message:   msg.Message,
			Color:     msg.Color,
			CreatedAt: time.Now(),
			Duration:  msg.Duration,
		}

		tm.toasts = append(tm.toasts, toast)

		// Return command to dismiss after duration
		return tm, tea.Tick(toast.Duration, func(t time.Time) tea.Msg {
			return DismissToastMsg{ID: toast.ID}
		})

	case DismissToastMsg:
		var newToasts []Toast
		for _, t := range tm.toasts {
			if t.ID != msg.ID {
				newToasts = append(newToasts, t)
			}
		}
		tm.toasts = newToasts
	}

	return tm, nil
}

// View renders all active toasts
func (tm *ToastManager) View() string {
	if len(tm.toasts) == 0 {
		return ""
	}

	t := theme.CurrentTheme()

	var toastViews []string
	for _, toast := range tm.toasts {
		baseStyle := styles.BaseStyle().
			Background(t.BackgroundElement()).
			Foreground(t.Text()).
			Padding(1, 2).
			BorderStyle(lipgloss.ThickBorder()).
			BorderBackground(t.Background()).
			BorderForeground(toast.Color).
			BorderLeft(true).
			BorderRight(true)

		maxWidth := max(40, layout.Current.Viewport.Width/3)
		contentMaxWidth := max(maxWidth-6, 20)

		// Build content with wrapping
		var content strings.Builder
		if toast.Title != nil {
			titleStyle := lipgloss.NewStyle().
				Foreground(toast.Color).
				Bold(true)
			content.WriteString(titleStyle.Render(*toast.Title))
			content.WriteString("\n")
		}

		// Wrap message text
		messageStyle := lipgloss.NewStyle().Width(contentMaxWidth)
		content.WriteString(messageStyle.Render(toast.Message))

		// Render toast with max width
		toastView := baseStyle.MaxWidth(maxWidth).Render(content.String())
		toastViews = append(toastViews, toastView)
	}

	// Stack toasts vertically with small gap
	return strings.Join(toastViews, "\n\n")
}

// RenderOverlay renders the toasts as an overlay on the given background
func (tm *ToastManager) RenderOverlay(background string) string {
	toastView := tm.View()
	if toastView == "" {
		return background
	}

	// Calculate position (bottom right with padding)
	bgWidth := lipgloss.Width(background)
	bgHeight := lipgloss.Height(background)
	toastWidth := lipgloss.Width(toastView)
	toastHeight := lipgloss.Height(toastView)

	// Position with 2 character padding from edges
	x := bgWidth - toastWidth - 2
	y := bgHeight - toastHeight - 2

	// Ensure we don't go negative
	if x < 0 {
		x = 0
	}
	if y < 0 {
		y = 0
	}
	return layout.PlaceOverlay(x, y, toastView, background)
}

type ToastOptions struct {
	Title    string
	Duration time.Duration
}

type toastOptions struct {
	title    *string
	duration *time.Duration
	color    *compat.AdaptiveColor
}

type ToastOption func(*toastOptions)

func WithTitle(title string) ToastOption {
	return func(t *toastOptions) {
		t.title = &title
	}
}
func WithDuration(duration time.Duration) ToastOption {
	return func(t *toastOptions) {
		t.duration = &duration
	}
}

func WithColor(color compat.AdaptiveColor) ToastOption {
	return func(t *toastOptions) {
		t.color = &color
	}
}

func NewToast(message string, options ...ToastOption) tea.Cmd {
	t := theme.CurrentTheme()
	duration := 5 * time.Second
	color := t.Primary()

	opts := toastOptions{
		duration: &duration,
		color:    &color,
	}
	for _, option := range options {
		option(&opts)
	}

	return func() tea.Msg {
		return ShowToastMsg{
			Message:  message,
			Title:    opts.title,
			Duration: *opts.duration,
			Color:    *opts.color,
		}
	}
}

func NewInfoToast(message string, options ...ToastOption) tea.Cmd {
	options = append(options, WithColor(theme.CurrentTheme().Info()))
	return NewToast(
		message,
		options...,
	)
}

func NewSuccessToast(message string, options ...ToastOption) tea.Cmd {
	options = append(options, WithColor(theme.CurrentTheme().Success()))
	return NewToast(
		message,
		options...,
	)
}

func NewWarningToast(message string, options ...ToastOption) tea.Cmd {
	options = append(options, WithColor(theme.CurrentTheme().Warning()))
	return NewToast(
		message,
		options...,
	)
}

func NewErrorToast(message string, options ...ToastOption) tea.Cmd {
	options = append(options, WithColor(theme.CurrentTheme().Error()))
	return NewToast(
		message,
		options...,
	)
}
