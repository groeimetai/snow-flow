package theme

import (
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
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
	theme.PrimaryColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkPrimary),
		Light: lipgloss.Color(lightPrimary),
	}
	theme.SecondaryColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkSecondary),
		Light: lipgloss.Color(lightSecondary),
	}
	theme.AccentColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkAccent),
		Light: lipgloss.Color(lightAccent),
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
		Dark:  lipgloss.Color(darkCyan),
		Light: lipgloss.Color(lightCyan),
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
		Dark:  lipgloss.Color("#478247"),
		Light: lipgloss.Color("#2E7D32"),
	}
	theme.DiffRemovedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#7C4444"),
		Light: lipgloss.Color("#C62828"),
	}
	theme.DiffContextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#a0a0a0"),
		Light: lipgloss.Color("#757575"),
	}
	theme.DiffHunkHeaderColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#a0a0a0"),
		Light: lipgloss.Color("#757575"),
	}
	theme.DiffHighlightAddedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#DAFADA"),
		Light: lipgloss.Color("#A5D6A7"),
	}
	theme.DiffHighlightRemovedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#FADADD"),
		Light: lipgloss.Color("#EF9A9A"),
	}
	theme.DiffAddedBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#303A30"),
		Light: lipgloss.Color("#E8F5E9"),
	}
	theme.DiffRemovedBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#3A3030"),
		Light: lipgloss.Color("#FFEBEE"),
	}
	theme.DiffContextBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep2),
		Light: lipgloss.Color(lightStep2),
	}
	theme.DiffLineNumberColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep3),
		Light: lipgloss.Color(lightStep3),
	}
	theme.DiffAddedLineNumberBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#293229"),
		Light: lipgloss.Color("#C8E6C9"),
	}
	theme.DiffRemovedLineNumberBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#332929"),
		Light: lipgloss.Color("#FFCDD2"),
	}

	// Markdown colors
	theme.MarkdownTextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep12),
		Light: lipgloss.Color(lightStep12),
	}
	theme.MarkdownHeadingColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkSecondary),
		Light: lipgloss.Color(lightSecondary),
	}
	theme.MarkdownLinkColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkPrimary),
		Light: lipgloss.Color(lightPrimary),
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
		Dark:  lipgloss.Color(darkAccent),
		Light: lipgloss.Color(lightAccent),
	}
	theme.MarkdownHorizontalRuleColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkStep11),
		Light: lipgloss.Color(lightStep11),
	}
	theme.MarkdownListItemColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkPrimary),
		Light: lipgloss.Color(lightPrimary),
	}
	theme.MarkdownListEnumerationColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkCyan),
		Light: lipgloss.Color(lightCyan),
	}
	theme.MarkdownImageColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkPrimary),
		Light: lipgloss.Color(lightPrimary),
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
		Dark:  lipgloss.Color(darkPrimary),
		Light: lipgloss.Color(lightPrimary),
	}
	theme.SyntaxFunctionColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkPrimary),
		Light: lipgloss.Color(lightPrimary),
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
		Dark:  lipgloss.Color(darkAccent),
		Light: lipgloss.Color(lightAccent),
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
	// Register the OpenCode theme with the theme manager
	RegisterTheme("opencode", NewOpenCodeTheme())
}
