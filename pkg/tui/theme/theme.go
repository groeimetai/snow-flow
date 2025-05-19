package theme

import (
	"fmt"
	"regexp"

	"github.com/charmbracelet/lipgloss"
)

// Theme defines the interface for all UI themes in the application.
// All colors must be defined as lipgloss.AdaptiveColor to support
// both light and dark terminal backgrounds.
type Theme interface {
	// Base colors
	Primary() lipgloss.AdaptiveColor
	Secondary() lipgloss.AdaptiveColor
	Accent() lipgloss.AdaptiveColor

	// Status colors
	Error() lipgloss.AdaptiveColor
	Warning() lipgloss.AdaptiveColor
	Success() lipgloss.AdaptiveColor
	Info() lipgloss.AdaptiveColor

	// Text colors
	Text() lipgloss.AdaptiveColor
	TextMuted() lipgloss.AdaptiveColor
	TextEmphasized() lipgloss.AdaptiveColor

	// Background colors
	Background() lipgloss.AdaptiveColor
	BackgroundSecondary() lipgloss.AdaptiveColor
	BackgroundDarker() lipgloss.AdaptiveColor

	// Border colors
	BorderNormal() lipgloss.AdaptiveColor
	BorderFocused() lipgloss.AdaptiveColor
	BorderDim() lipgloss.AdaptiveColor

	// Diff view colors
	DiffAdded() lipgloss.AdaptiveColor
	DiffRemoved() lipgloss.AdaptiveColor
	DiffContext() lipgloss.AdaptiveColor
	DiffHunkHeader() lipgloss.AdaptiveColor
	DiffHighlightAdded() lipgloss.AdaptiveColor
	DiffHighlightRemoved() lipgloss.AdaptiveColor
	DiffAddedBg() lipgloss.AdaptiveColor
	DiffRemovedBg() lipgloss.AdaptiveColor
	DiffContextBg() lipgloss.AdaptiveColor
	DiffLineNumber() lipgloss.AdaptiveColor
	DiffAddedLineNumberBg() lipgloss.AdaptiveColor
	DiffRemovedLineNumberBg() lipgloss.AdaptiveColor

	// Markdown colors
	MarkdownText() lipgloss.AdaptiveColor
	MarkdownHeading() lipgloss.AdaptiveColor
	MarkdownLink() lipgloss.AdaptiveColor
	MarkdownLinkText() lipgloss.AdaptiveColor
	MarkdownCode() lipgloss.AdaptiveColor
	MarkdownBlockQuote() lipgloss.AdaptiveColor
	MarkdownEmph() lipgloss.AdaptiveColor
	MarkdownStrong() lipgloss.AdaptiveColor
	MarkdownHorizontalRule() lipgloss.AdaptiveColor
	MarkdownListItem() lipgloss.AdaptiveColor
	MarkdownListEnumeration() lipgloss.AdaptiveColor
	MarkdownImage() lipgloss.AdaptiveColor
	MarkdownImageText() lipgloss.AdaptiveColor
	MarkdownCodeBlock() lipgloss.AdaptiveColor

	// Syntax highlighting colors
	SyntaxComment() lipgloss.AdaptiveColor
	SyntaxKeyword() lipgloss.AdaptiveColor
	SyntaxFunction() lipgloss.AdaptiveColor
	SyntaxVariable() lipgloss.AdaptiveColor
	SyntaxString() lipgloss.AdaptiveColor
	SyntaxNumber() lipgloss.AdaptiveColor
	SyntaxType() lipgloss.AdaptiveColor
	SyntaxOperator() lipgloss.AdaptiveColor
	SyntaxPunctuation() lipgloss.AdaptiveColor
}

// BaseTheme provides a default implementation of the Theme interface
// that can be embedded in concrete theme implementations.
type BaseTheme struct {
	// Base colors
	PrimaryColor   lipgloss.AdaptiveColor
	SecondaryColor lipgloss.AdaptiveColor
	AccentColor    lipgloss.AdaptiveColor

	// Status colors
	ErrorColor   lipgloss.AdaptiveColor
	WarningColor lipgloss.AdaptiveColor
	SuccessColor lipgloss.AdaptiveColor
	InfoColor    lipgloss.AdaptiveColor

	// Text colors
	TextColor           lipgloss.AdaptiveColor
	TextMutedColor      lipgloss.AdaptiveColor
	TextEmphasizedColor lipgloss.AdaptiveColor

	// Background colors
	BackgroundColor          lipgloss.AdaptiveColor
	BackgroundSecondaryColor lipgloss.AdaptiveColor
	BackgroundDarkerColor    lipgloss.AdaptiveColor

	// Border colors
	BorderNormalColor  lipgloss.AdaptiveColor
	BorderFocusedColor lipgloss.AdaptiveColor
	BorderDimColor     lipgloss.AdaptiveColor

	// Diff view colors
	DiffAddedColor               lipgloss.AdaptiveColor
	DiffRemovedColor             lipgloss.AdaptiveColor
	DiffContextColor             lipgloss.AdaptiveColor
	DiffHunkHeaderColor          lipgloss.AdaptiveColor
	DiffHighlightAddedColor      lipgloss.AdaptiveColor
	DiffHighlightRemovedColor    lipgloss.AdaptiveColor
	DiffAddedBgColor             lipgloss.AdaptiveColor
	DiffRemovedBgColor           lipgloss.AdaptiveColor
	DiffContextBgColor           lipgloss.AdaptiveColor
	DiffLineNumberColor          lipgloss.AdaptiveColor
	DiffAddedLineNumberBgColor   lipgloss.AdaptiveColor
	DiffRemovedLineNumberBgColor lipgloss.AdaptiveColor

	// Markdown colors
	MarkdownTextColor            lipgloss.AdaptiveColor
	MarkdownHeadingColor         lipgloss.AdaptiveColor
	MarkdownLinkColor            lipgloss.AdaptiveColor
	MarkdownLinkTextColor        lipgloss.AdaptiveColor
	MarkdownCodeColor            lipgloss.AdaptiveColor
	MarkdownBlockQuoteColor      lipgloss.AdaptiveColor
	MarkdownEmphColor            lipgloss.AdaptiveColor
	MarkdownStrongColor          lipgloss.AdaptiveColor
	MarkdownHorizontalRuleColor  lipgloss.AdaptiveColor
	MarkdownListItemColor        lipgloss.AdaptiveColor
	MarkdownListEnumerationColor lipgloss.AdaptiveColor
	MarkdownImageColor           lipgloss.AdaptiveColor
	MarkdownImageTextColor       lipgloss.AdaptiveColor
	MarkdownCodeBlockColor       lipgloss.AdaptiveColor

	// Syntax highlighting colors
	SyntaxCommentColor     lipgloss.AdaptiveColor
	SyntaxKeywordColor     lipgloss.AdaptiveColor
	SyntaxFunctionColor    lipgloss.AdaptiveColor
	SyntaxVariableColor    lipgloss.AdaptiveColor
	SyntaxStringColor      lipgloss.AdaptiveColor
	SyntaxNumberColor      lipgloss.AdaptiveColor
	SyntaxTypeColor        lipgloss.AdaptiveColor
	SyntaxOperatorColor    lipgloss.AdaptiveColor
	SyntaxPunctuationColor lipgloss.AdaptiveColor
}

// Implement the Theme interface for BaseTheme
func (t *BaseTheme) Primary() lipgloss.AdaptiveColor   { return t.PrimaryColor }
func (t *BaseTheme) Secondary() lipgloss.AdaptiveColor { return t.SecondaryColor }
func (t *BaseTheme) Accent() lipgloss.AdaptiveColor    { return t.AccentColor }

func (t *BaseTheme) Error() lipgloss.AdaptiveColor   { return t.ErrorColor }
func (t *BaseTheme) Warning() lipgloss.AdaptiveColor { return t.WarningColor }
func (t *BaseTheme) Success() lipgloss.AdaptiveColor { return t.SuccessColor }
func (t *BaseTheme) Info() lipgloss.AdaptiveColor    { return t.InfoColor }

func (t *BaseTheme) Text() lipgloss.AdaptiveColor           { return t.TextColor }
func (t *BaseTheme) TextMuted() lipgloss.AdaptiveColor      { return t.TextMutedColor }
func (t *BaseTheme) TextEmphasized() lipgloss.AdaptiveColor { return t.TextEmphasizedColor }

func (t *BaseTheme) Background() lipgloss.AdaptiveColor          { return t.BackgroundColor }
func (t *BaseTheme) BackgroundSecondary() lipgloss.AdaptiveColor { return t.BackgroundSecondaryColor }
func (t *BaseTheme) BackgroundDarker() lipgloss.AdaptiveColor    { return t.BackgroundDarkerColor }

func (t *BaseTheme) BorderNormal() lipgloss.AdaptiveColor  { return t.BorderNormalColor }
func (t *BaseTheme) BorderFocused() lipgloss.AdaptiveColor { return t.BorderFocusedColor }
func (t *BaseTheme) BorderDim() lipgloss.AdaptiveColor     { return t.BorderDimColor }

func (t *BaseTheme) DiffAdded() lipgloss.AdaptiveColor            { return t.DiffAddedColor }
func (t *BaseTheme) DiffRemoved() lipgloss.AdaptiveColor          { return t.DiffRemovedColor }
func (t *BaseTheme) DiffContext() lipgloss.AdaptiveColor          { return t.DiffContextColor }
func (t *BaseTheme) DiffHunkHeader() lipgloss.AdaptiveColor       { return t.DiffHunkHeaderColor }
func (t *BaseTheme) DiffHighlightAdded() lipgloss.AdaptiveColor   { return t.DiffHighlightAddedColor }
func (t *BaseTheme) DiffHighlightRemoved() lipgloss.AdaptiveColor { return t.DiffHighlightRemovedColor }
func (t *BaseTheme) DiffAddedBg() lipgloss.AdaptiveColor          { return t.DiffAddedBgColor }
func (t *BaseTheme) DiffRemovedBg() lipgloss.AdaptiveColor        { return t.DiffRemovedBgColor }
func (t *BaseTheme) DiffContextBg() lipgloss.AdaptiveColor        { return t.DiffContextBgColor }
func (t *BaseTheme) DiffLineNumber() lipgloss.AdaptiveColor       { return t.DiffLineNumberColor }
func (t *BaseTheme) DiffAddedLineNumberBg() lipgloss.AdaptiveColor {
	return t.DiffAddedLineNumberBgColor
}
func (t *BaseTheme) DiffRemovedLineNumberBg() lipgloss.AdaptiveColor {
	return t.DiffRemovedLineNumberBgColor
}

func (t *BaseTheme) MarkdownText() lipgloss.AdaptiveColor       { return t.MarkdownTextColor }
func (t *BaseTheme) MarkdownHeading() lipgloss.AdaptiveColor    { return t.MarkdownHeadingColor }
func (t *BaseTheme) MarkdownLink() lipgloss.AdaptiveColor       { return t.MarkdownLinkColor }
func (t *BaseTheme) MarkdownLinkText() lipgloss.AdaptiveColor   { return t.MarkdownLinkTextColor }
func (t *BaseTheme) MarkdownCode() lipgloss.AdaptiveColor       { return t.MarkdownCodeColor }
func (t *BaseTheme) MarkdownBlockQuote() lipgloss.AdaptiveColor { return t.MarkdownBlockQuoteColor }
func (t *BaseTheme) MarkdownEmph() lipgloss.AdaptiveColor       { return t.MarkdownEmphColor }
func (t *BaseTheme) MarkdownStrong() lipgloss.AdaptiveColor     { return t.MarkdownStrongColor }
func (t *BaseTheme) MarkdownHorizontalRule() lipgloss.AdaptiveColor {
	return t.MarkdownHorizontalRuleColor
}
func (t *BaseTheme) MarkdownListItem() lipgloss.AdaptiveColor { return t.MarkdownListItemColor }
func (t *BaseTheme) MarkdownListEnumeration() lipgloss.AdaptiveColor {
	return t.MarkdownListEnumerationColor
}
func (t *BaseTheme) MarkdownImage() lipgloss.AdaptiveColor     { return t.MarkdownImageColor }
func (t *BaseTheme) MarkdownImageText() lipgloss.AdaptiveColor { return t.MarkdownImageTextColor }
func (t *BaseTheme) MarkdownCodeBlock() lipgloss.AdaptiveColor { return t.MarkdownCodeBlockColor }

func (t *BaseTheme) SyntaxComment() lipgloss.AdaptiveColor     { return t.SyntaxCommentColor }
func (t *BaseTheme) SyntaxKeyword() lipgloss.AdaptiveColor     { return t.SyntaxKeywordColor }
func (t *BaseTheme) SyntaxFunction() lipgloss.AdaptiveColor    { return t.SyntaxFunctionColor }
func (t *BaseTheme) SyntaxVariable() lipgloss.AdaptiveColor    { return t.SyntaxVariableColor }
func (t *BaseTheme) SyntaxString() lipgloss.AdaptiveColor      { return t.SyntaxStringColor }
func (t *BaseTheme) SyntaxNumber() lipgloss.AdaptiveColor      { return t.SyntaxNumberColor }
func (t *BaseTheme) SyntaxType() lipgloss.AdaptiveColor        { return t.SyntaxTypeColor }
func (t *BaseTheme) SyntaxOperator() lipgloss.AdaptiveColor    { return t.SyntaxOperatorColor }
func (t *BaseTheme) SyntaxPunctuation() lipgloss.AdaptiveColor { return t.SyntaxPunctuationColor }

// ParseAdaptiveColor parses a color value from the config file into a lipgloss.AdaptiveColor.
// It accepts either a string (hex color) or a map with "dark" and "light" keys.
func ParseAdaptiveColor(value any) (lipgloss.AdaptiveColor, error) {
	// Regular expression to validate hex color format
	hexColorRegex := regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

	// Case 1: String value (same color for both dark and light modes)
	if hexColor, ok := value.(string); ok {
		if !hexColorRegex.MatchString(hexColor) {
			return lipgloss.AdaptiveColor{}, fmt.Errorf("invalid hex color format: %s", hexColor)
		}
		return lipgloss.AdaptiveColor{
			Dark:  hexColor,
			Light: hexColor,
		}, nil
	}

	// Case 2: Int value between 0 and 255
	if numericVal, ok := value.(float64); ok {
		intVal := int(numericVal)
		if intVal < 0 || intVal > 255 {
			return lipgloss.AdaptiveColor{}, fmt.Errorf("invalid int color value (must be between 0 and 255): %d", intVal)
		}
		return lipgloss.AdaptiveColor{
			Dark:  fmt.Sprintf("%d", intVal),
			Light: fmt.Sprintf("%d", intVal),
		}, nil
	}

	// Case 3: Map with dark and light keys
	if colorMap, ok := value.(map[string]any); ok {
		darkVal, darkOk := colorMap["dark"]
		lightVal, lightOk := colorMap["light"]

		if !darkOk || !lightOk {
			return lipgloss.AdaptiveColor{}, fmt.Errorf("color map must contain both 'dark' and 'light' keys")
		}

		darkHex, darkIsString := darkVal.(string)
		lightHex, lightIsString := lightVal.(string)

		if !darkIsString || !lightIsString {
			darkVal, darkIsNumber := darkVal.(float64)
			lightVal, lightIsNumber := lightVal.(float64)

			if !darkIsNumber || !lightIsNumber {
				return lipgloss.AdaptiveColor{}, fmt.Errorf("color map values must be strings or ints")
			}

			darkInt := int(darkVal)
			lightInt := int(lightVal)

			return lipgloss.AdaptiveColor{
				Dark:  fmt.Sprintf("%d", darkInt),
				Light: fmt.Sprintf("%d", lightInt),
			}, nil
		}

		if !hexColorRegex.MatchString(darkHex) || !hexColorRegex.MatchString(lightHex) {
			return lipgloss.AdaptiveColor{}, fmt.Errorf("invalid hex color format")
		}

		return lipgloss.AdaptiveColor{
			Dark:  darkHex,
			Light: lightHex,
		}, nil
	}

	return lipgloss.AdaptiveColor{}, fmt.Errorf("color must be either a hex string or an object with dark/light keys")
}
