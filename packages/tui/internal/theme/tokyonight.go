package theme

import (
	"github.com/charmbracelet/lipgloss"
)

// TokyoNightTheme implements the Theme interface with Tokyo Night colors.
// It provides both dark and light variants.
type TokyoNightTheme struct {
	BaseTheme
}

// NewTokyoNightTheme creates a new instance of the Tokyo Night theme.
func NewTokyoNightTheme() *TokyoNightTheme {
	// Tokyo Night color palette with Radix-inspired scale progression
	// Dark mode colors - Tokyo Night Moon variant
	darkStep1 := "#1a1b26"  // App background (bg)
	darkStep2 := "#1e2030"  // Subtle background (bg_dark)
	darkStep3 := "#222436"  // UI element background (bg_highlight)
	darkStep4 := "#292e42"  // Hovered UI element background
	darkStep5 := "#3b4261"  // Active/Selected UI element background (bg_visual)
	darkStep6 := "#545c7e"  // Subtle borders and separators (dark3)
	darkStep7 := "#737aa2"  // UI element border and focus rings (dark5)
	darkStep8 := "#9099b2"  // Hovered UI element border
	darkStep9 := "#82aaff"  // Solid backgrounds (blue)
	darkStep10 := "#89b4fa" // Hovered solid backgrounds
	darkStep11 := "#828bb8" // Low-contrast text (using fg_dark for better contrast)
	darkStep12 := "#c8d3f5" // High-contrast text (fg)

	// Dark mode accent colors
	darkRed := "#ff757f"
	darkOrange := "#ff966c"
	darkYellow := "#ffc777"
	darkGreen := "#c3e88d"
	darkCyan := "#86e1fc"
	darkBlue := darkStep9 // Using step 9 for primary
	darkPurple := "#c099ff"

	// Light mode colors - Tokyo Night Day variant
	lightStep1 := "#e1e2e7"  // App background
	lightStep2 := "#d5d6db"  // Subtle background
	lightStep3 := "#c8c9ce"  // UI element background
	lightStep4 := "#b9bac1"  // Hovered UI element background
	lightStep5 := "#a8aecb"  // Active/Selected UI element background
	lightStep6 := "#9699a8"  // Subtle borders and separators
	lightStep7 := "#737a8c"  // UI element border and focus rings
	lightStep8 := "#5a607d"  // Hovered UI element border
	lightStep9 := "#2e7de9"  // Solid backgrounds (blue)
	lightStep10 := "#1a6ce7" // Hovered solid backgrounds
	lightStep11 := "#8990a3" // Low-contrast text (more muted)
	lightStep12 := "#3760bf" // High-contrast text

	// Light mode accent colors
	lightRed := "#f52a65"
	lightOrange := "#b15c00"
	lightYellow := "#8c6c3e"
	lightGreen := "#587539"
	lightCyan := "#007197"
	lightBlue := lightStep9 // Using step 9 for primary
	lightPurple := "#9854f1"

	// Unused variables to avoid compiler errors (these could be used for hover states)
	_ = darkStep4
	_ = darkStep5
	_ = darkStep10
	_ = lightStep4
	_ = lightStep5
	_ = lightStep10

	theme := &TokyoNightTheme{}

	// Base colors
	theme.PrimaryColor = lipgloss.AdaptiveColor{
		Dark:  darkBlue,
		Light: lightBlue,
	}
	theme.SecondaryColor = lipgloss.AdaptiveColor{
		Dark:  darkPurple,
		Light: lightPurple,
	}
	theme.AccentColor = lipgloss.AdaptiveColor{
		Dark:  darkOrange,
		Light: lightOrange,
	}

	// Status colors
	theme.ErrorColor = lipgloss.AdaptiveColor{
		Dark:  darkRed,
		Light: lightRed,
	}
	theme.WarningColor = lipgloss.AdaptiveColor{
		Dark:  darkOrange,
		Light: lightOrange,
	}
	theme.SuccessColor = lipgloss.AdaptiveColor{
		Dark:  darkGreen,
		Light: lightGreen,
	}
	theme.InfoColor = lipgloss.AdaptiveColor{
		Dark:  darkBlue,
		Light: lightBlue,
	}

	// Text colors
	theme.TextColor = lipgloss.AdaptiveColor{
		Dark:  darkStep12,
		Light: lightStep12,
	}
	theme.TextMutedColor = lipgloss.AdaptiveColor{
		Dark:  darkStep11,
		Light: lightStep11,
	}

	// Background colors
	theme.BackgroundColor = lipgloss.AdaptiveColor{
		Dark:  darkStep1,
		Light: lightStep1,
	}
	theme.BackgroundSubtleColor = lipgloss.AdaptiveColor{
		Dark:  darkStep2,
		Light: lightStep2,
	}
	theme.BackgroundElementColor = lipgloss.AdaptiveColor{
		Dark:  darkStep3,
		Light: lightStep3,
	}

	// Border colors
	theme.BorderColor = lipgloss.AdaptiveColor{
		Dark:  darkStep7,
		Light: lightStep7,
	}
	theme.BorderActiveColor = lipgloss.AdaptiveColor{
		Dark:  darkStep8,
		Light: lightStep8,
	}
	theme.BorderSubtleColor = lipgloss.AdaptiveColor{
		Dark:  darkStep6,
		Light: lightStep6,
	}

	// Diff view colors
	theme.DiffAddedColor = lipgloss.AdaptiveColor{
		Dark:  "#4fd6be", // teal from palette
		Light: "#1e725c",
	}
	theme.DiffRemovedColor = lipgloss.AdaptiveColor{
		Dark:  "#c53b53", // red1 from palette
		Light: "#c53b53",
	}
	theme.DiffContextColor = lipgloss.AdaptiveColor{
		Dark:  "#828bb8", // fg_dark from palette
		Light: "#7086b5",
	}
	theme.DiffHunkHeaderColor = lipgloss.AdaptiveColor{
		Dark:  "#828bb8", // fg_dark from palette
		Light: "#7086b5",
	}
	theme.DiffHighlightAddedColor = lipgloss.AdaptiveColor{
		Dark:  "#b8db87", // git.add from palette
		Light: "#4db380",
	}
	theme.DiffHighlightRemovedColor = lipgloss.AdaptiveColor{
		Dark:  "#e26a75", // git.delete from palette
		Light: "#f52a65",
	}
	theme.DiffAddedBgColor = lipgloss.AdaptiveColor{
		Dark:  "#20303b",
		Light: "#d5e5d5",
	}
	theme.DiffRemovedBgColor = lipgloss.AdaptiveColor{
		Dark:  "#37222c",
		Light: "#f7d8db",
	}
	theme.DiffContextBgColor = lipgloss.AdaptiveColor{
		Dark:  darkStep2,
		Light: lightStep2,
	}
	theme.DiffLineNumberColor = lipgloss.AdaptiveColor{
		Dark:  darkStep3, // dark3 from palette
		Light: lightStep3,
	}
	theme.DiffAddedLineNumberBgColor = lipgloss.AdaptiveColor{
		Dark:  "#1b2b34",
		Light: "#c5d5c5",
	}
	theme.DiffRemovedLineNumberBgColor = lipgloss.AdaptiveColor{
		Dark:  "#2d1f26",
		Light: "#e7c8cb",
	}

	// Markdown colors
	theme.MarkdownTextColor = lipgloss.AdaptiveColor{
		Dark:  darkStep12,
		Light: lightStep12,
	}
	theme.MarkdownHeadingColor = lipgloss.AdaptiveColor{
		Dark:  darkPurple,
		Light: lightPurple,
	}
	theme.MarkdownLinkColor = lipgloss.AdaptiveColor{
		Dark:  darkBlue,
		Light: lightBlue,
	}
	theme.MarkdownLinkTextColor = lipgloss.AdaptiveColor{
		Dark:  darkCyan,
		Light: lightCyan,
	}
	theme.MarkdownCodeColor = lipgloss.AdaptiveColor{
		Dark:  darkGreen,
		Light: lightGreen,
	}
	theme.MarkdownBlockQuoteColor = lipgloss.AdaptiveColor{
		Dark:  darkYellow,
		Light: lightYellow,
	}
	theme.MarkdownEmphColor = lipgloss.AdaptiveColor{
		Dark:  darkYellow,
		Light: lightYellow,
	}
	theme.MarkdownStrongColor = lipgloss.AdaptiveColor{
		Dark:  darkOrange,
		Light: lightOrange,
	}
	theme.MarkdownHorizontalRuleColor = lipgloss.AdaptiveColor{
		Dark:  darkStep11,
		Light: lightStep11,
	}
	theme.MarkdownListItemColor = lipgloss.AdaptiveColor{
		Dark:  darkBlue,
		Light: lightBlue,
	}
	theme.MarkdownListEnumerationColor = lipgloss.AdaptiveColor{
		Dark:  darkCyan,
		Light: lightCyan,
	}
	theme.MarkdownImageColor = lipgloss.AdaptiveColor{
		Dark:  darkBlue,
		Light: lightBlue,
	}
	theme.MarkdownImageTextColor = lipgloss.AdaptiveColor{
		Dark:  darkCyan,
		Light: lightCyan,
	}
	theme.MarkdownCodeBlockColor = lipgloss.AdaptiveColor{
		Dark:  darkStep12,
		Light: lightStep12,
	}

	// Syntax highlighting colors
	theme.SyntaxCommentColor = lipgloss.AdaptiveColor{
		Dark:  darkStep11,
		Light: lightStep11,
	}
	theme.SyntaxKeywordColor = lipgloss.AdaptiveColor{
		Dark:  darkPurple,
		Light: lightPurple,
	}
	theme.SyntaxFunctionColor = lipgloss.AdaptiveColor{
		Dark:  darkBlue,
		Light: lightBlue,
	}
	theme.SyntaxVariableColor = lipgloss.AdaptiveColor{
		Dark:  darkRed,
		Light: lightRed,
	}
	theme.SyntaxStringColor = lipgloss.AdaptiveColor{
		Dark:  darkGreen,
		Light: lightGreen,
	}
	theme.SyntaxNumberColor = lipgloss.AdaptiveColor{
		Dark:  darkOrange,
		Light: lightOrange,
	}
	theme.SyntaxTypeColor = lipgloss.AdaptiveColor{
		Dark:  darkYellow,
		Light: lightYellow,
	}
	theme.SyntaxOperatorColor = lipgloss.AdaptiveColor{
		Dark:  darkCyan,
		Light: lightCyan,
	}
	theme.SyntaxPunctuationColor = lipgloss.AdaptiveColor{
		Dark:  darkStep12,
		Light: lightStep12,
	}

	return theme
}

func init() {
	// Register the Tokyo Night theme with the theme manager
	RegisterTheme("tokyonight", NewTokyoNightTheme())
}
