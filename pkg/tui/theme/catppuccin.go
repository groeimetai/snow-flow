package theme

import (
	catppuccin "github.com/catppuccin/go"
	"github.com/charmbracelet/lipgloss"
)

// CatppuccinTheme implements the Theme interface with Catppuccin colors.
// It provides both dark (Mocha) and light (Latte) variants.
type CatppuccinTheme struct {
	BaseTheme
}

// NewCatppuccinTheme creates a new instance of the Catppuccin theme.
func NewCatppuccinTheme() *CatppuccinTheme {
	// Get the Catppuccin palettes
	mocha := catppuccin.Mocha
	latte := catppuccin.Latte

	theme := &CatppuccinTheme{}

	// Base colors
	theme.PrimaryColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Blue().Hex,
		Light: latte.Blue().Hex,
	}
	theme.SecondaryColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Mauve().Hex,
		Light: latte.Mauve().Hex,
	}
	theme.AccentColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Peach().Hex,
		Light: latte.Peach().Hex,
	}

	// Status colors
	theme.ErrorColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Red().Hex,
		Light: latte.Red().Hex,
	}
	theme.WarningColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Peach().Hex,
		Light: latte.Peach().Hex,
	}
	theme.SuccessColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Green().Hex,
		Light: latte.Green().Hex,
	}
	theme.InfoColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Blue().Hex,
		Light: latte.Blue().Hex,
	}

	// Text colors
	theme.TextColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Text().Hex,
		Light: latte.Text().Hex,
	}
	theme.TextMutedColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Subtext0().Hex,
		Light: latte.Subtext0().Hex,
	}
	theme.TextEmphasizedColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Lavender().Hex,
		Light: latte.Lavender().Hex,
	}

	// Background colors
	theme.BackgroundColor = lipgloss.AdaptiveColor{
		Dark:  "#212121", // From existing styles
		Light: "#EEEEEE", // Light equivalent
	}
	theme.BackgroundSecondaryColor = lipgloss.AdaptiveColor{
		Dark:  "#2c2c2c", // From existing styles
		Light: "#E0E0E0", // Light equivalent
	}
	theme.BackgroundDarkerColor = lipgloss.AdaptiveColor{
		Dark:  "#181818", // From existing styles
		Light: "#F5F5F5", // Light equivalent
	}

	// Border colors
	theme.BorderNormalColor = lipgloss.AdaptiveColor{
		Dark:  "#4b4c5c", // From existing styles
		Light: "#BDBDBD", // Light equivalent
	}
	theme.BorderFocusedColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Blue().Hex,
		Light: latte.Blue().Hex,
	}
	theme.BorderDimColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Surface0().Hex,
		Light: latte.Surface0().Hex,
	}

	// Diff view colors
	theme.DiffAddedColor = lipgloss.AdaptiveColor{
		Dark:  "#478247", // From existing diff.go
		Light: "#2E7D32", // Light equivalent
	}
	theme.DiffRemovedColor = lipgloss.AdaptiveColor{
		Dark:  "#7C4444", // From existing diff.go
		Light: "#C62828", // Light equivalent
	}
	theme.DiffContextColor = lipgloss.AdaptiveColor{
		Dark:  "#a0a0a0", // From existing diff.go
		Light: "#757575", // Light equivalent
	}
	theme.DiffHunkHeaderColor = lipgloss.AdaptiveColor{
		Dark:  "#a0a0a0", // From existing diff.go
		Light: "#757575", // Light equivalent
	}
	theme.DiffHighlightAddedColor = lipgloss.AdaptiveColor{
		Dark:  "#DAFADA", // From existing diff.go
		Light: "#A5D6A7", // Light equivalent
	}
	theme.DiffHighlightRemovedColor = lipgloss.AdaptiveColor{
		Dark:  "#FADADD", // From existing diff.go
		Light: "#EF9A9A", // Light equivalent
	}
	theme.DiffAddedBgColor = lipgloss.AdaptiveColor{
		Dark:  "#303A30", // From existing diff.go
		Light: "#E8F5E9", // Light equivalent
	}
	theme.DiffRemovedBgColor = lipgloss.AdaptiveColor{
		Dark:  "#3A3030", // From existing diff.go
		Light: "#FFEBEE", // Light equivalent
	}
	theme.DiffContextBgColor = lipgloss.AdaptiveColor{
		Dark:  "#212121", // From existing diff.go
		Light: "#F5F5F5", // Light equivalent
	}
	theme.DiffLineNumberColor = lipgloss.AdaptiveColor{
		Dark:  "#888888", // From existing diff.go
		Light: "#9E9E9E", // Light equivalent
	}
	theme.DiffAddedLineNumberBgColor = lipgloss.AdaptiveColor{
		Dark:  "#293229", // From existing diff.go
		Light: "#C8E6C9", // Light equivalent
	}
	theme.DiffRemovedLineNumberBgColor = lipgloss.AdaptiveColor{
		Dark:  "#332929", // From existing diff.go
		Light: "#FFCDD2", // Light equivalent
	}

	// Markdown colors
	theme.MarkdownTextColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Text().Hex,
		Light: latte.Text().Hex,
	}
	theme.MarkdownHeadingColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Mauve().Hex,
		Light: latte.Mauve().Hex,
	}
	theme.MarkdownLinkColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Sky().Hex,
		Light: latte.Sky().Hex,
	}
	theme.MarkdownLinkTextColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Pink().Hex,
		Light: latte.Pink().Hex,
	}
	theme.MarkdownCodeColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Green().Hex,
		Light: latte.Green().Hex,
	}
	theme.MarkdownBlockQuoteColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Yellow().Hex,
		Light: latte.Yellow().Hex,
	}
	theme.MarkdownEmphColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Yellow().Hex,
		Light: latte.Yellow().Hex,
	}
	theme.MarkdownStrongColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Peach().Hex,
		Light: latte.Peach().Hex,
	}
	theme.MarkdownHorizontalRuleColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Overlay0().Hex,
		Light: latte.Overlay0().Hex,
	}
	theme.MarkdownListItemColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Blue().Hex,
		Light: latte.Blue().Hex,
	}
	theme.MarkdownListEnumerationColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Sky().Hex,
		Light: latte.Sky().Hex,
	}
	theme.MarkdownImageColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Sapphire().Hex,
		Light: latte.Sapphire().Hex,
	}
	theme.MarkdownImageTextColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Pink().Hex,
		Light: latte.Pink().Hex,
	}
	theme.MarkdownCodeBlockColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Text().Hex,
		Light: latte.Text().Hex,
	}

	// Syntax highlighting colors
	theme.SyntaxCommentColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Overlay1().Hex,
		Light: latte.Overlay1().Hex,
	}
	theme.SyntaxKeywordColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Pink().Hex,
		Light: latte.Pink().Hex,
	}
	theme.SyntaxFunctionColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Green().Hex,
		Light: latte.Green().Hex,
	}
	theme.SyntaxVariableColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Sky().Hex,
		Light: latte.Sky().Hex,
	}
	theme.SyntaxStringColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Yellow().Hex,
		Light: latte.Yellow().Hex,
	}
	theme.SyntaxNumberColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Teal().Hex,
		Light: latte.Teal().Hex,
	}
	theme.SyntaxTypeColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Sky().Hex,
		Light: latte.Sky().Hex,
	}
	theme.SyntaxOperatorColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Pink().Hex,
		Light: latte.Pink().Hex,
	}
	theme.SyntaxPunctuationColor = lipgloss.AdaptiveColor{
		Dark:  mocha.Text().Hex,
		Light: latte.Text().Hex,
	}

	return theme
}

func init() {
	// Register the Catppuccin theme with the theme manager
	RegisterTheme("catppuccin", NewCatppuccinTheme())
}
