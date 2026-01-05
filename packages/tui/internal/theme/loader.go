package theme

import (
	"embed"
	"encoding/json"
	"fmt"
	"image/color"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
)

//go:embed themes/*.json
var themesFS embed.FS

type JSONTheme struct {
	Defs  map[string]any `json:"defs,omitempty"`
	Theme map[string]any `json:"theme"`
}

type LoadedTheme struct {
	BaseTheme
	name string
}

func (t *LoadedTheme) Name() string {
	return t.name
}

type colorRef struct {
	value    any
	resolved bool
}

func LoadThemesFromJSON() error {
	entries, err := themesFS.ReadDir("themes")
	if err != nil {
		return fmt.Errorf("failed to read themes directory: %w", err)
	}

	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		themeName := strings.TrimSuffix(entry.Name(), ".json")
		data, err := themesFS.ReadFile(path.Join("themes", entry.Name()))
		if err != nil {
			return fmt.Errorf("failed to read theme file %s: %w", entry.Name(), err)
		}
		theme, err := parseJSONTheme(themeName, data)
		if err != nil {
			return fmt.Errorf("failed to parse theme %s: %w", themeName, err)
		}
		RegisterTheme(themeName, theme)
	}

	return nil
}

// LoadThemesFromDirectories loads themes from user directories in the correct override order.
// The hierarchy is (from lowest to highest priority):
// 1. Built-in themes (embedded)
// 2. USER_CONFIG/opencode/themes/*.json
// 3. PROJECT_ROOT/.opencode/themes/*.json
// 4. CWD/.opencode/themes/*.json
func LoadThemesFromDirectories(userConfig, projectRoot, cwd string) error {
	if err := LoadThemesFromJSON(); err != nil {
		return fmt.Errorf("failed to load built-in themes: %w", err)
	}

	dirs := []string{
		filepath.Join(userConfig, "themes"),
		filepath.Join(projectRoot, ".opencode", "themes"),
	}
	if cwd != projectRoot {
		dirs = append(dirs, filepath.Join(cwd, ".opencode", "themes"))
	}

	for _, dir := range dirs {
		if err := loadThemesFromDirectory(dir); err != nil {
			fmt.Printf("Warning: Failed to load themes from %s: %v\n", dir, err)
		}
	}

	return nil
}

func loadThemesFromDirectory(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil // Directory doesn't exist, which is fine
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("failed to read directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		themeName := strings.TrimSuffix(entry.Name(), ".json")
		filePath := filepath.Join(dir, entry.Name())

		data, err := os.ReadFile(filePath)
		if err != nil {
			fmt.Printf("Warning: Failed to read theme file %s: %v\n", filePath, err)
			continue
		}

		theme, err := parseJSONTheme(themeName, data)
		if err != nil {
			fmt.Printf("Warning: Failed to parse theme %s: %v\n", filePath, err)
			continue
		}

		RegisterTheme(themeName, theme)
	}

	return nil
}

func parseJSONTheme(name string, data []byte) (Theme, error) {
	var jsonTheme JSONTheme
	if err := json.Unmarshal(data, &jsonTheme); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON: %w", err)
	}
	theme := &LoadedTheme{
		name: name,
	}
	colorMap := make(map[string]*colorRef)
	for key, value := range jsonTheme.Defs {
		colorMap[key] = &colorRef{value: value, resolved: false}
	}
	for key, value := range jsonTheme.Theme {
		colorMap[key] = &colorRef{value: value, resolved: false}
	}
	resolver := &colorResolver{
		colors:  colorMap,
		visited: make(map[string]bool),
	}
	for key, value := range jsonTheme.Theme {
		resolved, err := resolver.resolveColor(key, value)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve color %s: %w", key, err)
		}
		adaptiveColor, err := parseResolvedColor(resolved)
		if err != nil {
			return nil, fmt.Errorf("failed to parse color %s: %w", key, err)
		}
		if err := setThemeColor(theme, key, adaptiveColor); err != nil {
			return nil, fmt.Errorf("failed to set color %s: %w", key, err)
		}
	}

	// Fill in any missing colors with safe defaults to prevent nil pointer panics
	fillMissingColors(theme)

	return theme, nil
}

// fillMissingColors ensures all theme colors have valid values.
// This prevents nil pointer panics when a theme JSON doesn't define all required colors.
func fillMissingColors(theme *LoadedTheme) {
	// Default gray color for missing colors
	defaultGray := compat.AdaptiveColor{
		Dark:  lipgloss.Color("#808080"),
		Light: lipgloss.Color("#808080"),
	}
	// Default background (transparent/unset)
	defaultBg := compat.AdaptiveColor{
		Dark:  lipgloss.NoColor{},
		Light: lipgloss.NoColor{},
	}

	// Check and fill each color field
	if isEmptyColor(theme.PrimaryColor) {
		theme.PrimaryColor = compat.AdaptiveColor{Dark: lipgloss.Color("#fab283"), Light: lipgloss.Color("#3b7dd8")}
	}
	if isEmptyColor(theme.SecondaryColor) {
		theme.SecondaryColor = theme.PrimaryColor
	}
	if isEmptyColor(theme.AccentColor) {
		theme.AccentColor = theme.PrimaryColor
	}
	if isEmptyColor(theme.ErrorColor) {
		theme.ErrorColor = compat.AdaptiveColor{Dark: lipgloss.Color("#e06c75"), Light: lipgloss.Color("#d1383d")}
	}
	if isEmptyColor(theme.WarningColor) {
		theme.WarningColor = compat.AdaptiveColor{Dark: lipgloss.Color("#f5a742"), Light: lipgloss.Color("#d68c27")}
	}
	if isEmptyColor(theme.SuccessColor) {
		theme.SuccessColor = compat.AdaptiveColor{Dark: lipgloss.Color("#7fd88f"), Light: lipgloss.Color("#3d9a57")}
	}
	if isEmptyColor(theme.InfoColor) {
		theme.InfoColor = compat.AdaptiveColor{Dark: lipgloss.Color("#56b6c2"), Light: lipgloss.Color("#318795")}
	}
	if isEmptyColor(theme.TextColor) {
		theme.TextColor = compat.AdaptiveColor{Dark: lipgloss.Color("#eeeeee"), Light: lipgloss.Color("#1a1a1a")}
	}
	if isEmptyColor(theme.TextMutedColor) {
		theme.TextMutedColor = defaultGray
	}
	if isEmptyColor(theme.BackgroundColor) {
		theme.BackgroundColor = defaultBg
	}
	if isEmptyColor(theme.BackgroundPanelColor) {
		theme.BackgroundPanelColor = compat.AdaptiveColor{Dark: lipgloss.Color("#141414"), Light: lipgloss.Color("#fafafa")}
	}
	if isEmptyColor(theme.BackgroundElementColor) {
		theme.BackgroundElementColor = compat.AdaptiveColor{Dark: lipgloss.Color("#1e1e1e"), Light: lipgloss.Color("#f5f5f5")}
	}
	if isEmptyColor(theme.BorderSubtleColor) {
		theme.BorderSubtleColor = compat.AdaptiveColor{Dark: lipgloss.Color("#3c3c3c"), Light: lipgloss.Color("#d4d4d4")}
	}
	if isEmptyColor(theme.BorderColor) {
		theme.BorderColor = compat.AdaptiveColor{Dark: lipgloss.Color("#484848"), Light: lipgloss.Color("#b8b8b8")}
	}
	if isEmptyColor(theme.BorderActiveColor) {
		theme.BorderActiveColor = theme.PrimaryColor
	}
	// Diff colors
	if isEmptyColor(theme.DiffAddedColor) {
		theme.DiffAddedColor = theme.SuccessColor
	}
	if isEmptyColor(theme.DiffRemovedColor) {
		theme.DiffRemovedColor = theme.ErrorColor
	}
	if isEmptyColor(theme.DiffContextColor) {
		theme.DiffContextColor = theme.TextMutedColor
	}
	if isEmptyColor(theme.DiffHunkHeaderColor) {
		theme.DiffHunkHeaderColor = theme.TextMutedColor
	}
	if isEmptyColor(theme.DiffHighlightAddedColor) {
		theme.DiffHighlightAddedColor = theme.SuccessColor
	}
	if isEmptyColor(theme.DiffHighlightRemovedColor) {
		theme.DiffHighlightRemovedColor = theme.ErrorColor
	}
	if isEmptyColor(theme.DiffAddedBgColor) {
		theme.DiffAddedBgColor = compat.AdaptiveColor{Dark: lipgloss.Color("#20303b"), Light: lipgloss.Color("#d5e5d5")}
	}
	if isEmptyColor(theme.DiffRemovedBgColor) {
		theme.DiffRemovedBgColor = compat.AdaptiveColor{Dark: lipgloss.Color("#37222c"), Light: lipgloss.Color("#f7d8db")}
	}
	if isEmptyColor(theme.DiffContextBgColor) {
		theme.DiffContextBgColor = defaultBg
	}
	if isEmptyColor(theme.DiffLineNumberColor) {
		theme.DiffLineNumberColor = theme.TextMutedColor
	}
	if isEmptyColor(theme.DiffAddedLineNumberBgColor) {
		theme.DiffAddedLineNumberBgColor = theme.DiffAddedBgColor
	}
	if isEmptyColor(theme.DiffRemovedLineNumberBgColor) {
		theme.DiffRemovedLineNumberBgColor = theme.DiffRemovedBgColor
	}
	// Markdown colors
	if isEmptyColor(theme.MarkdownTextColor) {
		theme.MarkdownTextColor = theme.TextColor
	}
	if isEmptyColor(theme.MarkdownHeadingColor) {
		theme.MarkdownHeadingColor = theme.PrimaryColor
	}
	if isEmptyColor(theme.MarkdownLinkColor) {
		theme.MarkdownLinkColor = theme.PrimaryColor
	}
	if isEmptyColor(theme.MarkdownLinkTextColor) {
		theme.MarkdownLinkTextColor = theme.InfoColor
	}
	if isEmptyColor(theme.MarkdownCodeColor) {
		theme.MarkdownCodeColor = theme.SuccessColor
	}
	if isEmptyColor(theme.MarkdownBlockQuoteColor) {
		theme.MarkdownBlockQuoteColor = theme.WarningColor
	}
	if isEmptyColor(theme.MarkdownEmphColor) {
		theme.MarkdownEmphColor = theme.WarningColor
	}
	if isEmptyColor(theme.MarkdownStrongColor) {
		theme.MarkdownStrongColor = theme.TextColor
	}
	if isEmptyColor(theme.MarkdownHorizontalRuleColor) {
		theme.MarkdownHorizontalRuleColor = theme.BorderColor
	}
	if isEmptyColor(theme.MarkdownListItemColor) {
		theme.MarkdownListItemColor = theme.PrimaryColor
	}
	if isEmptyColor(theme.MarkdownListEnumerationColor) {
		theme.MarkdownListEnumerationColor = theme.InfoColor
	}
	if isEmptyColor(theme.MarkdownImageColor) {
		theme.MarkdownImageColor = theme.PrimaryColor
	}
	if isEmptyColor(theme.MarkdownImageTextColor) {
		theme.MarkdownImageTextColor = theme.InfoColor
	}
	if isEmptyColor(theme.MarkdownCodeBlockColor) {
		theme.MarkdownCodeBlockColor = theme.TextColor
	}
	// Syntax colors
	if isEmptyColor(theme.SyntaxCommentColor) {
		theme.SyntaxCommentColor = theme.TextMutedColor
	}
	if isEmptyColor(theme.SyntaxKeywordColor) {
		theme.SyntaxKeywordColor = theme.AccentColor
	}
	if isEmptyColor(theme.SyntaxFunctionColor) {
		theme.SyntaxFunctionColor = theme.PrimaryColor
	}
	if isEmptyColor(theme.SyntaxVariableColor) {
		theme.SyntaxVariableColor = theme.TextColor
	}
	if isEmptyColor(theme.SyntaxStringColor) {
		theme.SyntaxStringColor = theme.SuccessColor
	}
	if isEmptyColor(theme.SyntaxNumberColor) {
		theme.SyntaxNumberColor = theme.WarningColor
	}
	if isEmptyColor(theme.SyntaxTypeColor) {
		theme.SyntaxTypeColor = theme.InfoColor
	}
	if isEmptyColor(theme.SyntaxOperatorColor) {
		theme.SyntaxOperatorColor = theme.InfoColor
	}
	if isEmptyColor(theme.SyntaxPunctuationColor) {
		theme.SyntaxPunctuationColor = theme.TextColor
	}
}

// isEmptyColor checks if an AdaptiveColor has nil or zero-value colors
func isEmptyColor(c compat.AdaptiveColor) bool {
	return c.Light == nil && c.Dark == nil
}

type colorResolver struct {
	colors  map[string]*colorRef
	visited map[string]bool
}

func (r *colorResolver) resolveColor(key string, value any) (any, error) {
	if r.visited[key] {
		return nil, fmt.Errorf("circular reference detected for color %s", key)
	}
	r.visited[key] = true
	defer func() { r.visited[key] = false }()

	switch v := value.(type) {
	case string:
		if strings.HasPrefix(v, "#") || v == "none" {
			return v, nil
		}
		return r.resolveReference(v)
	case float64:
		return v, nil
	case map[string]any:
		resolved := make(map[string]any)

		if dark, ok := v["dark"]; ok {
			resolvedDark, err := r.resolveColorValue(dark)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve dark variant: %w", err)
			}
			resolved["dark"] = resolvedDark
		}

		if light, ok := v["light"]; ok {
			resolvedLight, err := r.resolveColorValue(light)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve light variant: %w", err)
			}
			resolved["light"] = resolvedLight
		}

		return resolved, nil
	default:
		return nil, fmt.Errorf("invalid color value type: %T", value)
	}
}

func (r *colorResolver) resolveColorValue(value any) (any, error) {
	switch v := value.(type) {
	case string:
		if strings.HasPrefix(v, "#") || v == "none" {
			return v, nil
		}
		return r.resolveReference(v)
	case float64:
		return v, nil
	default:
		return nil, fmt.Errorf("invalid color value type: %T", value)
	}
}

func (r *colorResolver) resolveReference(ref string) (any, error) {
	colorRef, exists := r.colors[ref]
	if !exists {
		return nil, fmt.Errorf("color reference '%s' not found", ref)
	}

	if colorRef.resolved {
		return colorRef.value, nil
	}

	resolved, err := r.resolveColor(ref, colorRef.value)
	if err != nil {
		return nil, err
	}

	colorRef.value = resolved
	colorRef.resolved = true

	return resolved, nil
}

func parseResolvedColor(value any) (compat.AdaptiveColor, error) {
	switch v := value.(type) {
	case string:
		if v == "none" {
			return compat.AdaptiveColor{
				Dark:  lipgloss.NoColor{},
				Light: lipgloss.NoColor{},
			}, nil
		}
		return compat.AdaptiveColor{
			Dark:  lipgloss.Color(v),
			Light: lipgloss.Color(v),
		}, nil
	case float64:
		colorStr := fmt.Sprintf("%d", int(v))
		return compat.AdaptiveColor{
			Dark:  lipgloss.Color(colorStr),
			Light: lipgloss.Color(colorStr),
		}, nil
	case map[string]any:
		dark, darkOk := v["dark"]
		light, lightOk := v["light"]

		if !darkOk || !lightOk {
			return compat.AdaptiveColor{}, fmt.Errorf("color object must have both 'dark' and 'light' keys")
		}
		darkColor, err := parseColorValue(dark)
		if err != nil {
			return compat.AdaptiveColor{}, fmt.Errorf("failed to parse dark color: %w", err)
		}
		lightColor, err := parseColorValue(light)
		if err != nil {
			return compat.AdaptiveColor{}, fmt.Errorf("failed to parse light color: %w", err)
		}
		return compat.AdaptiveColor{
			Dark:  darkColor,
			Light: lightColor,
		}, nil
	default:
		return compat.AdaptiveColor{}, fmt.Errorf("invalid resolved color type: %T", value)
	}
}

func parseColorValue(value any) (color.Color, error) {
	switch v := value.(type) {
	case string:
		if v == "none" {
			return lipgloss.NoColor{}, nil
		}
		return lipgloss.Color(v), nil
	case float64:
		return lipgloss.Color(fmt.Sprintf("%d", int(v))), nil
	default:
		return nil, fmt.Errorf("invalid color value type: %T", value)
	}
}

// ParseEnterpriseTheme creates a theme from enterprise portal theme data.
// The themeData is a map[string]interface{} received from the enterprise portal API.
func ParseEnterpriseTheme(name string, themeData map[string]interface{}) (Theme, error) {
	if themeData == nil {
		return nil, fmt.Errorf("theme data is nil")
	}

	// Convert map to JSON for parsing
	jsonData, err := json.Marshal(themeData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal theme data: %w", err)
	}

	// Use existing JSON parser
	return parseJSONTheme(name, jsonData)
}

func setThemeColor(theme *LoadedTheme, key string, color compat.AdaptiveColor) error {
	switch key {
	case "primary":
		theme.PrimaryColor = color
	case "secondary":
		theme.SecondaryColor = color
	case "accent":
		theme.AccentColor = color
	case "error":
		theme.ErrorColor = color
	case "warning":
		theme.WarningColor = color
	case "success":
		theme.SuccessColor = color
	case "info":
		theme.InfoColor = color
	case "text":
		theme.TextColor = color
	case "textMuted":
		theme.TextMutedColor = color
	case "background":
		theme.BackgroundColor = color
	case "backgroundPanel":
		theme.BackgroundPanelColor = color
	case "backgroundElement":
		theme.BackgroundElementColor = color
	case "border":
		theme.BorderColor = color
	case "borderActive":
		theme.BorderActiveColor = color
	case "borderSubtle":
		theme.BorderSubtleColor = color
	case "diffAdded":
		theme.DiffAddedColor = color
	case "diffRemoved":
		theme.DiffRemovedColor = color
	case "diffContext":
		theme.DiffContextColor = color
	case "diffHunkHeader":
		theme.DiffHunkHeaderColor = color
	case "diffHighlightAdded":
		theme.DiffHighlightAddedColor = color
	case "diffHighlightRemoved":
		theme.DiffHighlightRemovedColor = color
	case "diffAddedBg":
		theme.DiffAddedBgColor = color
	case "diffRemovedBg":
		theme.DiffRemovedBgColor = color
	case "diffContextBg":
		theme.DiffContextBgColor = color
	case "diffLineNumber":
		theme.DiffLineNumberColor = color
	case "diffAddedLineNumberBg":
		theme.DiffAddedLineNumberBgColor = color
	case "diffRemovedLineNumberBg":
		theme.DiffRemovedLineNumberBgColor = color
	case "markdownText":
		theme.MarkdownTextColor = color
	case "markdownHeading":
		theme.MarkdownHeadingColor = color
	case "markdownLink":
		theme.MarkdownLinkColor = color
	case "markdownLinkText":
		theme.MarkdownLinkTextColor = color
	case "markdownCode":
		theme.MarkdownCodeColor = color
	case "markdownBlockQuote":
		theme.MarkdownBlockQuoteColor = color
	case "markdownEmph":
		theme.MarkdownEmphColor = color
	case "markdownStrong":
		theme.MarkdownStrongColor = color
	case "markdownHorizontalRule":
		theme.MarkdownHorizontalRuleColor = color
	case "markdownListItem":
		theme.MarkdownListItemColor = color
	case "markdownListEnumeration":
		theme.MarkdownListEnumerationColor = color
	case "markdownImage":
		theme.MarkdownImageColor = color
	case "markdownImageText":
		theme.MarkdownImageTextColor = color
	case "markdownCodeBlock":
		theme.MarkdownCodeBlockColor = color
	case "syntaxComment":
		theme.SyntaxCommentColor = color
	case "syntaxKeyword":
		theme.SyntaxKeywordColor = color
	case "syntaxFunction":
		theme.SyntaxFunctionColor = color
	case "syntaxVariable":
		theme.SyntaxVariableColor = color
	case "syntaxString":
		theme.SyntaxStringColor = color
	case "syntaxNumber":
		theme.SyntaxNumberColor = color
	case "syntaxType":
		theme.SyntaxTypeColor = color
	case "syntaxOperator":
		theme.SyntaxOperatorColor = color
	case "syntaxPunctuation":
		theme.SyntaxPunctuationColor = color
	default:
		// Ignore unknown keys for forward compatibility
		return nil
	}
	return nil
}
