package theme

import (
	"fmt"
	"slices"
	"strings"
	"sync"

	"github.com/alecthomas/chroma/v2/styles"
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
		// list system theme first
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
