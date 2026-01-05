package theme

import (
	"fmt"
	"image/color"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/alecthomas/chroma/v2/styles"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
	"github.com/charmbracelet/x/ansi"
)

// Manager handles theme registration, selection, and retrieval.
// It maintains a registry of available themes and tracks the currently active theme.
type Manager struct {
	themes               map[string]Theme
	currentName          string
	currentUsesAnsiCache bool // Cache whether current theme uses ANSI colors
	mu                   sync.RWMutex
}

// Global instance of the theme manager
var globalManager = &Manager{
	themes:      make(map[string]Theme),
	currentName: "",
}

// RegisterTheme adds a new theme to the registry.
// If this is the first theme registered, it becomes the default.
func RegisterTheme(name string, theme Theme) {
	globalManager.mu.Lock()
	defer globalManager.mu.Unlock()

	globalManager.themes[name] = theme

	// If this is the first theme, make it the default
	if globalManager.currentName == "" {
		globalManager.currentName = name
		globalManager.currentUsesAnsiCache = themeUsesAnsiColors(theme)
	}
}

// SetTheme changes the active theme to the one with the specified name.
// Returns an error if the theme doesn't exist.
func SetTheme(name string) error {
	globalManager.mu.Lock()
	defer globalManager.mu.Unlock()
	delete(styles.Registry, "charm")

	theme, exists := globalManager.themes[name]
	if !exists {
		return fmt.Errorf("theme '%s' not found", name)
	}

	globalManager.currentName = name
	globalManager.currentUsesAnsiCache = themeUsesAnsiColors(theme)

	return nil
}

// CurrentTheme returns the currently active theme.
// If no theme is set, it tries to use "snowcode" as default, then falls back to the first available theme.
// Returns nil only if no themes are registered at all.
func CurrentTheme() Theme {
	globalManager.mu.RLock()
	defer globalManager.mu.RUnlock()

	// If a theme is already selected, return it
	if globalManager.currentName != "" {
		if t, exists := globalManager.themes[globalManager.currentName]; exists {
			return t
		}
	}

	// Try snowcode as default
	if t, exists := globalManager.themes["snowcode"]; exists {
		return t
	}

	// Fall back to first available theme
	for _, t := range globalManager.themes {
		return t
	}

	// Return emergency fallback theme instead of nil to prevent panic
	return getEmergencyFallbackTheme()
}

// emergencyFallbackTheme is a singleton fallback theme instance
var emergencyFallbackTheme Theme

// getEmergencyFallbackTheme returns a minimal theme that prevents nil pointer panics.
// This should only be reached in exceptional circumstances when no themes are registered.
func getEmergencyFallbackTheme() Theme {
	if emergencyFallbackTheme != nil {
		return emergencyFallbackTheme
	}

	// Create a simple dark/light adaptive theme with safe defaults
	emergencyFallbackTheme = &LoadedTheme{
		name: "emergency-fallback",
		BaseTheme: BaseTheme{
			// Background colors
			BackgroundColor:        compat.AdaptiveColor{Dark: lipgloss.Color("#0a0a0a"), Light: lipgloss.Color("#ffffff")},
			BackgroundPanelColor:   compat.AdaptiveColor{Dark: lipgloss.Color("#141414"), Light: lipgloss.Color("#fafafa")},
			BackgroundElementColor: compat.AdaptiveColor{Dark: lipgloss.Color("#1e1e1e"), Light: lipgloss.Color("#f5f5f5")},

			// Border colors
			BorderSubtleColor: compat.AdaptiveColor{Dark: lipgloss.Color("#3c3c3c"), Light: lipgloss.Color("#d4d4d4")},
			BorderColor:       compat.AdaptiveColor{Dark: lipgloss.Color("#484848"), Light: lipgloss.Color("#b8b8b8")},
			BorderActiveColor: compat.AdaptiveColor{Dark: lipgloss.Color("#606060"), Light: lipgloss.Color("#a0a0a0")},

			// Brand colors
			PrimaryColor:   compat.AdaptiveColor{Dark: lipgloss.Color("#fab283"), Light: lipgloss.Color("#3b7dd8")},
			SecondaryColor: compat.AdaptiveColor{Dark: lipgloss.Color("#5c9cf5"), Light: lipgloss.Color("#7b5bb6")},
			AccentColor:    compat.AdaptiveColor{Dark: lipgloss.Color("#9d7cd8"), Light: lipgloss.Color("#d68c27")},

			// Text colors
			TextColor:      compat.AdaptiveColor{Dark: lipgloss.Color("#eeeeee"), Light: lipgloss.Color("#1a1a1a")},
			TextMutedColor: compat.AdaptiveColor{Dark: lipgloss.Color("#808080"), Light: lipgloss.Color("#8a8a8a")},

			// Status colors
			ErrorColor:   compat.AdaptiveColor{Dark: lipgloss.Color("#e06c75"), Light: lipgloss.Color("#d1383d")},
			WarningColor: compat.AdaptiveColor{Dark: lipgloss.Color("#f5a742"), Light: lipgloss.Color("#d68c27")},
			SuccessColor: compat.AdaptiveColor{Dark: lipgloss.Color("#7fd88f"), Light: lipgloss.Color("#3d9a57")},
			InfoColor:    compat.AdaptiveColor{Dark: lipgloss.Color("#56b6c2"), Light: lipgloss.Color("#318795")},

			// Diff view colors
			DiffAddedColor:               compat.AdaptiveColor{Dark: lipgloss.Color("#4fd6be"), Light: lipgloss.Color("#1e725c")},
			DiffRemovedColor:             compat.AdaptiveColor{Dark: lipgloss.Color("#c53b53"), Light: lipgloss.Color("#c53b53")},
			DiffContextColor:             compat.AdaptiveColor{Dark: lipgloss.Color("#828bb8"), Light: lipgloss.Color("#7086b5")},
			DiffHunkHeaderColor:          compat.AdaptiveColor{Dark: lipgloss.Color("#828bb8"), Light: lipgloss.Color("#7086b5")},
			DiffHighlightAddedColor:      compat.AdaptiveColor{Dark: lipgloss.Color("#b8db87"), Light: lipgloss.Color("#4db380")},
			DiffHighlightRemovedColor:    compat.AdaptiveColor{Dark: lipgloss.Color("#e26a75"), Light: lipgloss.Color("#f52a65")},
			DiffAddedBgColor:             compat.AdaptiveColor{Dark: lipgloss.Color("#20303b"), Light: lipgloss.Color("#d5e5d5")},
			DiffRemovedBgColor:           compat.AdaptiveColor{Dark: lipgloss.Color("#37222c"), Light: lipgloss.Color("#f7d8db")},
			DiffContextBgColor:           compat.AdaptiveColor{Dark: lipgloss.Color("#141414"), Light: lipgloss.Color("#fafafa")},
			DiffLineNumberColor:          compat.AdaptiveColor{Dark: lipgloss.Color("#1e1e1e"), Light: lipgloss.Color("#f5f5f5")},
			DiffAddedLineNumberBgColor:   compat.AdaptiveColor{Dark: lipgloss.Color("#1b2b34"), Light: lipgloss.Color("#c5d5c5")},
			DiffRemovedLineNumberBgColor: compat.AdaptiveColor{Dark: lipgloss.Color("#2d1f26"), Light: lipgloss.Color("#e7c8cb")},

			// Markdown colors
			MarkdownTextColor:            compat.AdaptiveColor{Dark: lipgloss.Color("#eeeeee"), Light: lipgloss.Color("#1a1a1a")},
			MarkdownHeadingColor:         compat.AdaptiveColor{Dark: lipgloss.Color("#9d7cd8"), Light: lipgloss.Color("#d68c27")},
			MarkdownLinkColor:            compat.AdaptiveColor{Dark: lipgloss.Color("#fab283"), Light: lipgloss.Color("#3b7dd8")},
			MarkdownLinkTextColor:        compat.AdaptiveColor{Dark: lipgloss.Color("#56b6c2"), Light: lipgloss.Color("#318795")},
			MarkdownCodeColor:            compat.AdaptiveColor{Dark: lipgloss.Color("#7fd88f"), Light: lipgloss.Color("#3d9a57")},
			MarkdownBlockQuoteColor:      compat.AdaptiveColor{Dark: lipgloss.Color("#e5c07b"), Light: lipgloss.Color("#b0851f")},
			MarkdownEmphColor:            compat.AdaptiveColor{Dark: lipgloss.Color("#e5c07b"), Light: lipgloss.Color("#b0851f")},
			MarkdownStrongColor:          compat.AdaptiveColor{Dark: lipgloss.Color("#f5a742"), Light: lipgloss.Color("#d68c27")},
			MarkdownHorizontalRuleColor:  compat.AdaptiveColor{Dark: lipgloss.Color("#808080"), Light: lipgloss.Color("#8a8a8a")},
			MarkdownListItemColor:        compat.AdaptiveColor{Dark: lipgloss.Color("#fab283"), Light: lipgloss.Color("#3b7dd8")},
			MarkdownListEnumerationColor: compat.AdaptiveColor{Dark: lipgloss.Color("#56b6c2"), Light: lipgloss.Color("#318795")},
			MarkdownImageColor:           compat.AdaptiveColor{Dark: lipgloss.Color("#fab283"), Light: lipgloss.Color("#3b7dd8")},
			MarkdownImageTextColor:       compat.AdaptiveColor{Dark: lipgloss.Color("#56b6c2"), Light: lipgloss.Color("#318795")},
			MarkdownCodeBlockColor:       compat.AdaptiveColor{Dark: lipgloss.Color("#eeeeee"), Light: lipgloss.Color("#1a1a1a")},

			// Syntax highlighting colors
			SyntaxCommentColor:     compat.AdaptiveColor{Dark: lipgloss.Color("#808080"), Light: lipgloss.Color("#8a8a8a")},
			SyntaxKeywordColor:     compat.AdaptiveColor{Dark: lipgloss.Color("#9d7cd8"), Light: lipgloss.Color("#d68c27")},
			SyntaxFunctionColor:    compat.AdaptiveColor{Dark: lipgloss.Color("#fab283"), Light: lipgloss.Color("#3b7dd8")},
			SyntaxVariableColor:    compat.AdaptiveColor{Dark: lipgloss.Color("#e06c75"), Light: lipgloss.Color("#d1383d")},
			SyntaxStringColor:      compat.AdaptiveColor{Dark: lipgloss.Color("#7fd88f"), Light: lipgloss.Color("#3d9a57")},
			SyntaxNumberColor:      compat.AdaptiveColor{Dark: lipgloss.Color("#f5a742"), Light: lipgloss.Color("#d68c27")},
			SyntaxTypeColor:        compat.AdaptiveColor{Dark: lipgloss.Color("#e5c07b"), Light: lipgloss.Color("#b0851f")},
			SyntaxOperatorColor:    compat.AdaptiveColor{Dark: lipgloss.Color("#56b6c2"), Light: lipgloss.Color("#318795")},
			SyntaxPunctuationColor: compat.AdaptiveColor{Dark: lipgloss.Color("#eeeeee"), Light: lipgloss.Color("#1a1a1a")},
		},
	}

	return emergencyFallbackTheme
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
		if a == "system" {
			return -1
		} else if b == "system" {
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

// UpdateSystemTheme updates the system theme with terminal background info
func UpdateSystemTheme(terminalBg color.Color, isDark bool) {
	globalManager.mu.Lock()
	defer globalManager.mu.Unlock()

	dynamicTheme := NewSystemTheme(terminalBg, isDark)
	globalManager.themes["system"] = dynamicTheme
	if globalManager.currentName == "system" {
		globalManager.currentUsesAnsiCache = themeUsesAnsiColors(dynamicTheme)
	}
}

// CurrentThemeUsesAnsiColors returns true if the current theme uses ANSI 0-16 colors
func CurrentThemeUsesAnsiColors() bool {
	// globalManager.mu.RLock()
	// defer globalManager.mu.RUnlock()

	return globalManager.currentUsesAnsiCache
}

// isAnsiColor checks if a color represents an ANSI 0-16 color
func isAnsiColor(c color.Color) bool {
	if _, ok := c.(lipgloss.NoColor); ok {
		return false
	}
	if _, ok := c.(ansi.BasicColor); ok {
		return true
	}

	// For other color types, check if they represent ANSI colors
	// by examining their string representation
	if stringer, ok := c.(fmt.Stringer); ok {
		str := stringer.String()
		// Check if it's a numeric ANSI color (0-15)
		if num, err := strconv.Atoi(str); err == nil && num >= 0 && num <= 15 {
			return true
		}
	}

	return false
}

// adaptiveColorUsesAnsi checks if an AdaptiveColor uses ANSI colors
func adaptiveColorUsesAnsi(ac compat.AdaptiveColor) bool {
	if isAnsiColor(ac.Dark) {
		return true
	}
	if isAnsiColor(ac.Light) {
		return true
	}
	return false
}

// themeUsesAnsiColors checks if a theme uses any ANSI 0-16 colors
func themeUsesAnsiColors(theme Theme) bool {
	if theme == nil {
		return false
	}

	return adaptiveColorUsesAnsi(theme.Primary()) ||
		adaptiveColorUsesAnsi(theme.Secondary()) ||
		adaptiveColorUsesAnsi(theme.Accent()) ||
		adaptiveColorUsesAnsi(theme.Error()) ||
		adaptiveColorUsesAnsi(theme.Warning()) ||
		adaptiveColorUsesAnsi(theme.Success()) ||
		adaptiveColorUsesAnsi(theme.Info()) ||
		adaptiveColorUsesAnsi(theme.Text()) ||
		adaptiveColorUsesAnsi(theme.TextMuted()) ||
		adaptiveColorUsesAnsi(theme.Background()) ||
		adaptiveColorUsesAnsi(theme.BackgroundPanel()) ||
		adaptiveColorUsesAnsi(theme.BackgroundElement()) ||
		adaptiveColorUsesAnsi(theme.Border()) ||
		adaptiveColorUsesAnsi(theme.BorderActive()) ||
		adaptiveColorUsesAnsi(theme.BorderSubtle()) ||
		adaptiveColorUsesAnsi(theme.DiffAdded()) ||
		adaptiveColorUsesAnsi(theme.DiffRemoved()) ||
		adaptiveColorUsesAnsi(theme.DiffContext()) ||
		adaptiveColorUsesAnsi(theme.DiffHunkHeader()) ||
		adaptiveColorUsesAnsi(theme.DiffHighlightAdded()) ||
		adaptiveColorUsesAnsi(theme.DiffHighlightRemoved()) ||
		adaptiveColorUsesAnsi(theme.DiffAddedBg()) ||
		adaptiveColorUsesAnsi(theme.DiffRemovedBg()) ||
		adaptiveColorUsesAnsi(theme.DiffContextBg()) ||
		adaptiveColorUsesAnsi(theme.DiffLineNumber()) ||
		adaptiveColorUsesAnsi(theme.DiffAddedLineNumberBg()) ||
		adaptiveColorUsesAnsi(theme.DiffRemovedLineNumberBg()) ||
		adaptiveColorUsesAnsi(theme.MarkdownText()) ||
		adaptiveColorUsesAnsi(theme.MarkdownHeading()) ||
		adaptiveColorUsesAnsi(theme.MarkdownLink()) ||
		adaptiveColorUsesAnsi(theme.MarkdownLinkText()) ||
		adaptiveColorUsesAnsi(theme.MarkdownCode()) ||
		adaptiveColorUsesAnsi(theme.MarkdownBlockQuote()) ||
		adaptiveColorUsesAnsi(theme.MarkdownEmph()) ||
		adaptiveColorUsesAnsi(theme.MarkdownStrong()) ||
		adaptiveColorUsesAnsi(theme.MarkdownHorizontalRule()) ||
		adaptiveColorUsesAnsi(theme.MarkdownListItem()) ||
		adaptiveColorUsesAnsi(theme.MarkdownListEnumeration()) ||
		adaptiveColorUsesAnsi(theme.MarkdownImage()) ||
		adaptiveColorUsesAnsi(theme.MarkdownImageText()) ||
		adaptiveColorUsesAnsi(theme.MarkdownCodeBlock()) ||
		adaptiveColorUsesAnsi(theme.SyntaxComment()) ||
		adaptiveColorUsesAnsi(theme.SyntaxKeyword()) ||
		adaptiveColorUsesAnsi(theme.SyntaxFunction()) ||
		adaptiveColorUsesAnsi(theme.SyntaxVariable()) ||
		adaptiveColorUsesAnsi(theme.SyntaxString()) ||
		adaptiveColorUsesAnsi(theme.SyntaxNumber()) ||
		adaptiveColorUsesAnsi(theme.SyntaxType()) ||
		adaptiveColorUsesAnsi(theme.SyntaxOperator()) ||
		adaptiveColorUsesAnsi(theme.SyntaxPunctuation())
}
