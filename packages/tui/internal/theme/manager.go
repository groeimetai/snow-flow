package theme

import (
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"

	"github.com/alecthomas/chroma/v2/styles"
	// "github.com/alecthomas/chroma/v2/styles"
)

// Manager handles theme registration, selection, and retrieval.
// It maintains a registry of available themes and tracks the currently active theme.
type Manager struct {
	themes      map[string]Theme
	currentName string
	mu          sync.RWMutex
}

// Global instance of the theme manager
var globalManager = &Manager{
	themes:      make(map[string]Theme),
	currentName: "",
}

// Default theme instance for custom theme defaulting
var defaultThemeColors = NewOpenCodeTheme()

// RegisterTheme adds a new theme to the registry.
// If this is the first theme registered, it becomes the default.
func RegisterTheme(name string, theme Theme) {
	globalManager.mu.Lock()
	defer globalManager.mu.Unlock()

	globalManager.themes[name] = theme

	// If this is the first theme, make it the default
	if globalManager.currentName == "" {
		globalManager.currentName = name
	}
}

// SetTheme changes the active theme to the one with the specified name.
// Returns an error if the theme doesn't exist.
func SetTheme(name string) error {
	globalManager.mu.Lock()
	defer globalManager.mu.Unlock()
	delete(styles.Registry, "charm")

	if _, exists := globalManager.themes[name]; !exists {
		return fmt.Errorf("theme '%s' not found", name)
	}

	globalManager.currentName = name

	return nil
}

// CurrentTheme returns the currently active theme.
// If no theme is set, it returns nil.
func CurrentTheme() Theme {
	globalManager.mu.RLock()
	defer globalManager.mu.RUnlock()

	if globalManager.currentName == "" {
		return nil
	}

	return globalManager.themes[globalManager.currentName]
}

// CurrentThemeName returns the name of the currently active theme.
func CurrentThemeName() string {
	globalManager.mu.RLock()
	defer globalManager.mu.RUnlock()

	return globalManager.currentName
}

// AvailableThemes returns a list of all registered theme names.
func AvailableThemes() []string {
	globalManager.mu.RLock()
	defer globalManager.mu.RUnlock()

	names := make([]string, 0, len(globalManager.themes))
	for name := range globalManager.themes {
		names = append(names, name)
	}
	slices.SortFunc(names, func(a, b string) int {
		if a == "opencode" {
			return -1
		} else if b == "opencode" {
			return 1
		}
		return strings.Compare(a, b)
	})
	return names
}

// GetTheme returns a specific theme by name.
// Returns nil if the theme doesn't exist.
func GetTheme(name string) Theme {
	globalManager.mu.RLock()
	defer globalManager.mu.RUnlock()

	return globalManager.themes[name]
}

// LoadCustomTheme creates a new theme instance based on the custom theme colors
// defined in the configuration. It uses the default OpenCode theme as a base
// and overrides colors that are specified in the customTheme map.
func LoadCustomTheme(customTheme map[string]any) (Theme, error) {
	// Create a new theme based on the default OpenCode theme
	theme := NewOpenCodeTheme()

	// Process each color in the custom theme map
	for key, value := range customTheme {
		adaptiveColor, err := ParseAdaptiveColor(value)
		if err != nil {
			slog.Warn("Invalid color definition in custom theme", "key", key, "error", err)
			continue // Skip this color but continue processing others
		}

		// Set the color in the theme based on the key
		switch strings.ToLower(key) {
		case "primary":
			theme.PrimaryColor = adaptiveColor
		case "secondary":
			theme.SecondaryColor = adaptiveColor
		case "accent":
			theme.AccentColor = adaptiveColor
		case "error":
			theme.ErrorColor = adaptiveColor
		case "warning":
			theme.WarningColor = adaptiveColor
		case "success":
			theme.SuccessColor = adaptiveColor
		case "info":
			theme.InfoColor = adaptiveColor
		case "text":
			theme.TextColor = adaptiveColor
		case "textmuted":
			theme.TextMutedColor = adaptiveColor
		case "background":
			theme.BackgroundColor = adaptiveColor
		case "backgroundsubtle":
			theme.BackgroundSubtleColor = adaptiveColor
		case "backgroundelement":
			theme.BackgroundElementColor = adaptiveColor
		case "border":
			theme.BorderColor = adaptiveColor
		case "borderactive":
			theme.BorderActiveColor = adaptiveColor
		case "bordersubtle":
			theme.BorderSubtleColor = adaptiveColor
		case "diffadded":
			theme.DiffAddedColor = adaptiveColor
		case "diffremoved":
			theme.DiffRemovedColor = adaptiveColor
		case "diffcontext":
			theme.DiffContextColor = adaptiveColor
		case "diffhunkheader":
			theme.DiffHunkHeaderColor = adaptiveColor
		case "diffhighlightadded":
			theme.DiffHighlightAddedColor = adaptiveColor
		case "diffhighlightremoved":
			theme.DiffHighlightRemovedColor = adaptiveColor
		case "diffaddedbg":
			theme.DiffAddedBgColor = adaptiveColor
		case "diffremovedbg":
			theme.DiffRemovedBgColor = adaptiveColor
		case "diffcontextbg":
			theme.DiffContextBgColor = adaptiveColor
		case "difflinenumber":
			theme.DiffLineNumberColor = adaptiveColor
		case "diffaddedlinenumberbg":
			theme.DiffAddedLineNumberBgColor = adaptiveColor
		case "diffremovedlinenumberbg":
			theme.DiffRemovedLineNumberBgColor = adaptiveColor
		case "syntaxcomment":
			theme.SyntaxCommentColor = adaptiveColor
		case "syntaxkeyword":
			theme.SyntaxKeywordColor = adaptiveColor
		case "syntaxfunction":
			theme.SyntaxFunctionColor = adaptiveColor
		case "syntaxvariable":
			theme.SyntaxVariableColor = adaptiveColor
		case "syntaxstring":
			theme.SyntaxStringColor = adaptiveColor
		case "syntaxnumber":
			theme.SyntaxNumberColor = adaptiveColor
		case "syntaxtype":
			theme.SyntaxTypeColor = adaptiveColor
		case "syntaxoperator":
			theme.SyntaxOperatorColor = adaptiveColor
		case "syntaxpunctuation":
			theme.SyntaxPunctuationColor = adaptiveColor
		case "markdowntext":
			theme.MarkdownTextColor = adaptiveColor
		case "markdownheading":
			theme.MarkdownHeadingColor = adaptiveColor
		case "markdownlink":
			theme.MarkdownLinkColor = adaptiveColor
		case "markdownlinktext":
			theme.MarkdownLinkTextColor = adaptiveColor
		case "markdowncode":
			theme.MarkdownCodeColor = adaptiveColor
		case "markdownblockquote":
			theme.MarkdownBlockQuoteColor = adaptiveColor
		case "markdownemph":
			theme.MarkdownEmphColor = adaptiveColor
		case "markdownstrong":
			theme.MarkdownStrongColor = adaptiveColor
		case "markdownhorizontalrule":
			theme.MarkdownHorizontalRuleColor = adaptiveColor
		case "markdownlistitem":
			theme.MarkdownListItemColor = adaptiveColor
		case "markdownlistitemenum":
			theme.MarkdownListEnumerationColor = adaptiveColor
		case "markdownimage":
			theme.MarkdownImageColor = adaptiveColor
		case "markdownimagetext":
			theme.MarkdownImageTextColor = adaptiveColor
		case "markdowncodeblock":
			theme.MarkdownCodeBlockColor = adaptiveColor
		case "markdownlistenumeration":
			theme.MarkdownListEnumerationColor = adaptiveColor
		default:
			slog.Warn("Unknown color key in custom theme", "key", key)
		}
	}

	return theme, nil
}
