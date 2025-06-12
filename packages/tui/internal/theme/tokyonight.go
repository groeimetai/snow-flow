package theme

import (
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
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
	theme.PrimaryColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkBlue),
		Light: lipgloss.Color(lightBlue),
	}
	theme.SecondaryColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkPurple),
		Light: lipgloss.Color(lightPurple),
	}
	theme.AccentColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkOrange),
		Light: lipgloss.Color(lightOrange),
	}

	// Status colors
	theme.ErrorColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkRed),
		Light: lipgloss.Color(lightRed),
	}
	theme.WarningColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkOrange),
		Light: lipgloss.Color(lightOrange),
	}
	theme.SuccessColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkGreen),
		Light: lipgloss.Color(lightGreen),
	}
	theme.InfoColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkBlue),
		Light: lipgloss.Color(lightBlue),
	}

	// Text colors
	theme.TextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep12),
		Light: lipgloss.Color(lightStep12),
	}
	theme.TextMutedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep11),
		Light: lipgloss.Color(lightStep11),
	}

	// Background colors
	theme.BackgroundColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep1),
		Light: lipgloss.Color(lightStep1),
	}
	theme.BackgroundSubtleColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep2),
		Light: lipgloss.Color(lightStep2),
	}
	theme.BackgroundElementColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep3),
		Light: lipgloss.Color(lightStep3),
	}

	// Border colors
	theme.BorderColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep7),
		Light: lipgloss.Color(lightStep7),
	}
	theme.BorderActiveColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep8),
		Light: lipgloss.Color(lightStep8),
	}
	theme.BorderSubtleColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep6),
		Light: lipgloss.Color(lightStep6),
	}

	// Diff view colors
	theme.DiffAddedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#4fd6be"), // teal from palette
		Light: lipgloss.Color("#1e725c"),
	}
	theme.DiffRemovedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#c53b53"), // red1 from palette
		Light: lipgloss.Color("#c53b53"),
	}
	theme.DiffContextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#828bb8"), // fg_dark from palette
		Light: lipgloss.Color("#7086b5"),
	}
	theme.DiffHunkHeaderColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#828bb8"), // fg_dark from palette
		Light: lipgloss.Color("#7086b5"),
	}
	theme.DiffHighlightAddedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#b8db87"), // git.add from palette
		Light: lipgloss.Color("#4db380"),
	}
	theme.DiffHighlightRemovedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#e26a75"), // git.delete from palette
		Light: lipgloss.Color("#f52a65"),
	}
	theme.DiffAddedBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#20303b"),
		Light: lipgloss.Color("#d5e5d5"),
	}
	theme.DiffRemovedBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#37222c"),
		Light: lipgloss.Color("#f7d8db"),
	}
	theme.DiffContextBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep2),
		Light: lipgloss.Color(lightStep2),
	}
	theme.DiffLineNumberColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep3), // dark3 from palette
		Light: lipgloss.Color(lightStep3),
	}
	theme.DiffAddedLineNumberBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#1b2b34"),
		Light: lipgloss.Color("#c5d5c5"),
	}
	theme.DiffRemovedLineNumberBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#2d1f26"),
		Light: lipgloss.Color("#e7c8cb"),
	}

	// Markdown colors
	theme.MarkdownTextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep12),
		Light: lipgloss.Color(lightStep12),
	}
	theme.MarkdownHeadingColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkPurple),
		Light: lipgloss.Color(lightPurple),
	}
	theme.MarkdownLinkColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkBlue),
		Light: lipgloss.Color(lightBlue),
	}
	theme.MarkdownLinkTextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkCyan),
		Light: lipgloss.Color(lightCyan),
	}
	theme.MarkdownCodeColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkGreen),
		Light: lipgloss.Color(lightGreen),
	}
	theme.MarkdownBlockQuoteColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkYellow),
		Light: lipgloss.Color(lightYellow),
	}
	theme.MarkdownEmphColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkYellow),
		Light: lipgloss.Color(lightYellow),
	}
	theme.MarkdownStrongColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkOrange),
		Light: lipgloss.Color(lightOrange),
	}
	theme.MarkdownHorizontalRuleColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep11),
		Light: lipgloss.Color(lightStep11),
	}
	theme.MarkdownListItemColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkBlue),
		Light: lipgloss.Color(lightBlue),
	}
	theme.MarkdownListEnumerationColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkCyan),
		Light: lipgloss.Color(lightCyan),
	}
	theme.MarkdownImageColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkBlue),
		Light: lipgloss.Color(lightBlue),
	}
	theme.MarkdownImageTextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkCyan),
		Light: lipgloss.Color(lightCyan),
	}
	theme.MarkdownCodeBlockColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep12),
		Light: lipgloss.Color(lightStep12),
	}

	// Syntax highlighting colors
	theme.SyntaxCommentColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep11),
		Light: lipgloss.Color(lightStep11),
	}
	theme.SyntaxKeywordColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkPurple),
		Light: lipgloss.Color(lightPurple),
	}
	theme.SyntaxFunctionColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkBlue),
		Light: lipgloss.Color(lightBlue),
	}
	theme.SyntaxVariableColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkRed),
		Light: lipgloss.Color(lightRed),
	}
	theme.SyntaxStringColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkGreen),
		Light: lipgloss.Color(lightGreen),
	}
	theme.SyntaxNumberColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkOrange),
		Light: lipgloss.Color(lightOrange),
	}
	theme.SyntaxTypeColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkYellow),
		Light: lipgloss.Color(lightYellow),
	}
	theme.SyntaxOperatorColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkCyan),
		Light: lipgloss.Color(lightCyan),
	}
	theme.SyntaxPunctuationColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep12),
		Light: lipgloss.Color(lightStep12),
	}

	return theme
}

func init() {
	// Register the Tokyo Night theme with the theme manager
	RegisterTheme("tokyonight", NewTokyoNightTheme())
}
