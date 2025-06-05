package theme

import (
	"github.com/charmbracelet/lipgloss"
)

// OpenCodeTheme implements the Theme interface with OpenCode brand colors.
// It provides both dark and light variants.
type OpenCodeTheme struct {
	BaseTheme
}

// NewOpenCodeTheme creates a new instance of the OpenCode theme.
func NewOpenCodeTheme() *OpenCodeTheme {
	// OpenCode color palette with Radix-inspired scale progression
	// Dark mode colors - using a neutral gray scale as base
	darkStep1 := "#0a0a0a"  // App background
	darkStep2 := "#141414"  // Subtle background
	darkStep3 := "#1e1e1e"  // UI element background
	darkStep4 := "#282828"  // Hovered UI element background
	darkStep5 := "#323232"  // Active/Selected UI element background
	darkStep6 := "#3c3c3c"  // Subtle borders and separators
	darkStep7 := "#484848"  // UI element border and focus rings
	darkStep8 := "#606060"  // Hovered UI element border
	darkStep9 := "#fab283"  // Solid backgrounds (primary orange/gold)
	darkStep10 := "#ffc09f" // Hovered solid backgrounds
	darkStep11 := "#808080" // Low-contrast text (more muted)
	darkStep12 := "#eeeeee" // High-contrast text

	// Dark mode accent colors
	darkPrimary := darkStep9   // Primary uses step 9 (solid background)
	darkSecondary := "#5c9cf5" // Secondary blue
	darkAccent := "#9d7cd8"    // Accent purple
	darkRed := "#e06c75"       // Error red
	darkOrange := "#f5a742"    // Warning orange
	darkGreen := "#7fd88f"     // Success green
	darkCyan := "#56b6c2"      // Info cyan
	darkYellow := "#e5c07b"    // Emphasized text

	// Light mode colors - using a neutral gray scale as base
	lightStep1 := "#ffffff"  // App background
	lightStep2 := "#fafafa"  // Subtle background
	lightStep3 := "#f5f5f5"  // UI element background
	lightStep4 := "#ebebeb"  // Hovered UI element background
	lightStep5 := "#e1e1e1"  // Active/Selected UI element background
	lightStep6 := "#d4d4d4"  // Subtle borders and separators
	lightStep7 := "#b8b8b8"  // UI element border and focus rings
	lightStep8 := "#a0a0a0"  // Hovered UI element border
	lightStep9 := "#3b7dd8"  // Solid backgrounds (primary blue)
	lightStep10 := "#2968c3" // Hovered solid backgrounds
	lightStep11 := "#8a8a8a" // Low-contrast text (more muted)
	lightStep12 := "#1a1a1a" // High-contrast text

	// Light mode accent colors
	lightPrimary := lightStep9  // Primary uses step 9 (solid background)
	lightSecondary := "#7b5bb6" // Secondary purple
	lightAccent := "#d68c27"    // Accent orange/gold
	lightRed := "#d1383d"       // Error red
	lightOrange := "#d68c27"    // Warning orange
	lightGreen := "#3d9a57"     // Success green
	lightCyan := "#318795"      // Info cyan
	lightYellow := "#b0851f"    // Emphasized text

	// Unused variables to avoid compiler errors (these could be used for hover states)
	_ = darkStep4
	_ = darkStep5
	_ = darkStep10
	_ = lightStep4
	_ = lightStep5
	_ = lightStep10

	theme := &OpenCodeTheme{}

	// Base colors
	theme.PrimaryColor = lipgloss.AdaptiveColor{
		Dark:  darkPrimary,
		Light: lightPrimary,
	}
	theme.SecondaryColor = lipgloss.AdaptiveColor{
		Dark:  darkSecondary,
		Light: lightSecondary,
	}
	theme.AccentColor = lipgloss.AdaptiveColor{
		Dark:  darkAccent,
		Light: lightAccent,
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
		Dark:  darkCyan,
		Light: lightCyan,
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
		Dark:  "#478247",
		Light: "#2E7D32",
	}
	theme.DiffRemovedColor = lipgloss.AdaptiveColor{
		Dark:  "#7C4444",
		Light: "#C62828",
	}
	theme.DiffContextColor = lipgloss.AdaptiveColor{
		Dark:  "#a0a0a0",
		Light: "#757575",
	}
	theme.DiffHunkHeaderColor = lipgloss.AdaptiveColor{
		Dark:  "#a0a0a0",
		Light: "#757575",
	}
	theme.DiffHighlightAddedColor = lipgloss.AdaptiveColor{
		Dark:  "#DAFADA",
		Light: "#A5D6A7",
	}
	theme.DiffHighlightRemovedColor = lipgloss.AdaptiveColor{
		Dark:  "#FADADD",
		Light: "#EF9A9A",
	}
	theme.DiffAddedBgColor = lipgloss.AdaptiveColor{
		Dark:  "#303A30",
		Light: "#E8F5E9",
	}
	theme.DiffRemovedBgColor = lipgloss.AdaptiveColor{
		Dark:  "#3A3030",
		Light: "#FFEBEE",
	}
	theme.DiffContextBgColor = lipgloss.AdaptiveColor{
		Dark:  darkStep2,
		Light: lightStep2,
	}
	theme.DiffLineNumberColor = lipgloss.AdaptiveColor{
		Dark:  darkStep3,
		Light: lightStep3,
	}
	theme.DiffAddedLineNumberBgColor = lipgloss.AdaptiveColor{
		Dark:  "#293229",
		Light: "#C8E6C9",
	}
	theme.DiffRemovedLineNumberBgColor = lipgloss.AdaptiveColor{
		Dark:  "#332929",
		Light: "#FFCDD2",
	}

	// Markdown colors
	theme.MarkdownTextColor = lipgloss.AdaptiveColor{
		Dark:  darkStep12,
		Light: lightStep12,
	}
	theme.MarkdownHeadingColor = lipgloss.AdaptiveColor{
		Dark:  darkSecondary,
		Light: lightSecondary,
	}
	theme.MarkdownLinkColor = lipgloss.AdaptiveColor{
		Dark:  darkPrimary,
		Light: lightPrimary,
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
		Dark:  darkAccent,
		Light: lightAccent,
	}
	theme.MarkdownHorizontalRuleColor = lipgloss.AdaptiveColor{
		Dark:  darkStep11,
		Light: lightStep11,
	}
	theme.MarkdownListItemColor = lipgloss.AdaptiveColor{
		Dark:  darkPrimary,
		Light: lightPrimary,
	}
	theme.MarkdownListEnumerationColor = lipgloss.AdaptiveColor{
		Dark:  darkCyan,
		Light: lightCyan,
	}
	theme.MarkdownImageColor = lipgloss.AdaptiveColor{
		Dark:  darkPrimary,
		Light: lightPrimary,
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
		Dark:  darkSecondary,
		Light: lightSecondary,
	}
	theme.SyntaxFunctionColor = lipgloss.AdaptiveColor{
		Dark:  darkPrimary,
		Light: lightPrimary,
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
		Dark:  darkAccent,
		Light: lightAccent,
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
	// Register the OpenCode theme with the theme manager
	RegisterTheme("opencode", NewOpenCodeTheme())
}
