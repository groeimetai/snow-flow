package styles

import (
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
	"github.com/sst/opencode/internal/theme"
)

// BaseStyle returns the base style with background and foreground colors
func BaseStyle() lipgloss.Style {
	t := theme.CurrentTheme()
	return lipgloss.NewStyle().
		Background(t.Background()).
		Foreground(t.Text())
}

func Panel() lipgloss.Style {
	t := theme.CurrentTheme()
	return lipgloss.NewStyle().
		Background(t.BackgroundSubtle()).
		Border(lipgloss.NormalBorder(), true, false, true, false).
		BorderForeground(t.BorderSubtle()).
		Foreground(t.Text())
}

// Regular returns a basic unstyled lipgloss.Style
func Regular() lipgloss.Style {
	return lipgloss.NewStyle()
}

func Muted() lipgloss.Style {
	t := theme.CurrentTheme()
	return lipgloss.NewStyle().Background(t.Background()).Foreground(t.TextMuted())
}

// Bold returns a bold style
func Bold() lipgloss.Style {
	return BaseStyle().Bold(true)
}

// Padded returns a style with horizontal padding
func Padded() lipgloss.Style {
	return BaseStyle().Padding(0, 1)
}

// Border returns a style with a normal border
func Border() lipgloss.Style {
	t := theme.CurrentTheme()
	return Regular().
		Border(lipgloss.NormalBorder()).
		BorderForeground(t.Border())
}

// ThickBorder returns a style with a thick border
func ThickBorder() lipgloss.Style {
	t := theme.CurrentTheme()
	return Regular().
		Border(lipgloss.ThickBorder()).
		BorderForeground(t.Border())
}

// DoubleBorder returns a style with a double border
func DoubleBorder() lipgloss.Style {
	t := theme.CurrentTheme()
	return Regular().
		Border(lipgloss.DoubleBorder()).
		BorderForeground(t.Border())
}

// FocusedBorder returns a style with a border using the focused border color
func FocusedBorder() lipgloss.Style {
	t := theme.CurrentTheme()
	return Regular().
		Border(lipgloss.NormalBorder()).
		BorderForeground(t.BorderActive())
}

// DimBorder returns a style with a border using the dim border color
func DimBorder() lipgloss.Style {
	t := theme.CurrentTheme()
	return Regular().
		Border(lipgloss.NormalBorder()).
		BorderForeground(t.BorderSubtle())
}

// PrimaryColor returns the primary color from the current theme
func PrimaryColor() compat.AdaptiveColor {
	return theme.CurrentTheme().Primary()
}

// SecondaryColor returns the secondary color from the current theme
func SecondaryColor() compat.AdaptiveColor {
	return theme.CurrentTheme().Secondary()
}

// AccentColor returns the accent color from the current theme
func AccentColor() compat.AdaptiveColor {
	return theme.CurrentTheme().Accent()
}

// ErrorColor returns the error color from the current theme
func ErrorColor() compat.AdaptiveColor {
	return theme.CurrentTheme().Error()
}

// WarningColor returns the warning color from the current theme
func WarningColor() compat.AdaptiveColor {
	return theme.CurrentTheme().Warning()
}

// SuccessColor returns the success color from the current theme
func SuccessColor() compat.AdaptiveColor {
	return theme.CurrentTheme().Success()
}

// InfoColor returns the info color from the current theme
func InfoColor() compat.AdaptiveColor {
	return theme.CurrentTheme().Info()
}

// TextColor returns the text color from the current theme
func TextColor() compat.AdaptiveColor {
	return theme.CurrentTheme().Text()
}

// TextMutedColor returns the muted text color from the current theme
func TextMutedColor() compat.AdaptiveColor {
	return theme.CurrentTheme().TextMuted()
}

// BackgroundColor returns the background color from the current theme
func BackgroundColor() compat.AdaptiveColor {
	return theme.CurrentTheme().Background()
}

// BackgroundSubtleColor returns the subtle background color from the current theme
func BackgroundSubtleColor() compat.AdaptiveColor {
	return theme.CurrentTheme().BackgroundSubtle()
}

// BackgroundElementColor returns the darker background color from the current theme
func BackgroundElementColor() compat.AdaptiveColor {
	return theme.CurrentTheme().BackgroundElement()
}

// BorderColor returns the border color from the current theme
func BorderColor() compat.AdaptiveColor {
	return theme.CurrentTheme().Border()
}

// BorderActiveColor returns the active border color from the current theme
func BorderActiveColor() compat.AdaptiveColor {
	return theme.CurrentTheme().BorderActive()
}

// BorderSubtleColor returns the subtle border color from the current theme
func BorderSubtleColor() compat.AdaptiveColor {
	return theme.CurrentTheme().BorderSubtle()
}
