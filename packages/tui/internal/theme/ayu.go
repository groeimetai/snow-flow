package theme

import (
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
)

// AyuTheme implements the Theme interface with Ayu Dark colors.
// It provides a modern dark theme inspired by the Ayu color scheme.
type AyuTheme struct {
	BaseTheme
}

// NewAyuTheme creates a new instance of the Ayu Dark theme.
func NewAyuTheme() *AyuTheme {
	// Ayu Dark color palette
	// Base background colors
	darkBg := "#0B0E14"    // App background
	darkBgAlt := "#0D1017" // Editor background
	darkLine := "#11151C"  // UI line separators
	darkPanel := "#0F131A" // UI panel background

	// Text colors
	darkFg := "#BFBDB6"      // Primary text
	darkFgMuted := "#565B66" // Muted text
	darkGutter := "#6C7380"  // Gutter text

	// Syntax highlighting colors
	darkTag := "#39BAE6"      // Tags and attributes
	darkFunc := "#FFB454"     // Functions
	darkEntity := "#59C2FF"   // Entities and variables
	darkString := "#AAD94C"   // Strings
	darkRegexp := "#95E6CB"   // Regular expressions
	darkMarkup := "#F07178"   // Markup elements
	darkKeyword := "#FF8F40"  // Keywords
	darkSpecial := "#E6B673"  // Special characters
	darkComment := "#ACB6BF"  // Comments
	darkConstant := "#D2A6FF" // Constants
	darkOperator := "#F29668" // Operators

	// Version control colors
	darkAdded := "#7FD962"   // Added lines
	darkRemoved := "#F26D78" // Removed lines

	// Accent colors
	darkAccent := "#E6B450" // Primary accent
	darkError := "#D95757"  // Error color

	// Active state colors
	darkIndentActive := "#6C7380" // Active indent guides

	theme := &AyuTheme{}

	// Base colors
	theme.PrimaryColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkEntity),
		Light: lipgloss.Color(darkEntity),
	}
	theme.SecondaryColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkConstant),
		Light: lipgloss.Color(darkConstant),
	}
	theme.AccentColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkAccent),
		Light: lipgloss.Color(darkAccent),
	}

	// Status colors
	theme.ErrorColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkError),
		Light: lipgloss.Color(darkError),
	}
	theme.WarningColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkSpecial),
		Light: lipgloss.Color(darkSpecial),
	}
	theme.SuccessColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkAdded),
		Light: lipgloss.Color(darkAdded),
	}
	theme.InfoColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkTag),
		Light: lipgloss.Color(darkTag),
	}

	// Text colors
	theme.TextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkFg),
		Light: lipgloss.Color(darkFg),
	}
	theme.TextMutedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkFgMuted),
		Light: lipgloss.Color(darkFgMuted),
	}

	// Background colors
	theme.BackgroundColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkBg),
		Light: lipgloss.Color(darkBg),
	}
	theme.BackgroundSubtleColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkBgAlt),
		Light: lipgloss.Color(darkBgAlt),
	}
	theme.BackgroundElementColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkPanel),
		Light: lipgloss.Color(darkPanel),
	}

	// Border colors
	theme.BorderColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkGutter),
		Light: lipgloss.Color(darkGutter),
	}
	theme.BorderActiveColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkIndentActive),
		Light: lipgloss.Color(darkIndentActive),
	}
	theme.BorderSubtleColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkLine),
		Light: lipgloss.Color(darkLine),
	}

	// Diff view colors
	theme.DiffAddedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkAdded),
		Light: lipgloss.Color(darkAdded),
	}
	theme.DiffRemovedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkRemoved),
		Light: lipgloss.Color(darkRemoved),
	}
	theme.DiffContextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkFgMuted),
		Light: lipgloss.Color(darkFgMuted),
	}
	theme.DiffHunkHeaderColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkGutter),
		Light: lipgloss.Color(darkGutter),
	}
	theme.DiffHighlightAddedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkAdded),
		Light: lipgloss.Color(darkAdded),
	}
	theme.DiffHighlightRemovedColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkRemoved),
		Light: lipgloss.Color(darkRemoved),
	}
	theme.DiffAddedBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#1a2b1a"),
		Light: lipgloss.Color("#1a2b1a"),
	}
	theme.DiffRemovedBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#2b1a1a"),
		Light: lipgloss.Color("#2b1a1a"),
	}
	theme.DiffContextBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkBgAlt),
		Light: lipgloss.Color(darkBgAlt),
	}
	theme.DiffLineNumberColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkGutter),
		Light: lipgloss.Color(darkGutter),
	}
	theme.DiffAddedLineNumberBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#152b15"),
		Light: lipgloss.Color("#152b15"),
	}
	theme.DiffRemovedLineNumberBgColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color("#2b1515"),
		Light: lipgloss.Color("#2b1515"),
	}

	// Markdown colors
	theme.MarkdownTextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkFg),
		Light: lipgloss.Color(darkFg),
	}
	theme.MarkdownHeadingColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkFunc),
		Light: lipgloss.Color(darkFunc),
	}
	theme.MarkdownLinkColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkTag),
		Light: lipgloss.Color(darkTag),
	}
	theme.MarkdownLinkTextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkEntity),
		Light: lipgloss.Color(darkEntity),
	}
	theme.MarkdownCodeColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkString),
		Light: lipgloss.Color(darkString),
	}
	theme.MarkdownBlockQuoteColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkSpecial),
		Light: lipgloss.Color(darkSpecial),
	}
	theme.MarkdownEmphColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkKeyword),
		Light: lipgloss.Color(darkKeyword),
	}
	theme.MarkdownStrongColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkMarkup),
		Light: lipgloss.Color(darkMarkup),
	}
	theme.MarkdownHorizontalRuleColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkGutter),
		Light: lipgloss.Color(darkGutter),
	}
	theme.MarkdownListItemColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkOperator),
		Light: lipgloss.Color(darkOperator),
	}
	theme.MarkdownListEnumerationColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkConstant),
		Light: lipgloss.Color(darkConstant),
	}
	theme.MarkdownImageColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkRegexp),
		Light: lipgloss.Color(darkRegexp),
	}
	theme.MarkdownImageTextColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkEntity),
		Light: lipgloss.Color(darkEntity),
	}
	theme.MarkdownCodeBlockColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkString),
		Light: lipgloss.Color(darkString),
	}

	// Syntax highlighting colors
	theme.SyntaxCommentColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkComment),
		Light: lipgloss.Color(darkComment),
	}
	theme.SyntaxKeywordColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkKeyword),
		Light: lipgloss.Color(darkKeyword),
	}
	theme.SyntaxFunctionColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkFunc),
		Light: lipgloss.Color(darkFunc),
	}
	theme.SyntaxVariableColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkEntity),
		Light: lipgloss.Color(darkEntity),
	}
	theme.SyntaxStringColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkString),
		Light: lipgloss.Color(darkString),
	}
	theme.SyntaxNumberColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkConstant),
		Light: lipgloss.Color(darkConstant),
	}
	theme.SyntaxTypeColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkSpecial),
		Light: lipgloss.Color(darkSpecial),
	}
	theme.SyntaxOperatorColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkOperator),
		Light: lipgloss.Color(darkOperator),
	}
	theme.SyntaxPunctuationColor = compat.AdaptiveColor{
		Dark:  lipgloss.Color(darkFg),
		Light: lipgloss.Color(darkFg),
	}

	return theme
}

func init() {
	// Register the Ayu theme with the theme manager
	RegisterTheme("ayu", NewAyuTheme())
}
